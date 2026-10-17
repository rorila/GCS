# Komponenten-Referenz

> Generierter Index — Quelle: `src/components/` + Registries. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

121 Komponenten-Dateien · 128 Einträge im Inventar (7 schema-only).

## Registrierungs-Landschaft

- **Editor-Registry** (`src/services/ComponentRegistry.ts`): 112 Einträge — steuert Toolbox/Inspector.
- **Runtime-Registry** (`src/utils/ComponentRegistry.ts`): 116 Dateien mit Selbstregistrierung — Factory `ComponentRegistry.create()`.
- Nicht in Editor-Registry: TComponent, TDebugLog, TFlowStage, TForEach, TOverlay, TSlider, TSpeedlines, TSplashStage, TStage

## Basis/Vererbung (5)

| Komponente | Status | Test | Projekte |
|---|---|---|---|
| [TComponent](TComponent.md) | implementiert | test vorhanden | — |
| [TFlowStage](TFlowStage.md) | implementiert | test vorhanden | — |
| [TSplashStage](TSplashStage.md) | implementiert | nicht getestet | — |
| [TStage](TStage.md) | implementiert | test vorhanden | — |
| [TWindow](TWindow.md) | implementiert | test vorhanden | — |

## Anzeige (10)

| Komponente | Status | Test | Projekte |
|---|---|---|---|
| [TBadge](TBadge.md) | implementiert | nicht getestet | — |
| [TLabel](TLabel.md) | implementiert | test vorhanden | 37 |
| [TNumberLabel](TNumberLabel.md) | implementiert | nicht getestet | 6 |
| [TProgressBar](TProgressBar.md) | implementiert | nicht getestet | — |
| [TRichText](TRichText.md) | implementiert | nicht getestet | — |
| [TShape](TShape.md) | implementiert | test vorhanden | 1 |
| [TSpeedlines](TSpeedlines.md) | implementiert | test vorhanden | 1 |
| [TStatusBar](TStatusBar.md) | implementiert | test vorhanden | 3 |
| [TStickyNote](TStickyNote.md) | implementiert | test vorhanden | 2 |
| [TTextControl](TTextControl.md) | implementiert | test vorhanden | — |

## Medien & Sprache (9)

| Komponente | Status | Test | Projekte |
|---|---|---|---|
| [TAudio](TAudio.md) | implementiert | test vorhanden | 5 |
| [TImage](TImage.md) | implementiert | test vorhanden | 11 |
| [TImageGallery](TImageGallery.md) | implementiert | test vorhanden | 3 |
| [TImageList](TImageList.md) | implementiert | test vorhanden | 6 |
| [TImageSplitter](TImageSplitter.md) | implementiert | test vorhanden | 3 |
| [TSpeech](TSpeech.md) | implementiert | test vorhanden | 1 |
| [TSpeechRecognition](TSpeechRecognition.md) | implementiert | test vorhanden | 7 |
| [TTextToSpeech](TTextToSpeech.md) | implementiert | test vorhanden | 7 |
| [TVideo](TVideo.md) | implementiert | nicht getestet | 1 |

## Eingabe (11)

| Komponente | Status | Test | Projekte |
|---|---|---|---|
| [TButton](TButton.md) | implementiert | test vorhanden | 36 |
| [TCheckbox](TCheckbox.md) | implementiert | nicht getestet | — |
| [TColorPicker](TColorPicker.md) | implementiert | nicht getestet | — |
| [TDropdown](TDropdown.md) | implementiert | nicht getestet | 8 |
| [TEdit](TEdit.md) | implementiert | test vorhanden | 10 |
| [TEmojiPicker](TEmojiPicker.md) | implementiert | test vorhanden | 1 |
| [TFilePicker](TFilePicker.md) | implementiert | test vorhanden | 1 |
| [TFileUpload](TFileUpload.md) | implementiert | test vorhanden | 1 |
| [TMemo](TMemo.md) | implementiert | nicht getestet | 2 |
| [TNumberInput](TNumberInput.md) | implementiert | nicht getestet | 1 |
| [TSlider](TSlider.md) | experimentell | test vorhanden | — |

## Container/Layout (7)

