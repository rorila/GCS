import { GameProject } from '../../model/types';
import { findFeatureById } from '../../model/FeatureHierarchy';
import { buildStorySequenceDiagram } from '../../model/FeatureSequenceDiagram';
import { Logger } from '../../utils/Logger';

const logger = Logger.get('FlowEditor', 'SequenceDiagramDialog');

export interface SequenceDiagramHost {
    project: GameProject | null;
    switchActionFlow(context: string): void;
}

let mermaidLoader: Promise<any> | null = null;
const loadMermaid = (): Promise<any> => {
    if (!mermaidLoader) {
        mermaidLoader = import('mermaid').then(m => {
            m.default.initialize({
                startOnLoad: false,
                theme: 'base',
                themeVariables: {
                    background: '#141820',
                    fontFamily: 'sans-serif',
                    actorBkg: '#2d2d30',
                    actorBorder: '#666666',
                    actorTextColor: '#e8e8e8',
                    // Lebenslinien: dunkel-grau, heben sich von den Pfeilen ab
                    actorLineColor: '#3a3f4d',
                    // Pfeile + Beschriftung: warm-hell auf dunkel
                    signalColor: '#ffb74d',
                    signalTextColor: '#f0e6d2',
                    labelBoxBkgColor: '#2d2d30',
                    labelBoxBorderColor: '#666666',
                    labelTextColor: '#d4d4d4',
                    loopTextColor: '#9cdcfe',
                    noteBkgColor: '#3a3d41',
                    noteBorderColor: '#5a5a5a',
                    noteTextColor: '#d4d4d4',
                    activationBkgColor: '#37373d',
                    activationBorderColor: '#666666'
                }
            });
            return m.default;
        });
    }
    return mermaidLoader;
};

/** Rollenfarben passend zur Feature-Übersicht (Event türkis, Task grün, …). */
const ROLE_COLORS: Record<string, { fill: string; stroke: string }> = {
    actor:     { fill: '#3b2d5c', stroke: '#9d7bd8' },
    component: { fill: '#12424a', stroke: '#26c6da' },
    task:      { fill: '#2d6a4f', stroke: '#74c69d' },
    server:    { fill: '#0d3b66', stroke: '#4cc9f0' },
    nav:       { fill: '#37474f', stroke: '#90a4ae' }
};

/** Färbt die Lebenslinien-Boxen im gerenderten SVG nach Rolle ein. */
function colorizeParticipants(svgRoot: HTMLElement, participants: { label: string; role: string }[]): void {
    const texts = svgRoot.querySelectorAll('text');
    participants.forEach(p => {
        const colors = ROLE_COLORS[p.role];
        if (!colors) return;
        texts.forEach(t => {
            if ((t.textContent || '').trim() !== p.label) return;
            const g = t.closest('g');
            const box = g?.querySelector('rect');
            if (box) {
                box.setAttribute('fill', colors.fill);
                box.setAttribute('stroke', colors.stroke);
                box.setAttribute('stroke-width', '1.5');
            } else {
                // Actor = Strichmännchen (circle/line statt rect)
                g?.querySelectorAll('circle,line').forEach(el => {
                    el.setAttribute('stroke', colors.stroke);
                });
            }
            (t as SVGTextElement).style.fill = colors.stroke;
            (t as SVGTextElement).style.fontWeight = '600';
        });
    });
}

let renderCounter = 0;

/** Stories des Feature-Teilbaums (Wurzel + Unterfeatures), in Listenreihenfolge. */
function collectFeatureStories(project: any, featureId: string): any[] {
    const found = findFeatureById(project, featureId);
    if (!found) return [];
    const subtree: any[] = [];
    const walk = (f: any) => {
        subtree.push(f);
        (found.stage.features || [])
            .filter((c: any) => c.parentId === f.id)
            .forEach(walk);
    };
    walk(found.feature);
    const ids = new Set(subtree.map(f => f.id));
    const linked = new Set(subtree.flatMap(f => f.userStoryIds || []));
    return (project.userStories?.userStories || [])
        .filter((us: any) => (us.featureId && ids.has(us.featureId)) || linked.has(us.id));
}

/**
 * On-Demand-Sequenzdiagramm für eine Story im Feature-Kontext.
 * Modal: Story-Dropdown, gerendertes SVG (mermaid), Quelltext,
 * Kopieren / .md-Export. Klick auf eine Task-Lebenslinie öffnet
 * deren Task-Flow.
 */
