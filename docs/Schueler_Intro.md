# Willkommen im Game Builder! 🎮🚀

Stell dir vor: Du spielst nicht nur ein Computerspiel, sondern erschaffst **dein eigenes**. Du bist der Boss, der Regisseur und der Erfinder! Genau dafür ist unser Game Builder da.

Der Game Builder (wir nennen ihn manchmal GCS, was für *Game Creation System* steht) ist wie ein riesiger digitaler Lego-Baukasten. Anstatt komplizierte Programmiercodes zu tippen, klickst, ziehst und verbindest du einfach verschiedene Bausteine, um dein Spiel zum Leben zu erwecken.

Hier erfährst du, wie deine Spiele-Fabrik aufgebaut ist!

---

## 1. Die Bühne (Die Stage) 🎭
Die Bühne ist dein eigentliches Spiel. Stell dir vor, du schaust von oben auf ein Theaterstück herab. 
Alles, was der Spieler später sieht – die Figuren, die Hintergründe, Buttons und Punkteanzeigen – wird hierhin gezogen. 
- Du baust ein Labyrinth? Zieh einfach Wände auf die Bühne!
- Du machst ein Quiz? Zieh Buttons auf die Bühne! 
Du hast ein Gitter (Grid), mit dem du alles wie auf einem Kästchenpapier super ordentlich anordnen kannst.

## 2. Der Werkzeugkasten (Toolbox) 🧰
Auf der linken Seite deines Bildschirms liegt dein Werkzeugkasten. Dort findest du alles, was du für dein Spiel brauchst:
- **Buttons (Knöpfe):** Zum Draufklicken, zum Beispiel für "Start" oder "Springen".
- **Labels (Texte):** Um Dinge ranzuschreiben, etwa "Punkte: 100" oder "Game Over!".
- **Images (Bilder):** Für deine Spielfiguren, Monster oder Raumschiffe.
- **Joysticks:** Damit du dein Spiel später sogar am Handy wie mit einem echten Gamepad spielen kannst!

Du nimmst einfach ein Teil aus dem Werkzeugkasten und ziehst es mit der Maus auf die Bühne. Fertig!

## 3. Der Eigenschaften-Prüfer (Inspector) 🔍
Sobald du etwas auf deiner Bühne angeklickt hast (zum Beispiel einen deiner Buttons), taucht rechts der **Inspector** auf. Er ist dein magisches Einstellrad!
Hier kannst du deinem Button sagen:
- Wie er heißt (z.B. `Knopf_Start`)
- Welche Farbe er haben soll
- Ob er unsichtbar sein soll
- Wie groß er ist

## 4. Das Gehirn des Spiels (Flow Editor) 🧠⚡
Jetzt wird es richtig spannend! Ein Spiel macht keinen Spaß, wenn nichts passiert. Wenn du auf "Start" klickst, soll das Level losgehen. Aber woher weiß der Knopf das? Das stellst du im **Flow Editor** ein.

Der Flow Editor ist das Gehirn deines Spiels! Hier verbindest du "Wenn das passiert..." mit "...dann tu das!".

Es funktioniert mit drei einfachen Dingen:
1. **Events (Ereignisse):** Das ist der Auslöser. (Beispiel: *Der Spieler klickt auf den Start-Button.*)
2. **Tasks (Aufgaben):** Die Aufgabe, die erledigt werden muss. (Beispiel: *Level 1 vorbereiten.*)
3. **Actions (Aktionen):** Was ganz genau passieren soll. (Beispiel: *Spiele einen Sound ab, mache das Monster sichtbar.*)

Du verknüpfst diese Dinge mit bunten Linien. Wenn du also eine Linie vom "Klick-Event" zur "Sound abspielen-Aktion" ziehst, weiß das Spiel sofort: "Aha! Wenn der Spieler klickt, muss ich hupen!"

## 5. Variablen (Die Merkzettel) 📝
Zählen ist wichtig in Spielen! Wie viele Leben hast du noch? Wie viele Goldmünzen hast du gesammelt?
Dafür gibt es **Variablen**. Eine Variable ist wie eine kleine Schatzkiste mit einem Zettel drin. 
Du kannst eine Schatzkiste namens `Goldmünzen` anlegen und eine "0" auf den Zettel schreiben.
Jedes Mal, wenn deine Figur im Flow Editor eine Münze berührt, sagst du dem Spiel per *Action*: "Hol den Zettel aus der Kiste `Goldmünzen`, radier die Zahl weg und schreib eine Nummer größer drauf!"
Schon hast du ein funktionierendes Punkte-System!

---

## 🚀 Bist du bereit?
Mit diesem Lego-Baukasten aus Bühne, Werkzeugen und dem Gehirn im Flow Editor kannst du fast jedes Spiel bauen, das du dir vorstellen kannst! Fang klein an, verschiebe ein paar Buttons, ändere ihre Farbe und versuche, beim Anklicken einen kleinen Text zu verändern. 

Viel Spaß beim Bauen deines ersten eigenen Meisterwerks!