| Komponente | Status | Test | Projekte |
|---|---|---|---|
| [TGroupPanel](TGroupPanel.md) | implementiert | test vorhanden | 2 |
| [TLink](TLink.md) | implementiert | nicht getestet | 1 |
| [TNavBar](TNavBar.md) | implementiert | nicht getestet | — |
| [TPanel](TPanel.md) | implementiert | test vorhanden | 17 |
| [TSidePanel](TSidePanel.md) | implementiert | test vorhanden | — |
| [TTabBar](TTabBar.md) | implementiert | nicht getestet | — |
| [TTabControl](TTabControl.md) | implementiert | nicht getestet | — |

## Daten & Listen (7)

| Komponente | Status | Test | Projekte |
|---|---|---|---|
| [TDataList](TDataList.md) | implementiert | nicht getestet | — |
| [TDataStore](TDataStore.md) | implementiert | test vorhanden | — |
| [TKeyStore](TKeyStore.md) | implementiert | nicht getestet | — |
| [TList](TList.md) | implementiert | test vorhanden | — |
| [TObjectList](TObjectList.md) | implementiert | test vorhanden | 20 |
| [TStringMap](TStringMap.md) | implementiert | test vorhanden | 3 |
| [TTable](TTable.md) | implementiert | test vorhanden | 7 |

## Variablen (11)

| Komponente | Status | Test | Projekte |
|---|---|---|---|
| [TBooleanVariable](TBooleanVariable.md) | implementiert | nicht getestet | 27 |
| [TIntegerVariable](TIntegerVariable.md) | implementiert | test vorhanden | 23 |
| [TListVariable](TListVariable.md) | implementiert | test vorhanden | 13 |
| [TObjectVariable](TObjectVariable.md) | implementiert | test vorhanden | 17 |
| [TRandomVariable](TRandomVariable.md) | implementiert | test vorhanden | 4 |
| [TRangeVariable](TRangeVariable.md) | implementiert | nicht getestet | — |
| [TRealVariable](TRealVariable.md) | implementiert | nicht getestet | 2 |
| [TStringVariable](TStringVariable.md) | implementiert | nicht getestet | 24 |
| [TThresholdVariable](TThresholdVariable.md) | implementiert | test vorhanden | — |
| [TTriggerVariable](TTriggerVariable.md) | implementiert | nicht getestet | — |
| [TVariable](TVariable.md) | implementiert | test vorhanden | 13 |

## Zeitgeber (3)

| Komponente | Status | Test | Projekte |
|---|---|---|---|
| [THeartbeat](THeartbeat.md) | implementiert | test vorhanden | 2 |
| [TIntervalTimer](TIntervalTimer.md) | implementiert | test vorhanden | 3 |
| [TTimer](TTimer.md) | implementiert | test vorhanden | 26 |

## Spiel (16)

| Komponente | Status | Test | Projekte |
|---|---|---|---|
| [TAnimation](TAnimation.md) | implementiert | test vorhanden | 3 |
| [TAvatar](TAvatar.md) | implementiert | nicht getestet | — |
| [TCard](TCard.md) | implementiert | test vorhanden | — |
| [TCardZone](TCardZone.md) | implementiert | test vorhanden | 2 |
| [TGameCard](TGameCard.md) | implementiert | nicht getestet | — |
| [TGameLoop](TGameLoop.md) | implementiert | test vorhanden | 10 |
| [TGameState](TGameState.md) | implementiert | test vorhanden | 8 |
| [TGridBoard](TGridBoard.md) | implementiert | test vorhanden | 2 |
| [TInputController](TInputController.md) | implementiert | test vorhanden | 11 |
| [TParallaxBackground](TParallaxBackground.md) | implementiert | test vorhanden | 1 |
| [TPuzzleBoard](TPuzzleBoard.md) | implementiert | test vorhanden | 4 |
| [TSpawner](TSpawner.md) | implementiert | test vorhanden | 1 |
| [TSprite](TSprite.md) | implementiert | test vorhanden | 18 |
| [TSpriteTemplate](TSpriteTemplate.md) | implementiert | test vorhanden | 8 |
| [TTetris](TTetris.md) | implementiert | test vorhanden | — |
| [TVirtualGamepad](TVirtualGamepad.md) | implementiert | test vorhanden | 3 |

## System/Netzwerk (10)

