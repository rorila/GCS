**1. Was passiert unter der Haube bei einer Kollision?**

Wenn zwei Objekte (z. B. das Ufo und eine Kugel) aufeinandertreffen, feuert die Engine das onCollision Event 

(sowie spezifische Events wie onCollisionTop etc.). 

Gleichzeitig übergibt die Engine diesem Event im Hintergrund ein Datenpaket (den sogenannten Event-Kontext). 

Dieses Paket enthält wichtige Informationen, auf die du in deinen Actions zugreifen kannst:



**Ausgangslage:** 

Du hast ein Ufo-Template (Name: UfoTemplate) und ein Kugel-Template (Name: KugelTemplate) im Editor erzeugt. 

Diese Templates erzeugen zur Laufzeit je einen Sprite-Pool. 

Die Elemente des Pools werden dynamisch erzeugt und wie folgt mit Namen bezeichnet:



Elemente des Ufo-Templates: UfoTemplate\_pool\_1, UfoTemplate\_pool\_2, UfoTemplate\_pool\_3 usw.

Elemente des Kugel-Templates: KugelTemplate\_pool\_1, KugelTemplate\_pool\_2, KugelTemplate\_pool\_3 usw.

Nehmen wir mal an, eine Kugel wird von einer Kanone abgefeuert und trifft ein Ufo:



self: Das Objekt, auf dem das Event ausgelöst wurde (das Ufo, das getroffen wurde, z.B. UfoTemplate\_pool\_5).

other: Der Name des Objekts, mit dem kollidiert wurde (die Kugel, die das Ufo getroffen hat, z.B. "KugelTemplate\_pool\_2").

otherSprite: Das tatsächliche Komponenten-Objekt des Kollisionspartners 

(die Komponente KugelTemplate\_pool\_2, inkl. aller seiner Eigenschaften wie z.B. templateName).

hitSide: Die Seite, an der es gekracht hat (bezieht sich auf das Ufo, das getroffen wurde, z.B. "top" des UfoTemplate\_pool\_5).



**2. Wie baust du das Ufo-Explodieren im Flow-Editor?**

Da die Pool-Objekte zur Laufzeit dynamische Namen wie "KugelTemplate\_pool\_1" oder "KugelTemplate\_pool\_2" bekommen, solltest du in deiner Bedingung nicht auf den exakten Namen prüfen, sondern auf den Namen des Templates (also z.B. "KugelTemplate").



So stellst du das Ufo ein:



Öffne das UfoTemplate im Editor.



Füge dem Ufo einen Task für das Event onCollision hinzu (z.B. "UfoWirdGetroffen").



Füge als erste Action im Task eine FlowCondition (Wenn-Dann-Bedingung) hinzu:



Linke Seite (Variable): ${otherSprite.templateName} (Dieses Binding zieht sich den Template-Namen des Kollisions-Gegners aus dem Event-Kontext).

Operator: ==

Rechte Seite (Literal/Wert): KugelTemplate (bzw. der exakte Name deines Kugel-Templates im Editor).

In den True-Zweig (Wenn JA) dieser Bedingung legst du nun deine Reaktions-Actions:



Action 1 (Optional, für den Effekt): Komponente animieren -> Effekt explode (oder pop) -> Ziel-Objekt auf %self% setzen.

Action 2 (Ufo zerstören): Objekt zerstören -> Ziel-Objekt auf %self% setzen.

Action 3 (Kugel zerstören): Objekt zerstören -> Ziel-Objekt auf %other% setzen.

Action 4 (Audio ablaufen lassen): z.B. einen Explosions-Sound abspielen.

