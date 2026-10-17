Die Spieleransicht `stage_gallery` zeigt nach der Raumauswahl sämtliche
freigegebenen Spiele in `SpieleTabelle`. Die Liste ist scrollbar und zeigt
Symbol, Spielname und Spielart. Die bisherigen vier Spielkarten und ihre
Seitenschalter werden in dieser Ansicht ausgeblendet.

Ein Zeilenklick startet ein Einzelspielerspiel über den bisherigen Launchweg.
Bei Mehrspielerspielen wird die Lobby geöffnet, Raum und Spiel sind bereits
gewählt; anschließend wird ein Mitspieler ausgewählt. Die Raumtabelle und
deren Navigation bleiben bestehen.

`/api/cms/games` liefert zusätzlich `items` mit der vollständigen Liste.
Mit `includeParty: true` enthält sie auch Mehrspielerspiele. Hausfreigaben,
Raumfreigaben und Zutritt werden weiterhin serverseitig geprüft. Die bisherigen
Slots bleiben für ältere Aufrufer erhalten.

Gezielter Builder: `node scripts/cms/cms-gallery-game-table.cjs`.
Prüfungen: `npx tsx --test tests/gallery_game_table.test.ts`.
