"""Lokaler SFT-Worker. NDJSON auf stdout, Diagnose auf stderr. Keine Downloads."""
import argparse
import hashlib
import json
import random
import sys
import time
from pathlib import Path


def emit(event, **data):
    print(json.dumps({"event": event, **data}, ensure_ascii=False), flush=True)


def read_examples(filename):
    text = Path(filename).read_text(encoding="utf-8-sig")
    if len(text.encode("utf-8")) > 2_000_000:
        raise ValueError("Datensatz ist größer als 2 MB")
    rows, seen = [], set()
    for number, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        row = json.loads(line)
        messages = row.get("messages") if isinstance(row, dict) else None
        if not isinstance(messages, list) or len(messages) not in (2, 3):
            raise ValueError(f"Zeile {number}: system? / user / assistant erforderlich")
        roles = [m.get("role") if isinstance(m, dict) else None for m in messages]
        if roles not in (["user", "assistant"], ["system", "user", "assistant"]):
            raise ValueError(f"Zeile {number}: ungültige Rollenfolge")
        if any(not isinstance(m.get("content"), str) or not m["content"].strip() for m in messages):
            raise ValueError(f"Zeile {number}: leerer Inhalt")
        key = json.dumps(messages, sort_keys=True, ensure_ascii=False)
        if key in seen:
            raise ValueError(f"Zeile {number}: doppeltes Beispiel")
        seen.add(key)
        rows.append(messages)
    if not 1 <= len(rows) <= 500:
        raise ValueError("1 bis 500 Beispiele erforderlich")
    return rows


def prepare(config):
    rows = read_examples(config["dataset"])
    questions = config.get("evaluation", [])
    if not isinstance(questions, list) or not 1 <= len(questions) <= 20 or any(
        not isinstance(q, str) or not q.strip() or len(q) > 2000 for q in questions
    ):
        raise ValueError("1 bis 20 separate Prüffragen erforderlich")
    normalize = lambda s: " ".join(s.casefold().split())
    train_questions = {normalize(m[-2]["content"]) for m in rows}
    if any(normalize(q) in train_questions for q in questions):
        raise ValueError("Prüffragen dürfen nicht im Training enthalten sein")
    steps = config.get("steps", 10)
    if type(steps) is not int or not 1 <= steps <= 200:
        raise ValueError("1 bis 200 Trainingsschritte erforderlich")
    limit = config.get("maxTokens", 512)
    if type(limit) is not int or not 64 <= limit <= 1024:
        raise ValueError("Tokenlimit muss zwischen 64 und 1024 liegen")
    for name, required in (("base", "config.json"), ("adapter", "adapter_config.json")):
        if not (Path(config[name]) / required).is_file():
            raise ValueError(f"{name}: {required} fehlt")
    adapter_config = json.loads((Path(config["adapter"]) / "adapter_config.json").read_text())
    if Path(adapter_config.get("base_model_name_or_path", "")).resolve() != Path(config["base"]).resolve():
        raise ValueError("Adapter und konfigurierte Basis stimmen nicht überein")
    from transformers import AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained(config["base"], local_files_only=True)
    encoded = []
    for messages in rows:
        if messages[0]["role"] != "system":
            messages = [{"role": "system", "content": config["system"]}] + messages
        prefix = tokenizer.apply_chat_template(messages[:-1], tokenize=True,
            add_generation_prompt=True, return_dict=True)["input_ids"]
        full = tokenizer.apply_chat_template(messages, tokenize=True,
            add_generation_prompt=False, return_dict=True)["input_ids"]
        if len(full) > limit:
            raise ValueError(f"Beispiel mit {len(full)} Tokens überschreitet {limit}; keine stille Kürzung")
        if full[:len(prefix)] != prefix or len(full) <= len(prefix):
            raise ValueError("Chat-Template erlaubt keine sichere Antwort-Maskierung")
        encoded.append((full, len(prefix)))
    return tokenizer, encoded


