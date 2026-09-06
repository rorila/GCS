# Änderungen der technischen Kopie

## 2026-09-06

- Bereinigte technische Kopie des vollständigen lokalen v1-Arbeitsstands erstellt.
- KI-Markdown, Komponentenschemas, persistierte Wissensbasis und Trainingsbeispiel erhalten.
- KI-Dokumente und Schemas in die Vite-Produktionsausgabe aufgenommen.
- AgentController: fehlende IDs gelten nicht mehr als übereinstimmende Objektidentitäten;
  drei Regressionstests prüfen Neuanlage und Upsert über Name bzw. ID.
- StageInteractionHost als separate Typdatei ausgelagert, bisheriger Importpfad bleibt per Re-Export gültig.
- Zwei direkte Konsolenwarnungen auf den vorhandenen Logger umgestellt.
- tsx als feste Entwicklungsabhängigkeit deklariert.
- Regressionstests mit temporärer Datenbank und expliziter Trennung vom E2E-Lauf ausgestattet.
- Projektvalidator akzeptiert einen Dateiparameter und hat eine vorhandene Standardressource.
- Ortsunabhängigen gemeinsamen Starter mit Portprüfung ergänzt; keine fremden Prozesse werden beendet.
- Lokale Konfiguration und neu erzeugbare Laufzeit-/Builddateien in .gitignore ergänzt.

Änderungen gelten ausschließlich für game-builder-v2. Der ursprüngliche Verlauf bleibt in v1.
