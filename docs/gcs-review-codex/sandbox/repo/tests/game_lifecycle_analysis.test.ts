import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeGameLifecycle } from '../src/model/GameLifecycleAnalysis';
import { GameProject } from '../src/model/types';

describe('GameLifecycleAnalysis', () => {
    it('sollte ein leeres Projekt robust verarbeiten (Schlechtfall / Boundary)', () => {
        const result = analyzeGameLifecycle({} as any);
        assert.equal(result.totalPhases, 0);
        assert.equal(result.totalTasks, 0);
        assert.ok(result.mermaidCode.includes('Keine Stages'));
    });

    it('sollte Phasen, Features, Tasks und Transitions korrekt extrahieren (Gutfall)', () => {
        const mockProject: GameProject = {
            id: 'test-game',
            name: 'Ufo Attack',
            stages: [
                {
                    id: 'stage_blueprint',
                    name: 'Blueprint Stage',
                    type: 'blueprint',
                    tasks: [
                        { id: 't0', name: 'InitGlobals', actionSequence: [] }
                    ],
                    objects: [],
                    actions: []
                },
                {
                    id: 'stage_menu',
                    name: 'Hauptmenü',
                    type: 'normal',
                    features: [
                        { id: 'feat_menu', name: 'Menü-Führung', parentId: null, userStoryIds: ['us1'] }
                    ],
                    tasks: [
                        {
                            id: 't1',
                            name: 'StartButtonClicked',
                            actionSequence: [
                                { type: 'action', name: 'Act_GoToGame' }
                            ]
                        }
                    ],
                    actions: [
                        {
                            name: 'Act_GoToGame',
                            type: 'navigate_stage',
                            stageId: 'stage_game'
                        }
                    ],
                    objects: [
                        {
                            id: 'btn1',
                            name: 'BtnStart',
                            className: 'TButton',
                            events: { onClick: 'StartButtonClicked' }
                        } as any
                    ]
                },
                {
                    id: 'stage_game',
                    name: 'Gameplay',
                    type: 'normal',
                    features: [
                        { id: 'feat_ufo', name: 'Ufo Spawning', parentId: null, userStoryIds: [] }
                    ],
                    tasks: [
                        { id: 't2', name: 'SpawnWave', actionSequence: [] },
                        {
                            id: 't3',
                            name: 'CheckGameOver',
                            actionSequence: [
                                { type: 'action', name: 'Act_GoToGameOver' }
                            ]
                        }
                    ],
                    actions: [
                        {
                            name: 'Act_GoToGameOver',
                            type: 'navigate_stage',
                            stageId: 'stage_gameover'
                        }
                    ],
                    objects: []
                },
                {
                    id: 'stage_gameover',
                    name: 'Game Over Screen',
                    type: 'normal',
                    tasks: [
                        { id: 't4', name: 'RestartGame', actionSequence: [] }
                    ],
                    objects: [],
                    actions: []
                }
            ],
            userStories: {
                userStories: [
                    {
                        id: 'us1',
                        title: 'Spieler startet Spiel',
                        featureId: 'feat_menu',
                        plannedTask: 'StartButtonClicked',
                        plannedEvent: 'onClick'
                    }
                ]
            }
        } as any;

        const result = analyzeGameLifecycle(mockProject);

        assert.equal(result.totalPhases, 4, 'Sollte 4 Phasen ermitteln');
        assert.equal(result.totalTasks, 5, 'Sollte 5 Tasks ermitteln');
        assert.equal(result.totalTransitions, 2, 'Sollte 2 Stage-Transitions finden');

        // Phasen prüfen
        const menuPhase = result.phases.find(p => p.stageId === 'stage_menu');
        assert.ok(menuPhase, 'Menü-Phase muss existieren');
        assert.equal(menuPhase.features.length, 1);
        assert.equal(menuPhase.features[0].id, 'feat_menu');
        assert.equal(menuPhase.tasks[0].name, 'StartButtonClicked');
        assert.ok(menuPhase.tasks[0].triggers.includes('onClick') || menuPhase.tasks[0].triggers.some(t => t.includes('BtnStart')));
        assert.equal(menuPhase.transitions.length, 1);
        assert.equal(menuPhase.transitions[0].targetStageId, 'stage_game');

        // Task- und Feature-Registrierungen prüfen
        assert.ok(result.taskNames.includes('StartButtonClicked'));
        assert.ok(result.taskNames.includes('SpawnWave'));
        assert.ok(result.featureIds.includes('feat_menu'));
        assert.ok(result.featureIds.includes('feat_ufo'));

        // Mermaid-Syntax prüfen
        assert.ok(result.mermaidCode.startsWith('flowchart TD'));
        assert.ok(result.mermaidCode.includes('subgraph'));
        assert.ok(result.mermaidCode.includes('Wechsel zu Gameplay'));
    });
});
