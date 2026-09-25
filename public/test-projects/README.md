# Test-Projekte (testeigen)

Diese Dateien sind **Kopien für den automatisierten Testlauf** (`npm run test` / Playwright E2E / CMS-Aufbauläufe).

**Nicht löschen, nicht verschieben, nicht umbenennen** — die Tests hängen an diesen Dateinamen.
Produktiv-Spiele unter `../projects/` dürfen dagegen jederzeit geändert werden; Tests laufen ausschließlich gegen diese Kopien.

| Datei | Verwendet von |
|---|---|
| `PuzzleNeu.json` | `17_PuzzleSourceRect.spec.ts`, `_debug_chicken*.spec.ts` |
| `UfoShoter4.json` | `test_movement.spec.ts` |
| `ZahlenDuell.json` | `test-aufbau-5-spiele.cjs` (CMS-Upload-Test) |
| `PingPong.json` | `deep_integration.spec.ts` |
| `MemoryGame.json` | `test-memory-game.spec.ts` |
