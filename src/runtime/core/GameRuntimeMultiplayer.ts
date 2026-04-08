export class GameRuntimeMultiplayer {
    constructor(
        private options: any,
        private getObjects: () => any[],
        private handleEvent: (objectId: string, eventName: string, data?: any) => void,
        private getActionExecutor: () => any,
        private getTaskExecutor: () => any,
        private getContextVars: () => any,
        private triggerRender: () => void
    ) {}

    public init(): void {
        const mp = this.options.multiplayerManager || (window as any).multiplayerManager;
        if (!mp?.on) return;

        mp.on((msg: any) => {
            this.getObjects().filter(o => o.className === 'THandshake').forEach(hs => {
                if (msg.type === 'room_joined') {
                    hs._setRoomInfo(msg.roomCode, msg.playerNumber, msg.playerNumber === 1);
                    hs._setStatus('waiting');
                    hs._fireEvent('onRoomJoined', msg);
                } else if (msg.type === 'game_start') {
                    hs._setStatus('playing');
                    hs._fireEvent('onGameStart', msg);
                } else if (msg.type === 'room_created') {
                    hs._setRoomInfo(msg.roomCode, 1, true);
                    hs._setStatus('waiting');
                    hs._fireEvent('onRoomCreated', msg);
                }
            });

            this.getObjects().filter(o => o.className === 'THeartbeat').forEach(hb => {
                if (msg.type === 'pong') hb._handlePong(msg.serverTime);
                else if (msg.type === 'player_timeout') hb._setConnectionLost();
            });
        });

        // Setup the remote task bridge (formerly in GameRuntime constructor)
        mp.onRemoteTask = (msg: any) => this.executeRemoteTask(msg.taskName, msg.params);
    }

    public updateRemoteState(objectIdOrName: string, state: any) {
        const obj = this.getObjects().find(o => o.id === objectIdOrName || o.name === objectIdOrName);
        if (obj) {
            Object.assign(obj, state);
            this.triggerRender();
        }
    }

    public triggerRemoteEvent(objectId: string, eventName: string, params: any) {
        const obj = this.getObjects().find(o => o.id === objectId);
        if (obj) this.handleEvent(objectId, eventName, params);
    }

    public executeRemoteAction(action: any) {
        const ex = this.getActionExecutor();
        if (ex) {
            ex.execute(action, {
                vars: this.getContextVars(),
                contextVars: this.getContextVars()
            });
        }
    }

    public executeRemoteTask(taskName: string, params: any = {}, mode?: string) {
        const ex = this.getTaskExecutor();
        if (ex) {
            ex.execute(taskName, params, this.getContextVars(), mode === 'sequential');
        }
    }
}