export async function openSequenceDiagramDialog(
    host: SequenceDiagramHost,
    featureId: string,
    initialStoryId?: string
): Promise<void> {
    const project = host.project;
    if (!project) return;

    const stories = collectFeatureStories(project, featureId);
    if (stories.length === 0) {
        logger.warn('Keine Stories im Feature-Kontext gefunden', { featureId });
        alert('Keine User Stories in diesem Feature — nichts darzustellen.');
        return;
    }

    // ── Overlay + Panel ──────────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.style.cssText =
        'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;' +
        'display:flex;align-items:center;justify-content:center;';

    const panel = document.createElement('div');
    panel.style.cssText =
        'width:min(1100px,92vw);height:85vh;background:#1e1e1e;border:1px solid #444;' +
        'border-radius:8px;display:flex;flex-direction:column;overflow:hidden;';
    overlay.appendChild(panel);

    const header = document.createElement('div');
    header.style.cssText =
        'display:flex;align-items:center;gap:10px;padding:10px 14px;' +
        'border-bottom:1px solid #444;background:#252526;';

    const title = document.createElement('span');
    title.textContent = '📈 Sequenzdiagramm';
    title.style.cssText = 'color:#ddd;font:600 13px sans-serif;';
    header.appendChild(title);

    const storySelect = document.createElement('select');
    storySelect.style.cssText =
        'flex:1;padding:5px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;';
    stories.forEach(us => {
        const opt = document.createElement('option');
        opt.value = us.id;
        opt.textContent = us.title || us.id;
        storySelect.appendChild(opt);
    });
    storySelect.value = initialStoryId && stories.some(s => s.id === initialStoryId)
        ? initialStoryId
        : stories[0].id;
    header.appendChild(storySelect);

    const mkBtn = (label: string, titleText: string) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.title = titleText;
        b.style.cssText =
            'padding:5px 10px;background:#444;color:#fff;border:1px solid #666;' +
            'border-radius:4px;cursor:pointer;font-size:12px;';
        return b;
    };

    const copyBtn = mkBtn('📋 Kopieren', 'Mermaid-Quelltext in die Zwischenablage');
    const mdBtn = mkBtn('💾 .md', 'Als Markdown-Datei speichern');
    const closeBtn = mkBtn('✕', 'Schließen');
    header.appendChild(copyBtn);
    header.appendChild(mdBtn);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    const body = document.createElement('div');
    body.style.cssText = 'flex:1;overflow:auto;padding:16px;display:flex;justify-content:center;align-items:flex-start;';
    panel.appendChild(body);

    const details = document.createElement('details');
    details.style.cssText = 'border-top:1px solid #444;max-height:180px;overflow:auto;';
    const summary = document.createElement('summary');
    summary.textContent = 'Mermaid-Quelltext';
    summary.style.cssText = 'padding:6px 14px;color:#888;cursor:pointer;font-size:12px;';
    const pre = document.createElement('pre');
    pre.style.cssText = 'margin:0;padding:10px 14px;color:#9cdcfe;font-size:11px;white-space:pre-wrap;';
    details.appendChild(summary);
    details.appendChild(pre);
    panel.appendChild(details);

    document.body.appendChild(overlay);

    const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    closeBtn.onclick = close;
    overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(); });

    // ── Render ───────────────────────────────────────────────────────
    let currentCode = '';
    let currentStory: any = null;

    const render = async () => {
        const story = stories.find(s => s.id === storySelect.value);
        if (!story) return;
        currentStory = story;
        const { code, taskNames, participants } = buildStorySequenceDiagram(project, story);
        currentCode = code;
        pre.textContent = code;
        body.innerHTML = '<div style="color:#666;padding:20px">rendere …</div>';

        try {
            const mermaid = await loadMermaid();
            const { svg } = await mermaid.render(`seqd_${++renderCounter}`, code);
            // Klick kann sich geändert haben (Story-Wechsel während Render)
            if (storySelect.value !== story.id) return;
            body.innerHTML = svg;
            colorizeParticipants(body, participants);

            // Klick auf Task-Lebenslinie / Task-Text → Task-Flow öffnen
            const taskSet = new Set(taskNames);
            body.querySelectorAll('text').forEach(t => {
                const txt = (t.textContent || '').trim();
                const name = txt.startsWith('Task: ') ? txt.slice(6) : txt;
                if (taskSet.has(name)) {
                    (t as SVGTextElement).style.cursor = 'pointer';
                    (t as SVGTextElement).style.textDecoration = 'underline';
                    t.addEventListener('click', ev => {
                        ev.stopPropagation();
                        close();
                        host.switchActionFlow(name);
                    });
                }
            });
        } catch (err) {
            logger.warn('Mermaid-Render fehlgeschlagen', err);
            body.innerHTML =
                '<pre style="color:#f48771;padding:20px;white-space:pre-wrap">Render-Fehler:\n' +
                String(err) + '</pre>';
        }
    };

    storySelect.onchange = render;

    copyBtn.onclick = () => {
        navigator.clipboard?.writeText(currentCode).catch(() => {});
    };
    mdBtn.onclick = () => {
        const safe = (currentStory?.title || 'sequenz').replace(/[^\w-]+/g, '_');
        const blob = new Blob(['```mermaid\n' + currentCode + '\n```\n'], { type: 'text/markdown' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `sequenz-${safe}.md`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    await render();
}
