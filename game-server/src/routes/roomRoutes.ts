import express from 'express';
import { rooms } from '../serverState';

export function registerRoomRoutes(app: express.Application) {
    /**
     * GET /rooms/active - Get all active rooms (even those with 2 players)
     */
    app.get('/rooms/active', (req, res) => {
        const activeRooms: any[] = [];
        rooms.forEach((room, code) => {
            activeRooms.push({
                code: room.code,
                gameName: room.gameName,
                playerCount: room.playerCount(),
                gameStarted: room.gameStarted,
                hasProject: !!room.project,
                hostName: room.metadata.hostName,
                hostAvatar: room.metadata.hostAvatar
            });
        });
        res.json(activeRooms);
    });

    /**
     * GET /rooms/waiting/:game - Get waiting rooms for a specific game
     */
    app.get('/rooms/waiting/:game', (req, res) => {
        const gameName = req.params.game;
        const waitingRooms: { code: string, gameName: string, playerCount: number }[] = [];

        rooms.forEach((room) => {
            if (room.isWaiting() && room.gameName === gameName) {
                waitingRooms.push({
                    code: room.code,
                    gameName: room.gameName,
                    playerCount: room.playerCount()
                });
            }
        });

        res.json(waitingRooms);
    });
}
