import type { AIConfig } from '../../ai/config/AIConfig';
import { ollamaDefaultConfig, lmStudioDefaultConfig } from '../../ai/config/AIConfig';
import { AIConfigStore } from '../../ai/config/AIConfigStore';
import { OllamaProvider } from '../../ai/llm/OllamaProvider';
import { LMStudioProvider } from '../../ai/llm/LMStudioProvider';

/**
 * AIModelConfigDialog
 *
 * Eigenständiger Overlay-Dialog zur Konfiguration von Provider,
 * Endpoint, Modell und weiteren KI-Parametern. Wird über einen
 * Button aus dem AIGenerationDialog geöffnet.
 */

export class AIModelConfigDialog {
    public static open(onSave: (config: AIConfig) => void): void {
        let config: AIConfig = AIConfigStore.load();

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:2000; display:flex; align-items:center; justify-content:center;';

        const dialog = document.createElement('div');
        dialog.style.cssText = 'background:#1a1a2e; border:1px solid #3a3a6a; border-radius:8px; padding:20px; width:420px; max-width:90%; display:flex; flex-direction:column; gap:12px;';

        const title = document.createElement('h2');
        title.textContent = 'KI-Modell konfigurieren';
        title.style.cssText = 'margin:0; color:#fff; font-size:16px;';
        dialog.appendChild(title);

        const createLabel = (text: string) => {
            const label = document.createElement('label');
            label.textContent = text;
            label.style.cssText = 'font-size:11px; color:#888; text-transform:uppercase;';
            return label;
        };

        const createInput = (value: string, type = 'text', placeholder = '') => {
            const input = document.createElement('input');
            input.type = type;
            input.value = value;
            input.placeholder = placeholder;
            input.style.cssText = 'padding:8px; background:#0f0f1a; color:#fff; border:1px solid #333; border-radius:6px; width:100%; box-sizing:border-box;';
            return input;
        };

        const createSelect = (options: Array<{ value: string; label: string }>, value = '') => {
            const select = document.createElement('select');
            select.style.cssText = 'padding:8px; background:#0f0f1a; color:#fff; border:1px solid #333; border-radius:6px; width:100%; box-sizing:border-box;';
            for (const opt of options) {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                select.appendChild(option);
            }
            select.value = value;
            return select;
        };

        const createButton = (text: string, primary = false, onClick?: () => void) => {
            const btn = document.createElement('button');
            btn.textContent = text;
            btn.style.cssText = `padding:8px 12px; border:none; border-radius:6px; cursor:pointer; font-size:13px; ${
                primary ? 'background:#4caf50; color:#fff;' : 'background:#2a2a3e; color:#ccc; border:1px solid #444;'
            }`;
            if (onClick) btn.onclick = onClick;
            return btn;
        };

        const statusBar = document.createElement('div');
        statusBar.style.cssText = 'padding:8px 12px; border-radius:6px; background:#0f0f1a; border:1px solid #333; color:#888; font-size:12px;';
        statusBar.textContent = 'Provider, Endpoint und Modell prüfen und ggf. anpassen.';

        const providerSelect = createSelect([
            { value: 'ollama', label: 'Ollama' },
            { value: 'lmstudio', label: 'LM Studio' },
        ], config.provider);

        const endpointInput = createInput(config.endpoint, 'text', 'http://localhost:1234/v1');
        endpointInput.onchange = () => { config = { ...config, endpoint: endpointInput.value }; };

        const chatModelInput = createInput(config.chatModel, 'text', 'Modellname');
        chatModelInput.onchange = () => { config = { ...config, chatModel: chatModelInput.value }; };

        providerSelect.onchange = () => {
            const newProvider = providerSelect.value as 'ollama' | 'lmstudio';
            const preset = newProvider === 'ollama' ? ollamaDefaultConfig : lmStudioDefaultConfig;
            config = { ...config, provider: newProvider, endpoint: preset.endpoint, chatModel: preset.chatModel, embeddingModel: preset.embeddingModel };
            endpointInput.value = preset.endpoint;
            chatModelInput.value = preset.chatModel;
        };

        const temperatureInput = createInput(String(config.temperature), 'number', '0.1');
        temperatureInput.onchange = () => { config = { ...config, temperature: parseFloat(temperatureInput.value) || 0.1 }; };

        const contextWindowInput = createInput(String(config.contextWindow), 'number', '8192');
        contextWindowInput.onchange = () => { config = { ...config, contextWindow: parseInt(contextWindowInput.value, 10) || 8192 }; };

        const timeoutInput = createInput(String(config.requestTimeoutMs), 'number', '120000');
        timeoutInput.onchange = () => { config = { ...config, requestTimeoutMs: parseInt(timeoutInput.value, 10) || 120000 }; };

        const testConnectionBtn = createButton('Verbindung testen', false);
        testConnectionBtn.onclick = async () => {
            statusBar.textContent = 'Teste Verbindung...';
            statusBar.style.color = '#888';
            try {
                const provider = config.provider === 'ollama'
                    ? new OllamaProvider(config)
                    : new LMStudioProvider(config);
                const ok = await provider.healthCheck();
                statusBar.textContent = ok ? `Verbindung zu ${config.provider} OK` : `Verbindung zu ${config.provider} fehlgeschlagen`;
                statusBar.style.color = ok ? '#a6e3a1' : '#f38ba8';
            } catch (e: any) {
                statusBar.textContent = `Verbindungsfehler: ${e.message || e}`;
                statusBar.style.color = '#f38ba8';
            }
        };

        const close = () => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        };

        const saveBtn = createButton('Speichern', true, () => {
            AIConfigStore.save(config);
            onSave(config);
            close();
        });
        const cancelBtn = createButton('Abbrechen', false, close);

        const buttonRow = document.createElement('div');
        buttonRow.style.cssText = 'display:flex; gap:8px; justify-content:flex-end; margin-top:8px;';
        buttonRow.appendChild(cancelBtn);
        buttonRow.appendChild(saveBtn);

        dialog.appendChild(createLabel('Provider'));
        dialog.appendChild(providerSelect);
        dialog.appendChild(createLabel('Endpoint'));
        dialog.appendChild(endpointInput);
        dialog.appendChild(createLabel('Chat-Modell'));
        dialog.appendChild(chatModelInput);
        dialog.appendChild(createLabel('Temperatur'));
        dialog.appendChild(temperatureInput);
        dialog.appendChild(createLabel('Context Window'));
        dialog.appendChild(contextWindowInput);
        dialog.appendChild(createLabel('Timeout (ms)'));
        dialog.appendChild(timeoutInput);
        dialog.appendChild(testConnectionBtn);
        dialog.appendChild(statusBar);
        dialog.appendChild(buttonRow);

        overlay.appendChild(dialog);
        overlay.onclick = (e) => { if (e.target === overlay) close(); };
        document.body.appendChild(overlay);
    }
}
