import { GameProject, StageDefinition } from '../../model/types';
import { StageThumbnailService, stagePreviewScene } from '../services/StageThumbnailService';
import { stageOverviewFilters } from '../services/StageOverviewFilters';

interface OverviewHost { project: GameProject; switchStage(id: string): void }
const groupOf = (stage: StageDefinition) => (stage as StageDefinition & { group?: string }).group || 'Ohne Gruppe';

export class StageOverviewDialog {
    private project: GameProject | null = null;
    private thumbnails = new StageThumbnailService();
    private closeCurrent: (() => void) | null = null;

    show(host: OverviewHost): void {
        this.closeCurrent?.();
        if (host.project !== this.project) { this.thumbnails.dispose(); this.thumbnails = new StageThumbnailService(); this.project = host.project; }
        const stages = [...(host.project.stages || [])];
        const previous = document.activeElement as HTMLElement | null;
        const overlay = document.createElement('div'); overlay.id = 'stage-overview';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:20000;background:#080f17ed;padding:20px;display:flex;align-items:center;justify-content:center;';
        const dialog = document.createElement('section');
        dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'stage-overview-title');
        dialog.style.cssText = 'width:1400px;max-width:100%;height:92vh;display:flex;flex-direction:column;background:#101e2b;color:#e2e8f0;border:1px solid #365266;border-radius:14px;box-shadow:0 16px 60px #0008;font:14px Segoe UI,sans-serif;';
        const header = document.createElement('header'); header.style.cssText = 'padding:20px 24px 12px;display:flex;align-items:center;gap:16px;';
        const title = document.createElement('h2'); title.id = 'stage-overview-title'; title.textContent = 'Stages · Übersicht'; title.style.cssText = 'margin:0;flex:1;font-size:23px;';
        const closeButton = document.createElement('button'); closeButton.textContent = 'Schließen'; closeButton.style.cssText = 'padding:9px 16px;background:#243e50;color:#e2e8f0;border:1px solid #53788e;border-radius:7px;cursor:pointer;';
        header.append(title, closeButton);
        const toolbar = document.createElement('div'); toolbar.style.cssText = 'padding:8px 24px 16px;display:flex;gap:12px;flex-wrap:wrap;';
        const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Stage suchen …'; search.setAttribute('aria-label', 'Stage suchen');
        search.style.cssText = 'flex:1;min-width:180px;padding:10px 12px;background:#182e3e;color:#fff;border:1px solid #426176;border-radius:7px;';
        const groups = document.createElement('select'); groups.setAttribute('aria-label', 'Stage-Gruppe'); groups.style.cssText = 'padding:10px;background:#182e3e;color:#fff;border:1px solid #426176;border-radius:7px;';
        groups.add(new Option('Alle Gruppen', ''));
        for (const group of [...new Set(stages.map(groupOf))].sort((a, b) => a.localeCompare(b, 'de'))) groups.add(new Option(group, group));
        const count = document.createElement('span'); count.setAttribute('role', 'status'); count.style.cssText = 'align-self:center;color:#9db9c9;';
        toolbar.append(search, groups, count);
        groups.hidden = groups.options.length <= 2;
        const types = document.createElement('select'); types.setAttribute('aria-label', 'Stage-Typ'); types.style.cssText = groups.style.cssText;
        types.add(new Option('Alle Stage-Typen', ''));
        const typeLabels: Record<string, string> = { main: 'Hauptstage', standard: 'Standard', splash: 'Startbildschirm', template: 'Vorlage', blueprint: 'Blueprint', 'theme-editor': 'Theme', server: 'Server' };
        for (const type of [...new Set(stages.map(stage => stage.type))].sort()) types.add(new Option(typeLabels[type] || type, type));
        types.hidden = types.options.length <= 2;
        toolbar.insertBefore(types, count);
        const filters = stageOverviewFilters(host.project);
        const rolebar = document.createElement('div');
        rolebar.style.cssText = 'padding:0 24px 16px;display:flex;gap:8px;flex-wrap:wrap;';
        rolebar.hidden = !filters.length;
        if (!filters.length) rolebar.style.display = 'none';
        const selected = new Map<string, string>();
        const roleButtons: { filterId: string; optionId: string; button: HTMLButtonElement }[] = [];
        for (const filter of filters) {
            const row = document.createElement('div'); row.setAttribute('role', 'group'); row.setAttribute('aria-label', filter.label);
            row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;';
            const label = document.createElement('span'); label.textContent = `${filter.label}:`; row.append(label);
            for (const option of [{ id: '', label: `Alle ${filter.label}` }, ...filter.options]) {
                const button = document.createElement('button'); button.type = 'button';
                button.textContent = option.label; button.dataset.audience = option.id;
                button.onclick = () => { selected.set(filter.id, option.id); render(); };
                roleButtons.push({ filterId: filter.id, optionId: option.id, button }); row.append(button);
            }
            rolebar.append(row);
        }
        const scroll = document.createElement('div'); scroll.style.cssText = 'overflow:auto;flex:1;min-height:0;padding:0 24px 24px;';
        const grid = document.createElement('div'); grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr));gap:18px;';
        scroll.append(grid);
        const note = document.createElement('div'); note.textContent = 'Entwurfsansichten ohne Live-Daten · Klick öffnet die Stage · Escape schließt die Übersicht'; note.style.cssText = 'padding:12px 24px;color:#9db9c9;border-top:1px solid #294354;font-size:12px;';
        dialog.append(header, toolbar, rolebar, scroll, note); overlay.append(dialog); document.body.append(overlay);
        let closed = false, version = 0, working = false, pendingTimer: ReturnType<typeof setTimeout> | null = null;
        const queued = new Map<HTMLButtonElement, StageDefinition>();
        const pump = async () => {
            if (working || closed || !queued.size) return;
            working = true;
            const [card, stage] = queued.entries().next().value!; queued.delete(card);
            const currentVersion = version;
            try {
                const url = await this.thumbnails.thumbnail(stage.id, stagePreviewScene(host.project, stage));
                if (!closed && currentVersion === version && card.isConnected) {
                    const image = card.querySelector('img')!; image.src = url; image.style.opacity = '1';
                    card.dataset.previewReady = 'true';
                    observer.unobserve(card);
                }
            } catch { if (!closed && card.isConnected) card.querySelector('[data-preview-placeholder]')!.textContent = 'Vorschau nicht verfügbar'; }
            finally { working = false; if (!closed) pendingTimer = setTimeout(() => { void pump(); }, 0); }
        };
        const observer = new IntersectionObserver(entries => {
            for (const entry of entries) {
                const card = entry.target as HTMLButtonElement;
                if (entry.isIntersecting && !card.dataset.previewReady) {
                    const stage = stages.find(s => s.id === card.dataset.stageId);
                    if (stage) queued.set(card, stage);
                } else if (!entry.isIntersecting) queued.delete(card);
            }
            void pump();
        }, { root: scroll, rootMargin: '100px' });
        const close = () => {
            if (closed) return; closed = true; observer.disconnect(); queued.clear();
            if (pendingTimer !== null) clearTimeout(pendingTimer);
            window.removeEventListener('keydown', onKey, true); overlay.remove(); this.closeCurrent = null;
            if (previous?.isConnected) previous.focus();
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
            if (event.key === 'Tab') {
                const focusable = [...dialog.querySelectorAll<HTMLElement>('button,input,select')];
                const first = focusable[0], last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
        };
        const render = () => {
            version++; observer.disconnect(); queued.clear(); grid.replaceChildren(); scroll.scrollTop = 0;
            const query = search.value.trim().toLocaleLowerCase('de');
            for (const { filterId, optionId, button } of roleButtons) {
                const active = optionId === (selected.get(filterId) || ''); button.setAttribute('aria-pressed', String(active));
                button.style.cssText = `padding:8px 12px;border:1px solid ${active ? '#2dd4bf' : '#426176'};border-radius:18px;background:${active ? '#12584f' : '#182e3e'};color:${active ? '#c7fff5' : '#bdd0dc'};cursor:pointer;font:inherit;`;
            }
            const matches = stages.filter(s => filters.every(filter => !selected.get(filter.id) || s.overviewTags?.[filter.id]?.includes(selected.get(filter.id)!)) && (!types.value || s.type === types.value) && (!groups.value || groupOf(s) === groups.value) && `${s.name} ${s.id} ${groupOf(s)}`.toLocaleLowerCase('de').includes(query));
            count.textContent = `${matches.length} / ${stages.length} Stages`;
            if (!matches.length) { const empty = document.createElement('p'); empty.textContent = 'Keine Stage gefunden.'; grid.append(empty); }
            for (const stage of matches) {
                const card = document.createElement('button'); card.type = 'button'; card.dataset.stageId = stage.id;
                const active = stage.id === host.project.activeStageId;
                card.setAttribute('aria-label', `${stage.name}${active ? ' · aktuelle Stage' : ''}`);
                if (active) card.setAttribute('aria-current', 'page');
                card.style.cssText = `padding:0;text-align:left;background:#193040;color:#e2e8f0;border:2px solid ${active ? '#2dd4bf' : '#304e63'};border-radius:10px;overflow:hidden;cursor:pointer;`;
                const preview = document.createElement('div'); preview.style.cssText = 'position:relative;aspect-ratio:1.6;background:#122333;';
                const placeholder = document.createElement('span'); placeholder.dataset.previewPlaceholder = ''; placeholder.textContent = 'Vorschau wird geladen …'; placeholder.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;color:#7898ad;font-size:12px;';
                const image = document.createElement('img'); image.alt = `Entwurf: ${stage.name}`; image.width = 360; image.height = 225; image.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:0;';
                preview.append(placeholder, image);
                const description = document.createElement('div'); description.style.cssText = 'padding:12px 14px;';
                const name = document.createElement('strong'); name.textContent = stage.name; name.style.cssText = 'display:block;font-size:15px;overflow-wrap:anywhere;';
                const labels = filters.flatMap(filter => filter.options.filter(option => stage.overviewTags?.[filter.id]?.includes(option.id)).map(option => option.label));
                const group = document.createElement('span'); group.textContent = [...labels, ...(groups.hidden ? [] : [groupOf(stage)]), typeLabels[stage.type] || stage.type, ...(active ? ['Aktuell'] : [])].join(' · '); group.style.cssText = 'display:block;margin-top:6px;color:#9db9c9;font-size:12px;';
                description.append(name, group); card.append(preview, description);
                card.onclick = () => { close(); host.switchStage(stage.id); };
                grid.append(card); observer.observe(card);
            }
        };
        const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = 'Filter zurücksetzen'; reset.style.cssText = closeButton.style.cssText;
        reset.onclick = () => { search.value = ''; groups.value = ''; types.value = ''; selected.clear(); render(); search.focus(); };
        toolbar.append(reset);
        search.oninput = render; groups.onchange = render; types.onchange = render; closeButton.onclick = close;
        overlay.onclick = event => { if (event.target === overlay) close(); };
        window.addEventListener('keydown', onKey, true); this.closeCurrent = close; render(); search.focus();
    }
}
