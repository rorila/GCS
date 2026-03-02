import { expertRuleEngine, RuleNode } from '../editor/services/ExpertRuleEngine';

export class ExpertDialog {
    private overlay: HTMLElement;
    private modal: HTMLElement;
    private contentContainer: HTMLElement;
    private inputField: HTMLInputElement | HTMLSelectElement;
    private nextButton: HTMLButtonElement;
    private resolvePromise: ((payload: Record<string, any>) => void) | null = null;

    constructor() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'expert-overlay';
        this.overlay.style.position = 'fixed';
        this.overlay.style.top = '0';
        this.overlay.style.left = '0';
        this.overlay.style.width = '100vw';
        this.overlay.style.height = '100vh';
        this.overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
        this.overlay.style.zIndex = '9999';
        this.overlay.style.display = 'none';
        this.overlay.style.justifyContent = 'center';
        this.overlay.style.alignItems = 'center';

        this.modal = document.createElement('div');
        this.modal.style.backgroundColor = '#1e1e1e';
        this.modal.style.border = '1px solid #444';
        this.modal.style.borderRadius = '8px';
        this.modal.style.padding = '20px';
        this.modal.style.width = '400px';
        this.modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.8)';
        this.modal.style.color = '#fff';

        const title = document.createElement('h3');
        title.textContent = '🧙‍♂️ Expert Wizard';
        title.style.margin = '0 0 15px 0';
        title.style.paddingBottom = '10px';
        title.style.borderBottom = '1px solid #333';
        this.modal.appendChild(title);

        this.contentContainer = document.createElement('div');

        this.inputField = document.createElement('input');
        this.inputField.type = 'text';
        this.inputField.style.width = '100%';
        this.inputField.style.marginTop = '10px';
        this.inputField.style.padding = '8px';
        this.inputField.style.boxSizing = 'border-box';
        this.inputField.style.backgroundColor = '#2d2d2d';
        this.inputField.style.color = '#fff';
        this.inputField.style.border = '1px solid #555';

        this.nextButton = document.createElement('button');
        this.nextButton.textContent = 'Next ➔';
        this.nextButton.style.marginTop = '15px';
        this.nextButton.style.padding = '8px 16px';
        this.nextButton.style.float = 'right';
        this.nextButton.style.backgroundColor = '#007acc';
        this.nextButton.style.color = 'white';
        this.nextButton.style.border = 'none';
        this.nextButton.style.cursor = 'pointer';

        this.nextButton.addEventListener('click', () => this.handleNext());

        this.inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleNext();
        });

        this.modal.appendChild(this.contentContainer);
        this.modal.appendChild(this.inputField);
        this.modal.appendChild(this.nextButton);

        // Clear float
        const clr = document.createElement('div');
        clr.style.clear = 'both';
        this.modal.appendChild(clr);

        this.overlay.appendChild(this.modal);
        document.body.appendChild(this.overlay);
    }

    /**
     * Startet den Dialog für einen spezifischen TargetType (z.B. 'task' oder 'action').
     * @param targetName Der Name der Entität (für Updates) or empty string für neu.
     */
    public async open(targetType: string, targetName: string, existingData: Record<string, any> = {}, _stageId?: string): Promise<Record<string, any>> {
        const firstNode = expertRuleEngine.startSession(targetType, existingData, targetName);
        this.renderNode(firstNode);

        this.overlay.style.display = 'flex';

        return new Promise((resolve) => {
            this.resolvePromise = resolve;
        });
    }

    private renderNode(node: RuleNode) {
        this.contentContainer.innerHTML = '';

        // Question Bubble
        const question = document.createElement('div');
        question.textContent = `🤖 ${node.prompt}`;
        question.style.fontWeight = 'bold';
        question.style.marginBottom = '15px';
        this.contentContainer.appendChild(question);

        // Update Input Field based on type
        if (node.type === 'select') {
            // For later action phases
            const select = document.createElement('select');
            select.className = 'expert-input';
            select.style.width = '100%';
            select.style.padding = '8px';

            (node.options as any[]).forEach(opt => {
                const option = document.createElement('option');
                option.value = typeof opt === 'string' ? opt : opt.value;
                option.textContent = typeof opt === 'string' ? opt : opt.label;
                select.appendChild(option);
            });
            this.inputField.replaceWith(select);
            this.inputField = select;
        } else {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'expert-input';
            input.style.width = '100%';
            input.style.padding = '8px';

            // Pre-fill existing data if modifying
            const existingVal = expertRuleEngine.getSessionPayload()[node.propName];
            if (existingVal) input.value = existingVal;

            this.inputField.replaceWith(input);
            this.inputField = input;
        }

        setTimeout(() => this.inputField.focus(), 100);
    }

    private handleNext() {
        const val = this.inputField.value;
        if (!val.trim()) return; // Simple validation

        const nextNode = expertRuleEngine.submitAnswer(val);

        if (!nextNode) {
            // Session is complete!
            this.finishSession();
        } else {
            this.renderNode(nextNode);
        }
    }

    private finishSession() {
        const payload = expertRuleEngine.getSessionPayload();
        this.overlay.style.display = 'none';

        if (this.resolvePromise) {
            this.resolvePromise(payload);
            this.resolvePromise = null;
        }
    }
}
