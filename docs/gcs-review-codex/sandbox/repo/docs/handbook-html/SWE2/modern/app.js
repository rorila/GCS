/**
 * GCS Autoren-Handbuch — Modern Edition (app.js)
 * Steuerung für Navigation, Volltextsuche, Lernfortschritt (localStorage),
 * Hell-/Dunkelmodus und Tastaturbedienung.
 */
(function () {
    'use strict';

    const STORAGE_DONE = 'gcs-handbook-done-v1';
    const STORAGE_THEME = 'gcs-handbook-theme-v1';

    const hb = window.HANDBOOK;
    if (!hb || !Array.isArray(hb.chapters)) {
        console.error('HANDBOOK-Daten nicht gefunden.');
        return;
    }

    const chapters = hb.chapters;
    const byId = new Map(chapters.map((c, idx) => [c.id, { ...c, idx }]));

    const els = {
        menuToggle: document.getElementById('menuToggle'),
        searchInput: document.getElementById('searchInput'),
        searchResults: document.getElementById('searchResults'),
        themeToggle: document.getElementById('themeToggle'),
        sidebar: document.getElementById('sidebar'),
        sidebarOverlay: document.getElementById('sidebarOverlay'),
        progressText: document.getElementById('progressText'),
        progressBar: document.getElementById('progressBar'),
        progressReset: document.getElementById('progressReset'),
        chapterNav: document.getElementById('chapterNav'),
        home: document.getElementById('home'),
        homeCards: document.getElementById('homeCards'),
        chapterView: document.getElementById('chapterView'),
        chapterBadge: document.getElementById('chapterBadge'),
        chapterTitle: document.getElementById('chapterTitle'),
        chapterGoal: document.getElementById('chapterGoal'),
        chapterBody: document.getElementById('chapterBody'),
        prevBtn: document.getElementById('prevBtn'),
        nextBtn: document.getElementById('nextBtn'),
        doneCheck: document.getElementById('doneCheck')
    };

    let doneSet = new Set();
    let currentId = null;

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_DONE);
            if (raw) JSON.parse(raw).forEach(id => doneSet.add(id));
        } catch (_) {}
        try {
            const savedTheme = localStorage.getItem(STORAGE_THEME);
            if (savedTheme === 'dark' || savedTheme === 'light') {
                setTheme(savedTheme);
            }
        } catch (_) {}
    }

    function saveDone() {
        try {
            localStorage.setItem(STORAGE_DONE, JSON.stringify([...doneSet]));
        } catch (_) {}
    }

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        if (els.themeToggle) {
            els.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
        try {
            localStorage.setItem(STORAGE_THEME, theme);
        } catch (_) {}
    }

    function updateProgress() {
        const count = doneSet.size;
        const total = chapters.length;
        if (els.progressText) els.progressText.textContent = `${count} / ${total}`;
        if (els.progressBar) els.progressBar.style.width = `${Math.round((count / total) * 100)}%`;
    }

    function renderNav() {
        if (!els.chapterNav) return;
        const parts = [
            { key: 'A', label: '🌱 Teil A · Einsteiger (1–15)' },
            { key: 'B', label: '🌳 Teil B · Fortgeschritten (B1–B8)' }
        ];
        const html = [];
        html.push(`<a href="#" class="nav-item ${!currentId ? 'active' : ''}" data-nav="home"><span class="num">⌂</span><span>Kursübersicht</span></a>`);
        for (const p of parts) {
            html.push(`<div class="nav-part">${p.label}</div>`);
            for (const c of chapters.filter(ch => ch.part === p.key)) {
                const isDone = doneSet.has(c.id);
                const isActive = currentId === c.id;
                html.push(
                    `<a href="#${c.id}" class="nav-item ${isActive ? 'active' : ''}" data-id="${c.id}">` +
                    `<span class="num">${c.num}</span>` +
                    `<span>${c.title}</span>` +
                    `<span class="done">${isDone ? '✔' : ''}</span>` +
                    `</a>`
                );
            }
        }
        els.chapterNav.innerHTML = html.join('');
    }

    function renderHome() {
        if (!els.homeCards) return;
        const parts = [
            { key: 'A', label: '🌱 Teil A — „Mein erster interaktiver Baum“ (Kapitel 1–15)' },
            { key: 'B', label: '🌳 Teil B — „Der wachsende Baum“ (Kapitel B1–B8)' }
        ];
        const html = [];
        for (const p of parts) {
            html.push(`<div class="part-heading">${p.label}</div>`);
            for (const c of chapters.filter(ch => ch.part === p.key)) {
                const isDone = doneSet.has(c.id);
                html.push(
                    `<a href="#${c.id}" class="chapter-card" data-id="${c.id}">` +
                    `<span class="card-num">KAPITEL ${c.num}</span>` +
                    `<h3>${c.title}</h3>` +
                    `<p>${c.lernziel}</p>` +
                    (isDone ? `<span class="card-done">✔ Gelesen</span>` : '') +
                    `</a>`
                );
            }
        }
        els.homeCards.innerHTML = html.join('');
    }

    function closeMobileSidebar() {
        els.sidebar?.classList.remove('open');
        if (els.sidebarOverlay) els.sidebarOverlay.hidden = true;
    }

    function showHome() {
        currentId = null;
        if (els.home) els.home.hidden = false;
        if (els.chapterView) els.chapterView.hidden = true;
        renderNav();
        renderHome();
        updateProgress();
        closeMobileSidebar();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function showChapter(id) {
        const entry = byId.get(id);
        if (!entry) {
            showHome();
            return;
        }
        currentId = entry.id;
        if (els.home) els.home.hidden = true;
        if (els.chapterView) els.chapterView.hidden = false;

        if (els.chapterBadge) {
            els.chapterBadge.textContent = entry.part === 'A'
                ? `Teil A · Kapitel ${entry.num}`
                : `Teil B · Kapitel ${entry.num}`;
        }
        if (els.chapterTitle) els.chapterTitle.textContent = entry.fullTitle || entry.title;
        if (els.chapterGoal) els.chapterGoal.textContent = `Lernziel: ${entry.lernziel}`;
        if (els.chapterBody) els.chapterBody.innerHTML = entry.html;
        if (els.doneCheck) els.doneCheck.checked = doneSet.has(entry.id);

        if (els.prevBtn) {
            els.prevBtn.disabled = entry.idx === 0;
            els.prevBtn.onclick = () => {
                if (entry.idx > 0) location.hash = '#' + chapters[entry.idx - 1].id;
            };
        }
        if (els.nextBtn) {
            const hasNext = entry.idx < chapters.length - 1;
            els.nextBtn.textContent = hasNext ? 'Weiter ▶' : '⌂ Zur Übersicht';
            els.nextBtn.onclick = () => {
                if (hasNext) location.hash = '#' + chapters[entry.idx + 1].id;
                else location.hash = '#';
            };
        }

        renderNav();
        updateProgress();
        closeMobileSidebar();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function route() {
        const hash = (location.hash || '').replace(/^#/, '').trim();
        if (!hash || !byId.has(hash)) showHome();
        else showChapter(hash);
    }

    function makeSnippet(text, term) {
        const idx = text.toLowerCase().indexOf(term);
        if (idx < 0) return text.slice(0, 110) + '…';
        const start = Math.max(0, idx - 35);
        const end = Math.min(text.length, idx + term.length + 65);
        return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
    }

    function runSearch(q) {
        const query = (q || '').trim().toLowerCase();
        if (!query) {
            if (els.searchResults) els.searchResults.hidden = true;
            return;
        }
        const hits = chapters.filter(c =>
            `${c.num} ${c.title} ${c.fullTitle} ${c.lernziel} ${c.text}`.toLowerCase().includes(query)
        );
        if (!els.searchResults) return;
        if (hits.length === 0) {
            els.searchResults.innerHTML = `<div class="search-empty">Keine Treffer für „${q}“</div>`;
        } else {
            els.searchResults.innerHTML = hits.map(c =>
                `<button type="button" class="search-hit" data-target="${c.id}">` +
                `<span class="hit-num">${c.num}</span><strong>${c.title}</strong>` +
                `<span class="hit-snippet">${makeSnippet(c.text, query)}</span>` +
                `</button>`
            ).join('');
            els.searchResults.querySelectorAll('.search-hit').forEach(btn => {
                btn.addEventListener('click', () => {
                    const target = btn.getAttribute('data-target');
                    els.searchResults.hidden = true;
                    els.searchInput.value = '';
                    location.hash = '#' + target;
                });
            });
        }
        els.searchResults.hidden = false;
    }

    // Events
    window.addEventListener('hashchange', route);

    els.themeToggle?.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') || 'light';
        setTheme(cur === 'dark' ? 'light' : 'dark');
    });

    els.menuToggle?.addEventListener('click', () => {
        const open = els.sidebar?.classList.toggle('open');
        if (els.sidebarOverlay) els.sidebarOverlay.hidden = !open;
    });

    els.sidebarOverlay?.addEventListener('click', closeMobileSidebar);

    els.doneCheck?.addEventListener('change', () => {
        if (!currentId) return;
        if (els.doneCheck.checked) doneSet.add(currentId);
        else doneSet.delete(currentId);
        saveDone();
        updateProgress();
        renderNav();
        renderHome();
    });

    els.progressReset?.addEventListener('click', () => {
        doneSet.clear();
        saveDone();
        if (els.doneCheck) els.doneCheck.checked = false;
        updateProgress();
        renderNav();
        renderHome();
    });

    els.searchInput?.addEventListener('input', () => runSearch(els.searchInput.value));
    els.searchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            els.searchResults.hidden = true;
            els.searchInput.blur();
        } else if (e.key === 'Enter') {
            const first = els.searchResults?.querySelector('.search-hit');
            if (first) first.click();
        }
    });

    document.addEventListener('click', (e) => {
        if (els.searchResults && !els.searchResults.hidden) {
            if (!e.target.closest('.topbar-search')) {
                els.searchResults.hidden = true;
            }
        }
    });

    window.addEventListener('keydown', (e) => {
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea') return;
        if (e.key === 'ArrowRight' && currentId) {
            const cur = byId.get(currentId);
            if (cur && cur.idx < chapters.length - 1) {
                location.hash = '#' + chapters[cur.idx + 1].id;
            }
        } else if (e.key === 'ArrowLeft' && currentId) {
            const cur = byId.get(currentId);
            if (cur && cur.idx > 0) {
                location.hash = '#' + chapters[cur.idx - 1].id;
            }
        }
    });

    loadState();
    route();
})();
