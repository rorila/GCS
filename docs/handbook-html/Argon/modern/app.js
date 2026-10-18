/**
 * GCS Autoren-Handbuch — Modern Web Edition (Version 1)
 * Vollständige Client-Logik: Routing, Volltextsuche, Lernfortschritt (LocalStorage),
 * interaktive Checklisten, deutsche Sprecher-Drehbücher, Hell-/Dunkelmodus, Tastatur-Shortcuts.
 */
(function () {
  'use strict';

  const STORAGE_KEYS = {
    DONE_CHAPTERS: 'gcs_hb_v1_done_chapters',
    CHECKLISTS: 'gcs_hb_v1_checklists',
    THEME: 'gcs_hb_v1_theme',
    SPEAKER: 'gcs_hb_v1_speaker',
    LAST_CHAPTER: 'gcs_hb_v1_last_chapter'
  };

  const data = window.GCS_HANDBOOK_DATA;
  if (!data || !Array.isArray(data.chapters)) {
    console.error('[GCS Handbuch] Fehler: window.GCS_HANDBOOK_DATA wurde nicht geladen.');
    return;
  }

  const chapters = data.chapters;
  const chapterMap = new Map(chapters.map(c => [c.id, c]));

  // Application State
  const state = {
    activeView: 'overview', // 'overview' | chapterId
    sidebarFilter: 'all',   // 'all' | 'A' | 'B'
    overviewFilter: 'all',  // 'all' | 'A' | 'B' | 'open'
    showSpeaker: false,
    theme: 'light',
    doneChapters: new Set(),
    checkStates: {} // { [chapterId]: { [idx]: boolean } }
  };

  // Load persisted state from localStorage
  function loadState() {
    try {
      const savedDone = localStorage.getItem(STORAGE_KEYS.DONE_CHAPTERS);
      if (savedDone) {
        JSON.parse(savedDone).forEach(id => state.doneChapters.add(id));
      }
      const savedChecks = localStorage.getItem(STORAGE_KEYS.CHECKLISTS);
      if (savedChecks) {
        state.checkStates = JSON.parse(savedChecks) || {};
      }
      const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
      if (savedTheme === 'dark' || savedTheme === 'light') {
        state.theme = savedTheme;
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        state.theme = 'dark';
      }
      const savedSpeaker = localStorage.getItem(STORAGE_KEYS.SPEAKER);
      if (savedSpeaker === 'true') {
        state.showSpeaker = true;
      }
    } catch (e) {
      // Fallback if localStorage is restricted
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEYS.DONE_CHAPTERS, JSON.stringify(Array.from(state.doneChapters)));
      localStorage.setItem(STORAGE_KEYS.CHECKLISTS, JSON.stringify(state.checkStates));
    } catch (e) {}
  }

  // DOM Elements
  const els = {
    layout: document.getElementById('hb-layout'),
    sidebar: document.getElementById('hb-sidebar'),
    sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
    navOverviewLink: document.getElementById('nav-overview-link'),
    chapterNavList: document.getElementById('chapter-nav-list'),
    resetProgressBtn: document.getElementById('reset-progress-btn'),

    headerProgressText: document.getElementById('header-progress-text'),
    headerProgressFill: document.getElementById('header-progress-fill'),
    headerProgressBar: document.getElementById('header-progressbar'),

    toggleSpeakerBtn: document.getElementById('toggle-speaker-btn'),
    toggleThemeBtn: document.getElementById('toggle-theme-btn'),
    themeIcon: document.getElementById('theme-icon'),

    viewOverview: document.getElementById('view-overview'),
    viewChapter: document.getElementById('view-chapter'),
    tocSidebar: document.getElementById('hb-toc-sidebar'),
    chapterTocList: document.getElementById('chapter-toc-list'),

    heroContinueBtn: document.getElementById('hero-continue-btn'),
    heroSearchBtn: document.getElementById('hero-search-btn'),
    overviewPercentBadge: document.getElementById('overview-percent-badge'),
    statTotalDone: document.getElementById('stat-total-done'),
    statPartADone: document.getElementById('stat-part-a-done'),
    statPartBDone: document.getElementById('stat-part-b-done'),
    statChecksDone: document.getElementById('stat-checks-done'),
    overviewChaptersContainer: document.getElementById('overview-chapters-container'),

    chapterBreadcrumbs: document.getElementById('chapter-breadcrumbs'),
    chapterTitle: document.getElementById('chapter-title'),
    chapterStatusNote: document.getElementById('chapter-status-note'),
    chapterComponents: document.getElementById('chapter-components'),

    speakerScriptPanel: document.getElementById('speaker-script-panel'),
    speakerVideoTitle: document.getElementById('speaker-video-title'),
    speakerScriptText: document.getElementById('speaker-script-text'),
    speakerSyncNotes: document.getElementById('speaker-sync-notes'),
    closeSpeakerPanelBtn: document.getElementById('close-speaker-panel-btn'),

    chapterContentBody: document.getElementById('chapter-content-body'),
    toggleChapterDoneBtn: document.getElementById('toggle-chapter-done-btn'),
    doneBtnIcon: document.getElementById('done-btn-icon'),
    doneBtnLabel: document.getElementById('done-btn-label'),
    prevChapterLink: document.getElementById('prev-chapter-link'),
    prevChapterTitle: document.getElementById('prev-chapter-title'),
    nextChapterLink: document.getElementById('next-chapter-link'),
    nextChapterTitle: document.getElementById('next-chapter-title'),

    openSearchBtn: document.getElementById('open-search-btn'),
    searchModal: document.getElementById('search-modal'),
    searchModalInput: document.getElementById('search-modal-input'),
    closeSearchBtn: document.getElementById('close-search-btn'),
    searchResultsCount: document.getElementById('search-results-count'),
    searchResultsList: document.getElementById('search-results-list')
  };

  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    if (els.themeIcon) {
      els.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch (e) {}
  }

  function applySpeakerMode(show) {
    state.showSpeaker = show;
    if (els.toggleSpeakerBtn) {
      els.toggleSpeakerBtn.setAttribute('aria-pressed', show ? 'true' : 'false');
    }
    if (els.speakerScriptPanel) {
      els.speakerScriptPanel.hidden = !show || state.activeView === 'overview';
    }
    try {
      localStorage.setItem(STORAGE_KEYS.SPEAKER, show ? 'true' : 'false');
    } catch (e) {}
  }

  function updateProgressUI() {
    const total = chapters.length;
    const doneCount = state.doneChapters.size;
    const pct = Math.round((doneCount / total) * 100);

    if (els.headerProgressText) els.headerProgressText.textContent = `${doneCount} / ${total}`;
    if (els.headerProgressFill) els.headerProgressFill.style.width = `${pct}%`;
    if (els.headerProgressBar) els.headerProgressBar.setAttribute('aria-valuenow', String(doneCount));

    const partADone = chapters.filter(c => c.part === 'A' && state.doneChapters.has(c.id)).length;
    const partBDone = chapters.filter(c => c.part === 'B' && state.doneChapters.has(c.id)).length;

    let totalChecked = 0;
    Object.values(state.checkStates).forEach(chMap => {
      Object.values(chMap || {}).forEach(val => {
        if (val) totalChecked++;
      });
    });

    if (els.overviewPercentBadge) els.overviewPercentBadge.textContent = `${pct}%`;
    if (els.statTotalDone) els.statTotalDone.textContent = `${doneCount} / ${total}`;
    if (els.statPartADone) els.statPartADone.textContent = `${partADone} / 15`;
    if (els.statPartBDone) els.statPartBDone.textContent = `${partBDone} / 8`;
    if (els.statChecksDone) els.statChecksDone.textContent = String(totalChecked);

    // Update Hero Continue Button
    const nextOpen = chapters.find(c => !state.doneChapters.has(c.id)) || chapters[0];
    if (els.heroContinueBtn) {
      els.heroContinueBtn.href = `#${nextOpen.id}`;
      els.heroContinueBtn.textContent = doneCount === 0
        ? `▶ Mit Kapitel 1 starten (${nextOpen.shortTitle})`
        : (doneCount === total ? `🎉 Alle Kapitel abgeschlossen — Kapitel 1 öffnen` : `▶ Weiterlernen: ${nextOpen.num} — ${nextOpen.shortTitle}`);
    }
  }

  function renderSidebar() {
    if (!els.chapterNavList) return;
    const filtered = chapters.filter(c => state.sidebarFilter === 'all' || c.part === state.sidebarFilter);

    const groups = new Map();
    for (const ch of filtered) {
      if (!groups.has(ch.group)) groups.set(ch.group, []);
      groups.get(ch.group).push(ch);
    }

    const html = [];
    for (const [groupName, groupChapters] of groups.entries()) {
      html.push(`<div class="hb-nav-group-title">${groupName}</div>`);
      for (const ch of groupChapters) {
        const isDone = state.doneChapters.has(ch.id);
        const isActive = state.activeView === ch.id;
        html.push(`
          <a href="#${ch.id}" class="hb-nav-item part-${ch.part} ${isActive ? 'active' : ''}" data-chapter-id="${ch.id}">
            <span class="hb-nav-num">${ch.num}</span>
            <span class="hb-nav-title-text">${ch.shortTitle}</span>
            <span class="hb-nav-status" aria-label="${isDone ? 'Abgeschlossen' : 'Offen'}">${isDone ? '✅' : ''}</span>
          </a>
        `);
      }
    }
    els.chapterNavList.innerHTML = html.join('');
    if (els.navOverviewLink) {
      els.navOverviewLink.classList.toggle('active', state.activeView === 'overview');
    }
  }

  function renderOverviewGrid() {
    if (!els.overviewChaptersContainer) return;

    const filtered = chapters.filter(ch => {
      if (state.overviewFilter === 'A') return ch.part === 'A';
      if (state.overviewFilter === 'B') return ch.part === 'B';
      if (state.overviewFilter === 'open') return !state.doneChapters.has(ch.id);
      return true;
    });

    if (filtered.length === 0) {
      els.overviewChaptersContainer.innerHTML = `<div class="hb-callout hb-callout-goal"><div class="hb-callout-icon">🎉</div><div class="hb-callout-body"><strong>Herzlichen Glückwunsch!</strong> Du hast alle Kapitel in dieser Ansicht abgeschlossen.</div></div>`;
      return;
    }

    const groups = new Map();
    for (const ch of filtered) {
      if (!groups.has(ch.group)) groups.set(ch.group, []);
      groups.get(ch.group).push(ch);
    }

    const html = [];
    for (const [groupName, groupChapters] of groups.entries()) {
      const cardsHtml = groupChapters.map(ch => {
        const isDone = state.doneChapters.has(ch.id);
        const checkMap = state.checkStates[ch.id] || {};
        const doneChecks = Object.values(checkMap).filter(Boolean).length;
        const totalChecks = ch.checklists.length;

        return `
          <a href="#${ch.id}" class="hb-chapter-card part-${ch.part} ${isDone ? 'is-done' : ''}">
            <div>
              <div class="hb-card-top">
                <span class="hb-card-badge">Kapitel ${ch.num}</span>
                <span>${isDone ? '✅ Erledigt' : '📖 Offen'}</span>
              </div>
              <h3 class="hb-card-title">${ch.shortTitle}</h3>
              <p class="hb-card-goal">${ch.learningGoal}</p>
            </div>
            <div class="hb-card-footer">
              <span>☑️ ${doneChecks}/${totalChecks} Prüfpunkte</span>
              <span>📸 ${ch.screenshots.length} Medien-Slots</span>
            </div>
          </a>
        `;
      }).join('');

      html.push(`
        <div class="hb-group-section">
          <h3 class="hb-group-heading">${groupName}</h3>
          <div class="hb-cards-grid">${cardsHtml}</div>
        </div>
      `);
    }

    els.overviewChaptersContainer.innerHTML = html.join('');
  }

  function renderChapterView(chapterId) {
    const ch = chapterMap.get(chapterId);
    if (!ch) {
      navigateTo('overview');
      return;
    }

    state.activeView = ch.id;
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_CHAPTER, ch.id);
    } catch (e) {}

    els.viewOverview.hidden = true;
    els.viewChapter.hidden = false;
    els.tocSidebar.hidden = false;
    els.layout.classList.remove('no-toc');

    const partName = ch.part === 'A'
      ? '🌱 Teil A: Einsteiger („Mein erster interaktiver Baum“)'
      : '🌳 Teil B: Lernwelt („Der wachsende Baum“)';

    els.chapterBreadcrumbs.innerHTML = `
      <a href="#overview" style="color:inherit;text-decoration:underline;">Kursübersicht</a>
      <span>›</span>
      <span>${partName}</span>
      <span>›</span>
      <strong>Kapitel ${ch.num} (${ch.index} von ${chapters.length})</strong>
    `;

    els.chapterTitle.textContent = ch.title;
    els.chapterStatusNote.textContent = ch.statusNote || 'Quellverifiziertes Kapitel';

    // Render component tags
    els.chapterComponents.innerHTML = (ch.components || []).map(comp =>
      `<span class="hb-comp-tag" title="Dokumentierte GCS-Komponente: docs/reference/components/${comp}.md">🧩 ${comp}</span>`
    ).join('');

    // Speaker Script Card
    if (ch.mediaSection) {
      els.speakerVideoTitle.textContent = ch.mediaSection.videoTitle;
      els.speakerScriptText.textContent = `„${ch.mediaSection.script}“`;
      els.speakerSyncNotes.textContent = ch.mediaSection.syncNotes
        ? `🎬 Regie- & Sync-Hinweise: ${ch.mediaSection.syncNotes}`
        : '';
      els.speakerScriptPanel.hidden = !state.showSpeaker;
    } else {
      els.speakerScriptPanel.hidden = true;
    }

    // Content Body
    els.chapterContentBody.innerHTML = ch.modernHtml;

    // Restore interactive checklists for this chapter
    const chChecks = state.checkStates[ch.id] || {};
    const inputs = els.chapterContentBody.querySelectorAll('.hb-check-input');
    inputs.forEach(input => {
      const idx = input.getAttribute('data-check-index');
      input.checked = !!chChecks[idx];
      input.addEventListener('change', () => {
        if (!state.checkStates[ch.id]) state.checkStates[ch.id] = {};
        state.checkStates[ch.id][idx] = input.checked;

        // Auto-mark chapter done if all checks are checked
        const allChecked = ch.checklists.length > 0 && ch.checklists.every((_, i) => !!state.checkStates[ch.id][i]);
        if (allChecked && !state.doneChapters.has(ch.id)) {
          state.doneChapters.add(ch.id);
        }
        saveProgress();
        updateChapterDoneButton(ch.id);
        updateProgressUI();
        renderSidebar();
      });
    });

    // Bind copy buttons on code blocks
    els.chapterContentBody.querySelectorAll('.hb-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pre = btn.closest('.hb-codeblock-wrap')?.querySelector('code');
        if (pre && navigator.clipboard) {
          navigator.clipboard.writeText(pre.textContent || '');
          const orig = btn.textContent;
          btn.textContent = '✓ Kopiert!';
          setTimeout(() => { btn.textContent = orig; }, 1500);
        }
      });
    });

    // Right TOC ("Auf dieser Seite")
    const tocItems = ch.headings.filter(h => !h.text.toLowerCase().includes('medien-vorschlag'));
    els.chapterTocList.innerHTML = tocItems.map(h =>
      `<li class="toc-h${h.level}"><a href="#${ch.id}__${h.id}" data-scroll-target="${h.id}">${h.text}</a></li>`
    ).join('');

    els.chapterTocList.querySelectorAll('a[data-scroll-target]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = a.getAttribute('data-scroll-target');
        const targetEl = document.getElementById(targetId);
        if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    updateChapterDoneButton(ch.id);

    // Prev / Next links
    const idx = ch.index - 1;
    if (idx > 0) {
      const prev = chapters[idx - 1];
      els.prevChapterLink.href = `#${prev.id}`;
      els.prevChapterTitle.textContent = `${prev.num} — ${prev.shortTitle}`;
    } else {
      els.prevChapterLink.href = '#overview';
      els.prevChapterTitle.textContent = '🏠 Zur Kursübersicht';
    }

    if (idx < chapters.length - 1) {
      const next = chapters[idx + 1];
      els.nextChapterLink.href = `#${next.id}`;
      els.nextChapterTitle.textContent = `${next.num} — ${next.shortTitle}`;
    } else {
      els.nextChapterLink.href = '#overview';
      els.nextChapterTitle.textContent = '🎉 Kurs abgeschlossen (Zur Übersicht)';
    }

    renderSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateChapterDoneButton(chapterId) {
    const isDone = state.doneChapters.has(chapterId);
    if (!els.toggleChapterDoneBtn) return;
    els.toggleChapterDoneBtn.classList.toggle('is-done', isDone);
    els.doneBtnIcon.textContent = isDone ? '✅' : '☐';
    els.doneBtnLabel.textContent = isDone ? 'Kapitel erledigt (Klicken zum Aufheben)' : 'Kapitel als erledigt markieren';
  }

  function showOverview() {
    state.activeView = 'overview';
    els.viewOverview.hidden = false;
    els.viewChapter.hidden = true;
    els.tocSidebar.hidden = true;
    els.layout.classList.add('no-toc');
    renderSidebar();
    renderOverviewGrid();
    updateProgressUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function navigateTo(hash) {
    const clean = (hash || '').replace(/^#/, '').trim();
    if (!clean || clean === 'overview') {
      showOverview();
      return;
    }
    const [chId, anchorId] = clean.split('__');
    if (chapterMap.has(chId)) {
      renderChapterView(chId);
      if (anchorId) {
        setTimeout(() => {
          const el = document.getElementById(anchorId);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 60);
      }
    } else {
      showOverview();
    }
  }

  // Full-text Search
  function openSearchModal() {
    els.searchModal.hidden = false;
    els.searchModalInput.focus();
    els.searchModalInput.select();
    runSearch(els.searchModalInput.value);
  }

  function closeSearchModal() {
    els.searchModal.hidden = true;
  }

  function highlightSnippet(text, query) {
    const lower = text.toLowerCase();
    const qLower = query.toLowerCase();
    const pos = lower.indexOf(qLower);
    if (pos === -1) return text.slice(0, 140) + '…';

    const start = Math.max(0, pos - 45);
    const end = Math.min(text.length, pos + query.length + 75);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < text.length ? '…' : '';
    const before = text.slice(start, pos);
    const match = text.slice(pos, pos + query.length);
    const after = text.slice(pos + query.length, end);
    return `${prefix}${before}<mark>${match}</mark>${after}${suffix}`;
  }

  function runSearch(rawQuery) {
    const q = (rawQuery || '').trim();
    if (!q) {
      els.searchResultsCount.textContent = 'Gib einen Suchbegriff ein (z. B. „Wasser“, „Flow-Editor“, „onClick“, „Baumhaus“, „Timer“, „Export“).';
      els.searchResultsList.innerHTML = chapters.slice(0, 6).map(ch => `
        <a href="#${ch.id}" class="hb-search-hit" data-search-hit="${ch.id}">
          <div class="hb-hit-top"><span>Kapitel ${ch.num}</span> · <span>${ch.title}</span></div>
          <div class="hb-hit-snippet">${ch.learningGoal}</div>
        </a>
      `).join('');
      bindSearchHits();
      return;
    }

    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = [];

    for (const ch of chapters) {
      const haystack = `${ch.num} ${ch.title} ${ch.learningGoal} ${ch.searchText} ${(ch.components || []).join(' ')}`.toLowerCase();
      const matchesAll = terms.every(t => haystack.includes(t));
      if (matchesAll) {
        let score = 0;
        if (ch.title.toLowerCase().includes(terms[0])) score += 10;
        if (ch.learningGoal.toLowerCase().includes(terms[0])) score += 5;
        hits.push({ ch, score, snippet: highlightSnippet(ch.searchText, terms[0]) });
      }
    }

    hits.sort((a, b) => b.score - a.score || a.ch.index - b.ch.index);

    els.searchResultsCount.textContent = `${hits.length} Treffer in 23 Kapiteln für „${q}“`;
    if (hits.length === 0) {
      els.searchResultsList.innerHTML = `<div style="padding:18px;text-align:center;color:var(--text-muted);">Keine Kapitel gefunden. Versuche einen allgemeineren Begriff wie „Variable“, „Task“, „Button“ oder „Stage“.</div>`;
      return;
    }

    els.searchResultsList.innerHTML = hits.map(({ ch, snippet }) => `
      <a href="#${ch.id}" class="hb-search-hit" data-search-hit="${ch.id}">
        <div class="hb-hit-top">
          <span class="hb-card-badge">Kapitel ${ch.num}</span>
          <span>${ch.title}</span>
        </div>
        <div class="hb-hit-snippet">${snippet}</div>
      </a>
    `).join('');
    bindSearchHits();
  }

  function bindSearchHits() {
    els.searchResultsList.querySelectorAll('.hb-search-hit').forEach(a => {
      a.addEventListener('click', () => {
        closeSearchModal();
      });
    });
  }

  // Event Listeners
  function initEvents() {
    window.addEventListener('hashchange', () => navigateTo(window.location.hash));

    els.sidebarToggleBtn?.addEventListener('click', () => {
      els.layout.classList.toggle('sidebar-collapsed');
    });

    els.toggleThemeBtn?.addEventListener('click', () => {
      applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    });

    els.toggleSpeakerBtn?.addEventListener('click', () => {
      applySpeakerMode(!state.showSpeaker);
    });

    els.closeSpeakerPanelBtn?.addEventListener('click', () => {
      applySpeakerMode(false);
    });

    els.toggleChapterDoneBtn?.addEventListener('click', () => {
      if (state.activeView === 'overview') return;
      const id = state.activeView;
      if (state.doneChapters.has(id)) {
        state.doneChapters.delete(id);
      } else {
        state.doneChapters.add(id);
      }
      saveProgress();
      updateChapterDoneButton(id);
      updateProgressUI();
      renderSidebar();
    });

    els.resetProgressBtn?.addEventListener('click', () => {
      if (confirm('Möchtest du deinen gespeicherten Lernfortschritt und alle Checklisten-Häkchen wirklich zurücksetzen?')) {
        state.doneChapters.clear();
        state.checkStates = {};
        saveProgress();
        updateProgressUI();
        renderSidebar();
        if (state.activeView === 'overview') renderOverviewGrid();
        else renderChapterView(state.activeView);
      }
    });

    // Sidebar filter tabs
    document.querySelectorAll('.hb-filter-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.hb-filter-tab').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        state.sidebarFilter = btn.getAttribute('data-filter') || 'all';
        renderSidebar();
      });
    });

    // Overview filter pills
    document.querySelectorAll('.hb-pill[data-overview-filter]').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.hb-pill[data-overview-filter]').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.overviewFilter = pill.getAttribute('data-overview-filter') || 'all';
        renderOverviewGrid();
      });
    });

    // Search Modal triggers
    els.openSearchBtn?.addEventListener('click', openSearchModal);
    els.heroSearchBtn?.addEventListener('click', openSearchModal);
    els.closeSearchBtn?.addEventListener('click', closeSearchModal);
    els.searchModal?.addEventListener('click', (e) => {
      if (e.target === els.searchModal) closeSearchModal();
    });
    els.searchModalInput?.addEventListener('input', () => {
      runSearch(els.searchModalInput.value);
    });

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (els.searchModal.hidden) openSearchModal();
        else closeSearchModal();
        return;
      }

      if (e.key === 'Escape' && !els.searchModal.hidden) {
        e.preventDefault();
        closeSearchModal();
        return;
      }

      if (isInput || !els.searchModal.hidden) return;

      if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        applyTheme(state.theme === 'dark' ? 'light' : 'dark');
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        applySpeakerMode(!state.showSpeaker);
      } else if (e.key === 'ArrowRight' && state.activeView !== 'overview') {
        const cur = chapterMap.get(state.activeView);
        if (cur && cur.index < chapters.length) {
          window.location.hash = `#${chapters[cur.index].id}`;
        }
      } else if (e.key === 'ArrowLeft' && state.activeView !== 'overview') {
        const cur = chapterMap.get(state.activeView);
        if (cur && cur.index > 1) {
          window.location.hash = `#${chapters[cur.index - 2].id}`;
        }
      }
    });
  }

  // Bootstrapping
  loadState();
  applyTheme(state.theme);
  applySpeakerMode(state.showSpeaker);
  initEvents();
  updateProgressUI();
  navigateTo(window.location.hash || '#overview');
})();
