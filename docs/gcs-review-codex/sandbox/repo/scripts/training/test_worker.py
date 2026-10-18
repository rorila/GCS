import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('worker', Path(__file__).with_name('worker.py'))
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class DatasetTests(unittest.TestCase):
    def check(self, rows):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / 'data.jsonl'
            file.write_text('\n'.join(json.dumps(row) for row in rows), encoding='utf-8')
            return worker.read_examples(file)

    def test_valid(self):
        self.assertEqual(len(self.check([{'messages': [
            {'role': 'user', 'content': 'Frage'}, {'role': 'assistant', 'content': 'Antwort'}]}])), 1)

    def test_empty_and_invalid(self):
        for rows in ([], [{}], [{'messages': [{'role': 'assistant', 'content': 'Antwort'}]}],
                     [{'messages': [{'role': 'user', 'content': 'Frage'}, {'role': 'assistant', 'content': ' '}]}]):
            with self.subTest(rows=rows), self.assertRaises(ValueError):
                self.check(rows)

    def test_duplicates(self):
        row = {'messages': [{'role': 'user', 'content': 'Frage'}, {'role': 'assistant', 'content': 'Antwort'}]}
        with self.assertRaises(ValueError):
            self.check([row, row])


if __name__ == '__main__':
    unittest.main()
