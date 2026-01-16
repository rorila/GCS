
export interface MethodParamDef {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'select' | 'color';
    label?: string;
    default?: any;
    options?: string[]; // For select type
    optional?: boolean;
}

export const MethodRegistry: Record<string, MethodParamDef[]> = {
    'moveTo': [
        { name: 'x', type: 'number', label: 'Target X' },
        { name: 'y', type: 'number', label: 'Target Y' },
        { name: 'duration', type: 'number', label: 'Duration (ms)', default: 500, optional: true },
        { name: 'easing', type: 'select', label: 'Easing', default: 'easeOut', options: ['linear', 'easeIn', 'easeOut', 'easeInOut', 'bounce', 'elastic'], optional: true }
    ],
    'setVelocity': [
        { name: 'vx', type: 'number', label: 'Velocity X' },
        { name: 'vy', type: 'number', label: 'Velocity Y' }
    ],
    'setText': [
        { name: 'text', type: 'string', label: 'New Text' }
    ],
    'setSrc': [
        { name: 'src', type: 'string', label: 'Image Source' }
    ],
    'show': [],
    'hide': [],
    'toggle': [],
    'enable': [],
    'disable': [],
    'reset': [],
    'start': [],
    'stop': [],
    'pause': [],
    'resume': [],
    'flip': [],
    'open': [],
    'close': [],
    // TGameServer
    'createRoom': [
        { name: 'gameId', type: 'string', label: 'Game ID' }
    ],
    'joinRoom': [
        { name: 'roomId', type: 'string', label: 'Room Code' }
    ],
    'sendMessage': [
        { name: 'type', type: 'string', label: 'Message Type' },
        { name: 'payload', type: 'string', label: 'Payload (JSON)' }
    ],
    // TToast
    'info': [
        { name: 'message', type: 'string', label: 'Message' }
    ],
    'success': [
        { name: 'message', type: 'string', label: 'Message' }
    ],
    'warning': [
        { name: 'message', type: 'string', label: 'Message' }
    ],
    'error': [
        { name: 'message', type: 'string', label: 'Message' }
    ]
};
