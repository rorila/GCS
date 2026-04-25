import { registerPropertyActions } from './handlers/PropertyActions';
import { registerVariableActions } from './handlers/VariableActions';
import { registerCalculateActions } from './handlers/CalculateActions';
import { registerAnimationActions } from './handlers/AnimationActions';
import { registerNavigationActions } from './handlers/NavigationActions';
import { registerHttpActions } from './handlers/HttpActions';
import { registerObjectPoolActions } from './handlers/ObjectPoolActions';
import { registerMiscActions } from './handlers/MiscActions';
import { registerDialogActions } from './handlers/DialogActions';
import { registerCollectionActions } from './handlers/CollectionActions';

/**
 * REGISTRIERUNG ALLER STANDARD-AKTIONEN
 * 
 * Die Registrierungs-Logik wurde aus Gründen der Wartbarkeit aufgeteilt. 
 * Jede Funktion registriert eine thematische Gruppe von Aktionen in der globalen actionRegistry.
 */
export function registerStandardActions() {
    registerPropertyActions();
    registerVariableActions();
    registerCalculateActions();
    registerAnimationActions();
    registerNavigationActions();
    registerHttpActions();
    registerObjectPoolActions();
    registerMiscActions();
    registerDialogActions();
    registerCollectionActions();
}
