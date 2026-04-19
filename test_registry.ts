import { ComponentRegistry } from './src/utils/ComponentRegistry.js';
import './src/components/index.js';

console.log("Teste TUserManager:");
const userManager = ComponentRegistry.create({ className: 'TUserManager', id: '123' });
console.log(userManager ? "SUCCESS: Erstellt" : "FAILED: Rückgabe war null");

console.log("Teste TAuthService:");
const authService = ComponentRegistry.create({ className: 'TAuthService', id: '124' });
console.log(authService ? "SUCCESS: Erstellt" : "FAILED: Rückgabe war null");

console.log("Teste TStage:");
const stage = ComponentRegistry.create({ className: 'TStage', id: '125' });
console.log(stage ? "SUCCESS: Erstellt" : "FAILED: Rückgabe war null");