| Komponente | Status | Test | Projekte |
|---|---|---|---|
| [TAPIServer](TAPIServer.md) | implementiert | test vorhanden | — |
| [TAuthService](TAuthService.md) | implementiert | test vorhanden | — |
| [TCmsLiveSync](TCmsLiveSync.md) | implementiert | test vorhanden | 3 |
| [TGameHeader](TGameHeader.md) | implementiert | nicht getestet | 3 |
| [TGameServer](TGameServer.md) | implementiert | test vorhanden | — |
| [THandshake](THandshake.md) | implementiert | test vorhanden | 2 |
| [TSplashScreen](TSplashScreen.md) | implementiert | nicht getestet | — |
| [TStageController](TStageController.md) | implementiert | test vorhanden | 11 |
| [TSystemInfo](TSystemInfo.md) | implementiert | nicht getestet | — |
| [TUserManager](TUserManager.md) | implementiert | nicht getestet | — |

## Overlays/Dialoge (7)

| Komponente | Status | Test | Projekte |
|---|---|---|---|
| [TDialogRoot](TDialogRoot.md) | implementiert | test vorhanden | 2 |
| [TInfoWindow](TInfoWindow.md) | implementiert | nicht getestet | — |
| [TInlineOverlay](TInlineOverlay.md) | implementiert | test vorhanden | 1 |
| [TLearningPointsOverlay](TLearningPointsOverlay.md) | implementiert | test vorhanden | 1 |
| [TOverlay](TOverlay.md) | implementiert | nicht getestet | 1 |
| [TThemeDialog](TThemeDialog.md) | implementiert | nicht getestet | — |
| [TToast](TToast.md) | implementiert | test vorhanden | 4 |

## Struktur/Templates (2)

| Komponente | Status | Test | Projekte |
|---|---|---|---|
| [TForEach](TForEach.md) | implementiert | test vorhanden | 2 |
| [TInspectorTemplate](TInspectorTemplate.md) | implementiert | nicht getestet | — |

## Debug (1)

| Komponente | Status | Test | Projekte |
|---|---|---|---|
| [TDebugLog](TDebugLog.md) | implementiert | test vorhanden | — |

## Server (CMS) (22)

| Komponente | Status | Test | Projekte |
|---|---|---|---|
| [TServerAccess](TServerAccess.md) | implementiert | nicht getestet | 1 |
| [TServerAuthenticate](TServerAuthenticate.md) | implementiert | nicht getestet | 1 |
| [TServerCards](TServerCards.md) | implementiert | test vorhanden | 1 |
| [TServerDecks](TServerDecks.md) | implementiert | test vorhanden | 1 |
| [TServerEndpoint](TServerEndpoint.md) | implementiert | test vorhanden | 2 |
| [TServerEnroll](TServerEnroll.md) | implementiert | nicht getestet | 1 |
| [TServerLiveSync](TServerLiveSync.md) | implementiert | nicht getestet | 1 |
| [TServerParentAccount](TServerParentAccount.md) | implementiert | nicht getestet | 1 |
| [TServerParty](TServerParty.md) | implementiert | nicht getestet | 1 |
| [TServerPerformance](TServerPerformance.md) | implementiert | nicht getestet | 1 |
| [TServerPlaySession](TServerPlaySession.md) | implementiert | test vorhanden | 1 |
| [TServerProfile](TServerProfile.md) | implementiert | nicht getestet | 1 |
| [TServerQuery](TServerQuery.md) | implementiert | test vorhanden | 1 |
| [TServerResponse](TServerResponse.md) | implementiert | test vorhanden | 2 |
| [TServerReward](TServerReward.md) | implementiert | nicht getestet | 1 |
| [TServerSession](TServerSession.md) | implementiert | test vorhanden | 2 |
| [TServerSponsorAgreement](TServerSponsorAgreement.md) | implementiert | nicht getestet | 1 |
| [TServerSponsorship](TServerSponsorship.md) | implementiert | nicht getestet | 1 |
| [TServerSql](TServerSql.md) | implementiert | nicht getestet | 1 |
| [TServerStore](TServerStore.md) | implementiert | nicht getestet | 1 |
| [TServerUpload](TServerUpload.md) | implementiert | test vorhanden | 1 |
| [TServerValidate](TServerValidate.md) | implementiert | nicht getestet | 1 |

## Nur im Schema (geplant)

- `TServerAuthorize` — docs/schemas/schema_server_cms.json
- `TServerGuardian` — docs/schemas/schema_server_cms.json
- `TServerRateLimit` — docs/schemas/schema_server_cms.json
- `TServerProgress` — docs/schemas/schema_server_cms.json
- `TServerPrivacy` — docs/schemas/schema_server_cms.json
- `TServerInvite` — docs/schemas/schema_server_cms.json
- `TServerDeviceGrant` — docs/schemas/schema_server_cms.json

_Analyse: 2026-10-17 · Commit 53e3dfb_
