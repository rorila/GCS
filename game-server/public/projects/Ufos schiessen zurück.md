**Vorbereitung (Bühne / BluePrint)**



Das Ufo (Gegner): Du erstellst ein TSpriteTemplate und nennst es UfoTemplate. 

Das Template legst du irgendwo auf die Bühne (wird eh unsichtbar). 

(Die Ufos lässt du wie bisher durch einen Timer erzeugen und auf die Reise schicken).



Die Kugel (Schuss): Du erstellst ein weiteres TSpriteTemplate (z. B. ein roter Punkt) und nennst es KugelTemplate. 

Gib ihm z.B. eine feste velocityY = 10, damit die Kugeln nach unten fliegen, wenn sie gespawnt werden.



Der globale Schuss-Timer: Du ziehst eine TTimer Komponente in die BluePrint-Stage. Nenne ihn GlobalerSchussTimer.



Stell das Interval auf einen sehr kleinen Wert, z.B. 400 (Millisekunden).

Setze ihn auf enabled = true.





**Das Flow-Diagramm (Die Logik)**

Jetzt musst du den Timer an die neue Action binden:



Gehe in die BluePrint-Stage.

Wähle den GlobalerSchussTimer an.

Lege beim Event onTimer einen neuen Task an: Task\_ZufaelligesUfoSchiesst.



Klicke auf "Task hinzufügen" (Plus-Button im Task)

Wähle ein Action, verbinde diese mit dem Task.

Wähle die Art der Action aus: 'pawn\_object'.



**Konfiguriere die Action wie folgt**:



Template: KugelTemplate (Was soll gespawnt werden?)

Spawnen bei Objekt: UfoTemplate (Wo soll gespawnt werden?)

Template Spawn Modus: Wähle aus dem neuen Dropdown "random\_active" aus!

(Optional) Offset Y: Setze z.B. 10, damit die Kugel leicht unterhalb des Ufos startet und es nicht direkt selbst trifft.



Fertig! Was passiert nun? Alle 400 Millisekunden schaut die Engine unsichtbar im Hintergrund nach: "Welche Klone von UfoTemplate sind gerade wirklich auf dem Bildschirm?". Dann würfelt sie einen davon aus und feuert exakt an dessen Koordinaten eine Kugel ab. Das ergibt ein super flüssiges und unregelmäßiges (asynchrones) Feindfeuer!

