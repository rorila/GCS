import { componentRegistry } from './src/services/ComponentRegistry.ts'; console.log(componentRegistry.getInspectorProperties({ className: 'TSprite' }).map(p => p.name));
