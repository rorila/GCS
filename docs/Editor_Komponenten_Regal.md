# Variablen und Dienste neben der Stage

In game-builder-v2 erscheint zwischen Stage und Inspector das Regal **Variablen & Dienste**. Bestehende und neu angelegte Variablen, Dienste (z. B. Timer und Audio) sowie Ressourcen werden automatisch eingeordnet. Globale bzw. geerbte Einträge sind separat gekennzeichnet; lokale Einträge folgen der aktiven Stage.

- Klick auf einen Eintrag öffnet dessen Eigenschaften im Inspector.
- Suche filtert nach Name, Typ und Herkunft.
- Rechtsklick erlaubt Umbenennen, Duplizieren und Löschen. Globale Einträge können als lokale Kopie dupliziert werden.
- Das Regal lässt sich einklappen und am linken Rand verbreitern. Breite und Öffnungszustand werden lokal gespeichert.
- **Auch auf Stage anzeigen** blendet die technischen Objekte bei Bedarf zusätzlich auf der Stage ein.

Die Anordnung ist eine Editoransicht. IDs, Positionen, Variablenwerte und Stage-Zuordnungen bleiben erhalten. Verborgene visuelle Komponenten bleiben auf der Stage. In anderen Ansichten wird das Regal ausgeblendet.

## Prüfung

Modelltests: node --import tsx --test tests/editor_shelf.test.ts
Browsertest: node scripts/test-editor-shelf.cjs
TypeScript: node node_modules/typescript/bin/tsc --noEmit