def run(config, validate_only=False):
    tokenizer, examples = prepare(config)
    emit("validated", examples=len(examples), maxTokens=max(len(x[0]) for x in examples))
    if validate_only:
        return
    import torch
    from transformers import AutoModelForCausalLM, BitsAndBytesConfig
    from peft import PeftModel, prepare_model_for_kbit_training
    if not torch.cuda.is_available():
        raise RuntimeError("Keine nutzbare GPU; CPU-Fallback ist deaktiviert")
    output = Path(config["output"])
    output.mkdir(parents=True, exist_ok=False)
    (output / "manifest.json").write_text(json.dumps({**config,
        "datasetSha256": hashlib.sha256(Path(config["dataset"]).read_bytes()).hexdigest(),
        "adapterSha256": hashlib.sha256((Path(config["adapter"]) / "adapter_model.safetensors").read_bytes()).hexdigest(),
        "torch": torch.__version__, "hip": torch.version.hip,
    }, indent=2), encoding="utf-8")
    cancelled = lambda: Path(config["cancelFile"]).exists()
    if cancelled():
        emit("cancelled", checkpoint=False)
        return
    torch.manual_seed(42)
    random.seed(42)
    torch.set_num_threads(4)
    emit("loading")
    model = AutoModelForCausalLM.from_pretrained(config["base"], local_files_only=True,
        quantization_config=BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True, bnb_4bit_compute_dtype=torch.bfloat16),
        device_map={"": 0}, dtype=torch.bfloat16, attn_implementation="eager")
    model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=True)
    model.get_input_embeddings().to(dtype=torch.bfloat16)
    model.get_output_embeddings().to(dtype=torch.bfloat16)
    model = PeftModel.from_pretrained(model, config["adapter"], is_trainable=True, local_files_only=True)

    def evaluate(label):
        model.eval()
        model.gradient_checkpointing_disable()
        answers = []
        for question in config["evaluation"]:
            if cancelled():
                return False
            inputs = tokenizer.apply_chat_template([
                {"role": "system", "content": config["system"]},
                {"role": "user", "content": question}], tokenize=True,
                add_generation_prompt=True, return_tensors="pt", return_dict=True).to("cuda")
            with torch.no_grad(), torch.autocast(device_type="cuda", dtype=torch.bfloat16):
                tokens = model.generate(**inputs, max_new_tokens=128, do_sample=False,
                    pad_token_id=tokenizer.eos_token_id, use_cache=True)
            answers.append({"question": question, "answer": tokenizer.decode(
                tokens[0, inputs["input_ids"].shape[1]:], skip_special_tokens=True)})
            (output / f"{label}.json").write_text(json.dumps(answers, ensure_ascii=False, indent=2), encoding="utf-8")
            emit("evaluation", phase=label, completed=len(answers), total=len(config["evaluation"]))
        return True

    if not evaluate("before"):
        emit("cancelled", checkpoint=False)
        return
    model.gradient_checkpointing_enable()
    model.config.use_cache = False
    model.train()
    trainable = [p for p in model.parameters() if p.requires_grad]
    optimizer = torch.optim.AdamW(trainable, lr=0.0002, weight_decay=0.0)
    history = []
    order = list(range(len(examples)))
    for step in range(config["steps"]):
        if cancelled():
            break
        if step % len(order) == 0:
            random.shuffle(order)
        full, prefix = examples[order[step % len(order)]]
        ids = torch.tensor([full], device="cuda")
        labels = ids.clone()
        labels[:, :prefix] = -100
        started = time.monotonic()
        optimizer.zero_grad(set_to_none=True)
        with torch.autocast(device_type="cuda", dtype=torch.bfloat16):
            loss = model(input_ids=ids, labels=labels).loss
        if not torch.isfinite(loss):
            raise RuntimeError("Nicht endlicher Loss")
        loss.backward()
        if not torch.isfinite(torch.nn.utils.clip_grad_norm_(trainable, 1.0)):
            raise RuntimeError("Nicht endliche Gradienten")
        optimizer.step()
        torch.cuda.synchronize()
        row = {"step": step + 1, "total": config["steps"], "loss": loss.item(),
               "seconds": time.monotonic() - started}
        history.append(row)
        with (output / "history.jsonl").open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(row) + "\n")
        emit("progress", **row)
    model.save_pretrained(output / "adapter")
    tokenizer.save_pretrained(output / "adapter")
    # Ein neuer SFT-Lauf kann diesen Adapter laden; kein exaktes Optimierer-Resume.
    if cancelled() or not evaluate("after"):
        emit("cancelled", checkpoint=True, steps=len(history))
    else:
        emit("completed", steps=len(history), adapter=str(output / "adapter"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    try:
        run(json.loads(Path(args.config).read_text(encoding="utf-8-sig")), args.validate_only)
    except Exception as error:
        emit("failed", error=str(error))
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
