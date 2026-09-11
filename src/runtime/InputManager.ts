/**
 * InputManager polled alle registrierten Eingabe-Controller (Tastatur,
 * Gamepad, virtuelle Eingabe) einmal pro Frame.
 */
export class InputManager {
    public update(controllers: any[]): void {
        for (const ic of controllers) {
            if (ic && typeof ic.update === 'function') {
                ic.update();
            }
        }
    }
}
