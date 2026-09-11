import type { GameRuntime } from '../GameRuntime';
import { DebugLogService } from '../../services/DebugLogService';

export class RuntimeTimerService {
    public startTimer(runtime: GameRuntime, prop: string, varDef: any, duration: number) {
            if (runtime.varTimers.has(prop)) clearInterval(runtime.varTimers.get(prop));
    
            let timeLeft = duration;
            const interval = setInterval(() => {
                timeLeft--;
                runtime.contextVars[prop] = timeLeft;
                if (timeLeft <= 0) {
                    clearInterval(interval);
                    runtime.varTimers.delete(prop);
                    if (runtime.taskExecutor && varDef.onTimerEnd) {
                        const eventLogId = DebugLogService.getInstance().log('Event', `Triggered: ${prop}.onTimerEnd`, {
                            objectName: prop,
                            eventName: 'onTimerEnd'
                        });
                        runtime.taskExecutor.execute(varDef.onTimerEnd, {}, runtime.contextVars, undefined, 0, eventLogId);
                    }
                }
            }, 1000);
            runtime.varTimers.set(prop, interval);
        }

    public clearAllTimers(runtime: GameRuntime) {
            runtime.varTimers.forEach(t => clearInterval(t));
            runtime.varTimers.clear();
        }

    public handleVariableAction(runtime: GameRuntime, name: string, action: string, ...params: any[]) {
            const varDef = runtime.getVarDef(name);
            if (!varDef) return;
    
            switch (action) {
                case 'set': runtime.contextVars[name] = params[0]; break;
                case 'reset': runtime.contextVars[name] = varDef.defaultValue; break;
                case 'start': if (varDef.type === 'timer') this.startTimer(runtime, name, varDef, params[0] || varDef.duration || 10); break;
                case 'stop': if (varDef.type === 'timer' && runtime.varTimers.has(name)) { clearInterval(runtime.varTimers.get(name)); runtime.varTimers.delete(name); } break;
                case 'add': if (varDef.type === 'list' || varDef.type === 'object_list') { const list = Array.isArray(runtime.contextVars[name]) ? [...runtime.contextVars[name]] : []; list.push(params[0]); runtime.contextVars[name] = list; } break;
                case 'remove': if (varDef.type === 'list' || varDef.type === 'object_list') { const list = Array.isArray(runtime.contextVars[name]) ? [...runtime.contextVars[name]] : []; const idx = list.indexOf(params[0]); if (idx > -1) { list.splice(idx, 1); runtime.contextVars[name] = list; } } break;
                case 'clear': if (varDef.type === 'list' || varDef.type === 'object_list') runtime.contextVars[name] = []; break;
                case 'roll': if (varDef.type === 'random' || varDef.isRandom) { const min = Number(varDef.min) || 0; const max = Number(varDef.max) || 100; runtime.contextVars[name] = min + Math.random() * (max - min); } break;
            }
        }
}
