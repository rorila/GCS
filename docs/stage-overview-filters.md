# Projektbezogene Stage-Filter

Die Übersicht bietet Suche, Gruppen und Stage-Typen. Gruppen und Typen erscheinen nur bei mehreren unterschiedlichen Werten. „Filter zurücksetzen“ setzt alle Filter gemeinsam zurück.

Zusätzliche Filter werden optional im Projekt definiert:

```json
{
  "stageOverview": {
    "filters": [{
      "id": "worlds",
      "label": "Welten",
      "options": [{ "id": "forest", "label": "Wald" }, { "id": "sea", "label": "Meer" }]
    }]
  }
}
```

Stages erhalten beispielsweise `"overviewTags": { "worlds": ["forest"] }`. Eine Stage kann mehrere Werte besitzen. Filter werden miteinander und mit Suche, Gruppe und Typ kombiniert. Nicht zugeordnete Stages bleiben bei „Alle“ sichtbar. Unbenutzte Optionen und Filter mit weniger als zwei belegten Optionen erscheinen nicht.

Die CMS-Rollen sind in `game-server/public/projects/GCS-CMS.json` definiert. Es gibt keine automatische Rollenvergabe anhand von Stage-Namen oder IDs. Die bisherigen `editorRoles` bleiben als Legacy-Daten lesbar, werden in der Übersicht aber durch `overviewTags` ersetzt. Die Navigationstags haben keinen Einfluss auf Laufzeitberechtigungen.

Die Konfiguration erfolgt derzeit in der Projektdatei; eine eigene Bearbeitungsoberfläche ist nicht enthalten.

Prüfung: `node --import tsx scripts/test-stage-overview-filters.ts`. Der Browser-Regressionstest ist `node scripts/test-stage-overview-ui.cjs`.
