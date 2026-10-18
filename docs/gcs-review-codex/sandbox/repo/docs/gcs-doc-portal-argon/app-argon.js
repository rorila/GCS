/**
 * app-argon.js — Haupt-Controller & Router für das GCS Documentation Portal (Argon).
 *
 * Verantwortlichkeiten:
 * - Hash-Routing für alle 6 Portal-Bereiche (#home, #handbook, #components, #features, #architecture, #devref)
 * - Dynamische Kontext-Sidebar inkl. Schnellfilter
 * - Kapitel-Leseansicht mit interaktiven Checklisten, Fortschrittsring & deutschen Sprecher-Drehbüchern
 * - Interaktive Katalog-Filter (Komponenten, Features, Runtime-Actions, Dokumenten-Inventar)
 * - Globale Spotlight-Volltextsuche (Strg+K oder /) mit Bereichs-Filter-Pills
 * - Persistenz im Browser (localStorage: gcs_handbook_modern_v1)
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'gcs_handbook_modern_v1';
  const DATA = window.GCS_PORTAL_DATA_ARGON;
  const VIEWS = window.ArgonPortalViews;

  if (!DATA || !VIEWS) {
    document.body.innerHTML =
      '<div style="padding:40px;font-family:sans-serif;color:#ef4444">Fehler: <code>data/portal-data-argon.js</code> oder <code>views-argon.js</code> konnte nicht geladen werden. Bitte <code>node docs/gcs-doc-portal-argon/build-argon.cjs</code> ausführen.</div>';
    return;
  }

  const esc = VIEWS.esc;

  const defaultState = {
    theme: 'dark',
    speakerMode: false,
    completedChapters: {},
    checkedItems: {},
    lastVisited: null,
    activeFilter: 'all'
  };

  let state = loadState();

  const uiState = {
    activeArea: 'home',
    activeSubId: null,
    sidebarFilter: '',
    compCategory: 'all',
    compStatus: 'all',
    compQuery: '',
    featCategory: 'all',
    devSubView: 'overview',
    actionQuery: '',
    docInvQuery: '',
    docInvRating: 'all',
    searchScope: 'all',
    searchSelectedIdx: 0,
    searchMatches: []
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...defaultState };
      const parsed = JSON.parse(raw);
      return { ...defaultState, ...parsed, completedChapters: parsed.completedChapters || {}, checkedItems: parsed.checkedItems || {} };
    } catch (_) {
      return { ...defaultState };
    }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  const byId = (id) => document.getElementById(id);
  const el = {
    html: document.documentElement,
    sidebar: byId('sidebar'),
    btnSidebarToggle: byId('btn-sidebar-toggle'),
    areaNav: byId('area-nav'),
    badgeHandbook: byId('badge-count-handbook'),
    badgeComponents: byId('badge-count-components'),
    badgeFeatures: byId('badge-count-features'),
    badgeArchitecture: byId('badge-count-architecture'),
    badgeDevref: byId('badge-count-devref'),
    btnCourseOverview: byId('btn-course-overview'),
    sidebarOverviewLabel: byId('sidebar-overview-label'),
    sidebarQuickFilter: byId('sidebar-quick-filter'),
    navTree: byId('chapter-nav-tree'),
    btnResetProgress: byId('btn-reset-progress'),
    progressCircle: byId('progress-ring-circle'),
    progressLabel: byId('progress-label'),
    btnSpeakerGlobal: byId('btn-toggle-speaker-global'),
    btnTheme: byId('btn-toggle-theme'),
    themeIcon: byId('theme-icon'),
    mainContent: byId('main-content'),
    viewDashboard: byId('view-dashboard'),
    viewChapter: byId('view-chapter'),
    viewDetail: byId('view-detail'),
    chapGroupLabel: byId('chap-group-label'),
    chapNumBadge: byId('chap-num-badge'),
    chapTitle: byId('chap-title'),
    btnMarkComplete: byId('btn-mark-complete'),
    btnMarkCompleteBottom: byId('btn-mark-complete-bottom'),
    completeIcon: byId('complete-icon'),
    completeText: byId('complete-text'),
    chapStatusNote: byId('chap-status-note'),
    chapComponentsRow: byId('chap-components-row'),
    chapSpeakerPanel: byId('chap-speaker-panel'),
    speakerVideoTitle: byId('speaker-video-title'),
    speakerSyncNotes: byId('speaker-sync-notes'),
    speakerScriptText: byId('speaker-script-text'),
    btnCloseSpeaker: byId('btn-close-speaker'),
    chapBody: byId('chap-body'),
    linkPrevChap: byId('link-prev-chap'),
    prevChapTitle: byId('prev-chap-title'),
    linkNextChap: byId('link-next-chap'),
    nextChapTitle: byId('next-chap-title'),
    tocAside: byId('toc-aside'),
    tocHeading: byId('toc-heading'),
    tocList: byId('toc-list'),
    tocContextCard: byId('toc-context-card'),
    btnOpenSearch: byId('btn-open-search'),
    searchModal: byId('search-modal'),
    searchInput: byId('search-input'),
    btnCloseSearch: byId('btn-close-search'),
    searchScopeBar: byId('search-scope-bar'),
    searchMeta: byId('search-meta'),
    searchResults: byId('search-results')
  };

  function isChapterDone(chap) {
    if (!chap) return false;
    if (state.completedChapters[chap.id]) return true;
    return Boolean(chap.checklists && chap.checklists.length > 0 && chap.checklists.every(chk => Boolean(state.checkedItems[chk.id])));
  }

  const viewHelpers = { isChapterDone };

  function updateGlobalProgressUI() {
    const chapters = DATA.handbook.chapters;
    const total = chapters.length;
    const done = chapters.filter(isChapterDone).length;
    el.progressLabel.textContent = `${done} / ${total}`;
    const offset = 69.1 - (total > 0 ? done / total : 0) * 69.1;
    el.progressCircle.style.strokeDashoffset = String(offset.toFixed(1));
  }

  function updateTopbarCounts() {
    const c = DATA.meta.counts;
    if (el.badgeHandbook) el.badgeHandbook.textContent = String(c.handbookChapters);
    if (el.badgeComponents) el.badgeComponents.textContent = String(c.components);
    if (el.badgeFeatures) el.badgeFeatures.textContent = String(c.features);
    if (el.badgeArchitecture) el.badgeArchitecture.textContent = String(c.architectureDocs);
    if (el.badgeDevref) el.badgeDevref.textContent = String(c.actions);
  }

  function applyTheme(theme) {
    state.theme = theme === 'light' ? 'light' : 'dark';
    el.html.setAttribute('data-theme', state.theme);
    el.themeIcon.textContent = state.theme === 'dark' ? '🌙' : '☀️';
    saveState();
  }

  function applySpeakerMode(enabled) {
    state.speakerMode = Boolean(enabled);
    el.btnSpeakerGlobal.setAttribute('aria-pressed', state.speakerMode ? 'true' : 'false');
    if (!el.viewChapter.classList.contains('hb-hidden')) {
      const currentChap = DATA.handbook.chapters.find(c => c.id === uiState.activeSubId);
      if (currentChap && currentChap.mediaSection) el.chapSpeakerPanel.classList.toggle('hb-hidden', !state.speakerMode);
    }
    saveState();
  }

  function updateAreaNavUI(area) {
    uiState.activeArea = area;
    el.areaNav.querySelectorAll('.hb-area-tab').forEach(tab => {
      tab.classList.toggle('is-active', tab.getAttribute('data-area') === area);
    });
  }

  // --- Kontext-Sidebar rendern ---
  function renderSidebar() {
    const area = uiState.activeArea;
    const subId = uiState.activeSubId;
    const q = (uiState.sidebarFilter || '').trim().toLowerCase();

    const areaConfig = {
      home: { href: '#home', icon: '🏠', label: 'Portal-Startseite' },
      handbook: { href: '#handbook', icon: '📖', label: 'Handbuch-Übersicht (23)' },
      components: { href: '#components', icon: '🧩', label: 'Alle 128 Komponenten' },
      features: { href: '#features', icon: '✨', label: 'Feature-Katalog (12)' },
      architecture: { href: '#architecture', icon: '🏛️', label: 'Architektur-Übersicht (4)' },
      devref: { href: '#devref', icon: '🛠️', label: 'Entwickler-Übersicht' }
    }[area] || { href: '#home', icon: '🏠', label: 'Portal-Startseite' };

    el.btnCourseOverview.setAttribute('href', areaConfig.href);
    el.btnCourseOverview.querySelector('span:first-child').textContent = areaConfig.icon;
    el.sidebarOverviewLabel.textContent = areaConfig.label;
    el.btnCourseOverview.classList.toggle('is-active', !subId);

    // 1. Handbuch-Sidebar (und Standard auf #home)
    if (area === 'handbook' || area === 'home') {
      const groups = [];
      const groupMap = new Map();
      for (const chap of DATA.handbook.chapters) {
        if (q && !`${chap.num} ${chap.shortTitle} ${chap.title}`.toLowerCase().includes(q)) continue;
        if (!groupMap.has(chap.groupId)) {
          const g = { id: chap.groupId, title: chap.groupTitle, part: chap.part, items: [] };
          groupMap.set(chap.groupId, g);
          groups.push(g);
        }
        groupMap.get(chap.groupId).items.push(chap);
      }

      el.navTree.innerHTML = groups.map(g => `
        <div class="hb-nav-group">
          <div class="hb-nav-group-title">${esc(g.title)}</div>
          ${g.items.map(c => {
            const done = isChapterDone(c);
            const active = area === 'handbook' && subId === c.id;
            return `
              <a href="#handbook/${esc(c.id)}" class="hb-nav-item ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}">
                <span class="hb-nav-num">${esc(c.num)}</span>
                <span class="hb-nav-label">${esc(c.shortTitle)}</span>
                <span class="hb-nav-check" aria-hidden="true">${done ? '✔' : ''}</span>
              </a>
            `;
          }).join('')}
        </div>
      `).join('') || '<div style="padding:14px;font-size:0.82rem;color:var(--text-muted)">Keine Treffer in der Navigation.</div>';
      return;
    }

    // 2. Komponenten-Sidebar (11 Kategorien + Komponenten)
    if (area === 'components') {
      const cats = DATA.components.categories;
      const items = DATA.components.items;
      let html = '';

      for (const cat of cats) {
        const catItems = items.filter(c => {
          if (c.categoryKey !== cat.id) return false;
          if (q && !`${c.name} ${c.id} ${c.summary}`.toLowerCase().includes(q)) return false;
          return true;
        });
        if (catItems.length === 0) continue;

        html += `
          <div class="hb-nav-group">
            <div class="hb-nav-group-title">${cat.icon} ${esc(cat.label)} (${catItems.length})</div>
            ${catItems.map(c => `
              <a href="#components/${esc(c.name)}" class="hb-nav-item ${subId === c.name ? 'is-active' : ''} ${c.isCurated ? 'is-done' : ''}">
                <span class="hb-nav-num">${esc(c.id.replace('COMP-0', 'C'))}</span>
                <span class="hb-nav-label">${esc(c.name)}</span>
                <span class="hb-nav-check" title="${c.isCurated ? 'Kuratierte Referenzkarte' : ''}">${c.isCurated ? '★' : ''}</span>
              </a>
            `).join('')}
          </div>
        `;
      }
      el.navTree.innerHTML = html || '<div style="padding:14px;font-size:0.82rem;color:var(--text-muted)">Keine Komponenten gefunden.</div>';
      return;
    }

    // 3. Features-Sidebar (12 Inventar-Features + 12 Fachartikel)
    if (area === 'features') {
      const inv = DATA.features.inventory.filter(f => !q || `${f.id} ${f.name} ${f.category}`.toLowerCase().includes(q));
      const docs = DATA.features.articles.filter(a => !q || `${a.title} ${a.category}`.toLowerCase().includes(q));

      el.navTree.innerHTML = `
        <div class="hb-nav-group">
          <div class="hb-nav-group-title">✨ System-Features (${inv.length})</div>
          ${inv.map(f => `
            <a href="#features/${esc(f.id)}" class="hb-nav-item ${subId === f.id ? 'is-active' : ''} is-done">
              <span class="hb-nav-num">${esc(f.id.replace('FEAT-00', 'F'))}</span>
              <span class="hb-nav-label">${esc(f.name)}</span>
            </a>
          `).join('')}
        </div>
        <div class="hb-nav-group">
          <div class="hb-nav-group-title">📄 Feature-Fachartikel (${docs.length})</div>
          ${docs.map(a => `
            <a href="#features/${esc(a.id)}" class="hb-nav-item ${subId === a.id ? 'is-active' : ''}">
              <span class="hb-nav-num">DOK</span>
              <span class="hb-nav-label">${esc(a.title)}</span>
            </a>
          `).join('')}
        </div>
      `;
      return;
    }

    // 4. Architektur-Sidebar
    if (area === 'architecture') {
      const docs = DATA.architecture.articles.filter(a => !q || `${a.title} ${a.summary}`.toLowerCase().includes(q));
      el.navTree.innerHTML = `
        <div class="hb-nav-group">
          <div class="hb-nav-group-title">🏛️ Kanonische Dokumente (${docs.length})</div>
          ${docs.map((a, i) => `
            <a href="#architecture/${esc(a.id)}" class="hb-nav-item ${subId === a.id ? 'is-active' : ''} is-done">
              <span class="hb-nav-num">0${i + 1}</span>
              <span class="hb-nav-label">${esc(a.title)}</span>
            </a>
          `).join('')}
        </div>
      `;
      return;
    }

    // 5. Entwicklerreferenz-Sidebar
    if (area === 'devref') {
      const docs = DATA.devref.articles.filter(a => !q || `${a.title} ${a.category}`.toLowerCase().includes(q));
      el.navTree.innerHTML = `
        <div class="hb-nav-group">
          <div class="hb-nav-group-title">⚡ Interaktive Register</div>
          <a href="#devref/actions" class="hb-nav-item ${subId === 'actions' ? 'is-active' : ''} is-done">
            <span class="hb-nav-num">${DATA.devref.actions.length}</span>
            <span class="hb-nav-label">Runtime-Action-Katalog</span>
          </a>
          <a href="#devref/doc-inventory" class="hb-nav-item ${subId === 'doc-inventory' ? 'is-active' : ''} is-done">
            <span class="hb-nav-num">${DATA.devref.documentInventory.length}</span>
            <span class="hb-nav-label">Dokumenten-Inventar</span>
          </a>
          <a href="#devref/swe2-interface" class="hb-nav-item ${subId === 'swe2-interface' ? 'is-active' : ''} is-done">
            <span class="hb-nav-num">SWE2</span>
            <span class="hb-nav-label">KI-Referenzdaten-Vertrag</span>
          </a>
        </div>
        <div class="hb-nav-group">
          <div class="hb-nav-group-title">🛠️ Technische Referenzdokumente</div>
          ${docs.map(a => `
            <a href="#devref/${esc(a.id)}" class="hb-nav-item ${subId === a.id ? 'is-active' : ''}">
              <span class="hb-nav-num">REF</span>
              <span class="hb-nav-label">${esc(a.title)}</span>
            </a>
          `).join('')}
        </div>
      `;
    }
  }

  // --- Rechte Spalte („Auf dieser Seite“ & Kontext-Querverweise) ---
  function renderRightToc(headings, contextHtml) {
    el.tocAside.style.display = '';
    el.tocHeading.textContent = headings && headings.length > 0 ? 'Auf dieser Seite' : 'Portal-Kontext';

    if (headings && headings.length > 0) {
      el.tocList.innerHTML = headings
        .filter(h => h.level === 2 || h.level === 3)
        .map(h => `
          <a href="#${esc(h.id)}" class="hb-toc-link hb-toc-l${h.level}" data-toc-target="${esc(h.id)}">
            ${esc(h.text)}
          </a>
        `).join('');

      el.tocList.querySelectorAll('.hb-toc-link').forEach(link => {
        link.addEventListener('click', e => {
          e.preventDefault();
          const targetId = link.getAttribute('data-toc-target');
          const targetEl = document.getElementById(targetId);
          if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    } else {
      const c = DATA.meta.counts;
      el.tocList.innerHTML = `
        <a href="#handbook" class="hb-toc-link">📖 ${c.handbookChapters} Handbuch-Kapitel</a>
        <a href="#components" class="hb-toc-link">🧩 ${c.components} Komponenten</a>
        <a href="#features" class="hb-toc-link">✨ ${c.features} System-Features</a>
        <a href="#architecture" class="hb-toc-link">🏛️ ${c.architectureDocs} Architektur-Doks</a>
        <a href="#devref/actions" class="hb-toc-link">⚡ ${c.actions} Runtime-Actions</a>
        <a href="#devref/swe2-interface" class="hb-toc-link">🤝 SWE-2 Schnittstelle</a>
      `;
    }

    if (contextHtml) {
      el.tocContextCard.classList.remove('hb-hidden');
      el.tocContextCard.innerHTML = contextHtml;
    } else {
      el.tocContextCard.classList.add('hb-hidden');
      el.tocContextCard.innerHTML = '';
    }
  }

  // --- Ansicht umschalten ---
  function showView(which) {
    el.viewDashboard.classList.toggle('hb-hidden', which !== 'dashboard');
    el.viewChapter.classList.toggle('hb-hidden', which !== 'chapter');
    el.viewDetail.classList.toggle('hb-hidden', which !== 'detail');
  }

  function bindLiveInput(id, stateKey, renderFn) {
    const input = byId(id);
    if (!input) return;
    input.addEventListener('input', () => {
      const pos = input.selectionStart;
      uiState[stateKey] = input.value;
      el.viewDashboard.innerHTML = renderFn();
      bindDashboardEvents();
      const next = byId(id);
      if (next) { next.focus(); next.setSelectionRange(pos, pos); }
    });
  }

  function bindDashboardEvents() {
    el.viewDashboard.querySelectorAll('[data-hb-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.activeFilter = btn.getAttribute('data-hb-filter');
        saveState();
        el.viewDashboard.innerHTML = VIEWS.renderHandbookOverview(DATA, state, viewHelpers);
        bindDashboardEvents();
      });
    });

    bindLiveInput('comp-catalog-search', 'compQuery', () => VIEWS.renderComponentsCatalog(DATA, uiState));
    bindLiveInput('devref-action-search', 'actionQuery', () => VIEWS.renderDevRefOverview(DATA, uiState));
    bindLiveInput('devref-docinv-search', 'docInvQuery', () => VIEWS.renderDevRefOverview(DATA, uiState));

    const compStatus = byId('comp-status-select');
    if (compStatus) {
      compStatus.addEventListener('change', () => {
        uiState.compStatus = compStatus.value;
        el.viewDashboard.innerHTML = VIEWS.renderComponentsCatalog(DATA, uiState);
        bindDashboardEvents();
      });
    }

    el.viewDashboard.querySelectorAll('[data-comp-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        uiState.compCategory = btn.getAttribute('data-comp-cat');
        el.viewDashboard.innerHTML = VIEWS.renderComponentsCatalog(DATA, uiState);
        bindDashboardEvents();
      });
    });

    el.viewDashboard.querySelectorAll('[data-feat-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        uiState.featCategory = btn.getAttribute('data-feat-cat');
        el.viewDashboard.innerHTML = VIEWS.renderFeaturesCatalog(DATA, uiState);
        bindDashboardEvents();
      });
    });

    const docInvRating = byId('devref-docinv-rating');
    if (docInvRating) {
      docInvRating.addEventListener('change', () => {
        uiState.docInvRating = docInvRating.value;
        el.viewDashboard.innerHTML = VIEWS.renderDevRefOverview(DATA, uiState);
        bindDashboardEvents();
      });
    }
  }

  // --- Handbuch-Kapitel rendern (#handbook/<chapterId>) ---
  function renderChapterView(chapterId, scrollTargetId) {
    const chapters = DATA.handbook.chapters;
    const idx = chapters.findIndex(c => c.id === chapterId);
    if (idx === -1) {
      window.location.hash = '#handbook';
      return;
    }

    const chap = chapters[idx];
    uiState.activeSubId = chap.id;
    state.lastVisited = chap.id;
    saveState();

    showView('chapter');

    el.chapGroupLabel.textContent = chap.groupTitle;
    el.chapNumBadge.textContent = `Kapitel ${chap.num}`;
    el.chapTitle.textContent = chap.title;

    if (chap.statusNote) {
      el.chapStatusNote.classList.remove('hb-hidden');
      el.chapStatusNote.innerHTML = `<span>📌</span><div><strong>Stand in diesem Kapitel:</strong> ${esc(chap.statusNote)}</div>`;
    } else {
      el.chapStatusNote.classList.add('hb-hidden');
    }

    if (chap.components && chap.components.length > 0) {
      el.chapComponentsRow.classList.remove('hb-hidden');
      el.chapComponentsRow.innerHTML =
        `<span style="font-size:0.76rem;color:var(--text-muted);margin-right:4px">Komponenten (Klick öffnet Referenz):</span>` +
        chap.components.map(c => `<a href="#components/${esc(c)}" class="hb-comp-tag">🧩 ${esc(c)}</a>`).join('');
    } else {
      el.chapComponentsRow.classList.add('hb-hidden');
    }

    if (chap.mediaSection) {
      el.speakerVideoTitle.textContent = chap.mediaSection.videoTitle || `Kapitel ${chap.num}`;
      el.speakerSyncNotes.textContent = chap.mediaSection.syncNotes || 'Visuelle Demonstration direkt im GCS-Editor';
      el.speakerScriptText.textContent = chap.mediaSection.scriptText || '';
      el.chapSpeakerPanel.classList.toggle('hb-hidden', !state.speakerMode);
    } else {
      el.chapSpeakerPanel.classList.add('hb-hidden');
    }

    el.chapBody.innerHTML = chap.htmlContent;

    // Interaktive Checklisten-Punkte verdrahten
    el.chapBody.querySelectorAll('.hb-check-item').forEach(itemEl => {
      const checkId = itemEl.getAttribute('data-check-id');
      const inputEl = itemEl.querySelector('.hb-check-input');
      const checked = Boolean(state.checkedItems[checkId]);
      inputEl.checked = checked;
      itemEl.classList.toggle('is-checked', checked);

      inputEl.addEventListener('change', () => {
        if (inputEl.checked) {
          state.checkedItems[checkId] = true;
        } else {
          delete state.checkedItems[checkId];
        }
        itemEl.classList.toggle('is-checked', inputEl.checked);
        saveState();
        updateCompleteButtonsUI(chap);
        updateGlobalProgressUI();
        renderSidebar();
      });
    });

    updateCompleteButtonsUI(chap);

    // Vorheriges / Nächstes Kapitel
    const prev = idx > 0 ? chapters[idx - 1] : null;
    const next = idx < chapters.length - 1 ? chapters[idx + 1] : null;

    if (prev) {
      el.linkPrevChap.setAttribute('href', `#handbook/${prev.id}`);
      el.prevChapTitle.textContent = `${prev.num}: ${prev.shortTitle}`;
    } else {
      el.linkPrevChap.setAttribute('href', '#handbook');
      el.prevChapTitle.textContent = 'Zurück zur Handbuch-Übersicht';
    }

    if (next) {
      el.linkNextChap.setAttribute('href', `#handbook/${next.id}`);
      el.nextChapTitle.textContent = `${next.num}: ${next.shortTitle}`;
    } else {
      el.linkNextChap.setAttribute('href', '#components');
      el.nextChapTitle.textContent = 'Weiter zur Komponentenreferenz (128)';
    }

    // Rechte Spalte: TOC + Sprechertext-Box
    const speakerCardHtml = chap.mediaSection ? `
      <div class="hb-toc-speaker-head">🎙️ Sprecher-Drehbuch</div>
      <p class="hb-toc-speaker-sub">Zu diesem Kapitel gehört ein deutsches Voice-Over-Skript.</p>
      <button type="button" id="btn-toc-speaker" class="hb-secondary-btn">Drehbuch ein-/ausblenden</button>
    ` : '';
    renderRightToc(chap.headings, speakerCardHtml);

    const btnTocSpeaker = document.getElementById('btn-toc-speaker');
    if (btnTocSpeaker) {
      btnTocSpeaker.addEventListener('click', () => {
        applySpeakerMode(!state.speakerMode);
        if (state.speakerMode) {
          el.chapSpeakerPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }

    renderSidebar();
    updateGlobalProgressUI();

    if (scrollTargetId) {
      setTimeout(() => {
        const target = document.getElementById(scrollTargetId);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 40);
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }

  function updateCompleteButtonsUI(chap) {
    const done = isChapterDone(chap);
    el.btnMarkComplete.classList.toggle('is-done', done);
    el.btnMarkComplete.setAttribute('aria-pressed', done ? 'true' : 'false');
    el.completeIcon.textContent = done ? '☑' : '☐';
    el.completeText.textContent = done ? 'Kapitel erledigt' : 'Als erledigt markieren';

    el.btnMarkCompleteBottom.classList.toggle('is-done', done);
    el.btnMarkCompleteBottom.innerHTML = `<span>${done ? '☑' : '☐'}</span><span>${done ? 'Kapitel erledigt' : 'Kapitel als erledigt markieren'}</span>`;
  }

  function toggleCurrentChapterComplete() {
    const chap = DATA.handbook.chapters.find(c => c.id === uiState.activeSubId);
    if (!chap) return;
    const currentlyDone = isChapterDone(chap);
    if (currentlyDone) {
      delete state.completedChapters[chap.id];
      chap.checklists.forEach(chk => { delete state.checkedItems[chk.id]; });
    } else {
      state.completedChapters[chap.id] = true;
      chap.checklists.forEach(chk => { state.checkedItems[chk.id] = true; });
    }
    saveState();
    renderChapterView(chap.id);
  }

  // --- Zentraler Hash-Router ---
  function handleRoute() {
    const rawHash = decodeURIComponent(window.location.hash || '').replace(/^#/, '').trim();
    el.sidebar.classList.remove('is-open');

    // Abwärtskompatibilität für direkte Kapitel-Hashes (#kapitel-01-... oder #b-kapitel-01-...)
    const legacyChap = DATA.handbook.chapters.find(c => c.id === rawHash);
    if (legacyChap) {
      updateAreaNavUI('handbook');
      renderChapterView(legacyChap.id);
      return;
    }

    const parts = rawHash.split('/').filter(Boolean);
    const root = parts[0] || 'home';
    const sub = parts.slice(1).join('/') || null;

    // 1. PORTAL-STARTSEITE (#home)
    if (root === 'home') {
      updateAreaNavUI('home');
      uiState.activeSubId = null;
      showView('dashboard');
      el.viewDashboard.innerHTML = VIEWS.renderPortalHome(DATA, state, viewHelpers);
      renderSidebar();
      renderRightToc([], `
        <div class="hb-toc-speaker-head">🤝 SWE-2 Ready</div>
        <p class="hb-toc-speaker-sub">Kanonische IDs (COMP / FEAT / DOC) sind im gesamten Portal aktiv verlinkt.</p>
      `);
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }

    // 2. AUTOREN-HANDBUCH (#handbook oder #handbook/<id>)
    if (root === 'handbook') {
      updateAreaNavUI('handbook');
      if (!sub) {
        uiState.activeSubId = null;
        showView('dashboard');
        el.viewDashboard.innerHTML = VIEWS.renderHandbookOverview(DATA, state, viewHelpers);
        bindDashboardEvents();
        renderSidebar();
        renderRightToc([], '');
        window.scrollTo({ top: 0, behavior: 'instant' });
      } else {
        renderChapterView(sub);
      }
      return;
    }

    // 3. KOMPONENTENREFERENZ (#components oder #components/<TName|COMP-xxxx>)
    if (root === 'components') {
      updateAreaNavUI('components');
      if (!sub) {
        uiState.activeSubId = null;
        showView('dashboard');
        el.viewDashboard.innerHTML = VIEWS.renderComponentsCatalog(DATA, uiState);
        bindDashboardEvents();
        renderSidebar();
        renderRightToc([], '');
        window.scrollTo({ top: 0, behavior: 'instant' });
      } else {
        const comp = DATA.components.items.find(
          c => c.name.toLowerCase() === sub.toLowerCase() || c.id.toLowerCase() === sub.toLowerCase()
        );
        if (!comp) {
          window.location.hash = '#components';
          return;
        }
        uiState.activeSubId = comp.name;
        showView('detail');
        el.viewDetail.innerHTML = VIEWS.renderComponentDetail(comp, DATA);
        renderSidebar();
        renderRightToc(comp.headings || [], `
          <div class="hb-toc-speaker-head">🧩 ${esc(comp.name)}</div>
          <p class="hb-toc-speaker-sub">${esc(comp.id)} · ${esc(comp.categoryLabel)}<br/>Props: ${comp.properties.length} · Events: ${comp.events.length}</p>
        `);
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
      return;
    }

    // 4. FEATURE-KATALOG (#features oder #features/<FEAT-xxxx|feat-doc-...>)
    if (root === 'features') {
      updateAreaNavUI('features');
      if (!sub) {
        uiState.activeSubId = null;
        showView('dashboard');
        el.viewDashboard.innerHTML = VIEWS.renderFeaturesCatalog(DATA, uiState);
        bindDashboardEvents();
        renderSidebar();
        renderRightToc([], '');
        window.scrollTo({ top: 0, behavior: 'instant' });
      } else {
        const invFeat = DATA.features.inventory.find(f => f.id.toLowerCase() === sub.toLowerCase());
        const docFeat = DATA.features.articles.find(a => a.id.toLowerCase() === sub.toLowerCase());
        const item = invFeat || docFeat;
        if (!item) {
          window.location.hash = '#features';
          return;
        }
        uiState.activeSubId = item.id;
        showView('detail');
        el.viewDetail.innerHTML = VIEWS.renderFeatureDetail(item, Boolean(invFeat), DATA);
        renderSidebar();
        const headings = invFeat
          ? [
              { level: 2, id: 'quellen-tests', text: 'Maßgebliche Quelldateien & Tests' },
              { level: 2, id: 'testlaeufe', text: 'Protokollierte Testläufe' },
              { level: 2, id: 'querverweise', text: 'Komponenten & Handbuch-Kapitel' }
            ]
          : (docFeat.headings || []);
        renderRightToc(headings, '');
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
      return;
    }

    // 5. ARCHITEKTUR-DOKUMENTATION (#architecture oder #architecture/<id>)
    if (root === 'architecture') {
      updateAreaNavUI('architecture');
      if (!sub) {
        uiState.activeSubId = null;
        showView('dashboard');
        el.viewDashboard.innerHTML = VIEWS.renderArchitectureOverview(DATA);
        renderSidebar();
        renderRightToc([], '');
        window.scrollTo({ top: 0, behavior: 'instant' });
      } else {
        const doc = DATA.architecture.articles.find(a => a.id === sub);
        if (!doc) {
          window.location.hash = '#architecture';
          return;
        }
        uiState.activeSubId = doc.id;
        showView('detail');
        el.viewDetail.innerHTML = VIEWS.renderGenericDocDetail(
          doc, 'architecture', 'Architektur-Dokumentation', '#architecture', DATA.architecture.articles
        );
        renderSidebar();
        renderRightToc(doc.headings || [], '');
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
      return;
    }

    // 6. ENTWICKLERREFERENZ (#devref, #devref/actions, #devref/doc-inventory, #devref/swe2-interface, #devref/<docId>)
    if (root === 'devref') {
      updateAreaNavUI('devref');
      if (!sub || sub === 'actions' || sub === 'doc-inventory' || sub === 'swe2-interface') {
        uiState.activeSubId = sub || null;
        uiState.devSubView = sub || 'overview';
        showView('dashboard');
        el.viewDashboard.innerHTML = VIEWS.renderDevRefOverview(DATA, uiState);
        bindDashboardEvents();
        renderSidebar();
        renderRightToc([], '');
        window.scrollTo({ top: 0, behavior: 'instant' });
      } else {
        const doc = DATA.devref.articles.find(a => a.id === sub);
        if (!doc) {
          window.location.hash = '#devref';
          return;
        }
        uiState.activeSubId = doc.id;
        showView('detail');
        el.viewDetail.innerHTML = VIEWS.renderGenericDocDetail(
          doc, 'devref', 'Entwicklerreferenz', '#devref', DATA.devref.articles
        );
        renderSidebar();
        renderRightToc(doc.headings || [], '');
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
      return;
    }

    // Fallback: Startseite
    window.location.hash = '#home';
  }

  // --- Globale Spotlight-Volltextsuche (Strg+K) ---
  function openSearchModal() {
    el.searchModal.classList.remove('hb-hidden');
    el.searchInput.focus();
    el.searchInput.select();
    performSearch(el.searchInput.value);
  }

  function closeSearchModal() {
    el.searchModal.classList.add('hb-hidden');
  }

  function highlightMatch(text, query) {
    const safe = esc(text);
    if (!query) return safe;
    const escapedQ = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(`(${escapedQ})`, 'ig'), '<mark>$1</mark>');
  }

  function performSearch(rawQuery) {
    const q = (rawQuery || '').trim().toLowerCase();
    const scope = uiState.searchScope || 'all';
    const index = DATA.searchIndex || [];

    if (!q) {
      uiState.searchMatches = [];
      el.searchMeta.innerHTML =
        `Durchsucht <strong>${index.length} Einträge</strong> im gesamten Portal — z. B. <code>TSprite</code>, <code>Wasser</code>, <code>FEAT-0001</code>, <code>navigate_stage</code> oder <code>TD-009</code>`;
      el.searchResults.innerHTML = '';
      return;
    }

    const terms = q.split(/\s+/).filter(Boolean);
    const matches = [];

    for (const entry of index) {
      if (scope !== 'all' && entry.area !== scope) continue;
      const titleLow = (entry.title || '').toLowerCase();
      const badgeLow = (entry.badge || '').toLowerCase();
      const kwLow = (entry.keywords || '').toLowerCase();
      const textLow = (entry.text || '').toLowerCase();

      let score = 0;
      let allFound = true;
      for (const t of terms) {
        const inTitle = titleLow.includes(t);
        const inBadge = badgeLow.includes(t);
        const inKw = kwLow.includes(t);
        const inText = textLow.includes(t);
        if (!inTitle && !inBadge && !inKw && !inText) {
          allFound = false;
          break;
        }
        if (titleLow === t || badgeLow === t) score += 25;
        if (inTitle) score += 12;
        if (inBadge) score += 8;
        if (inKw) score += 6;
        if (inText) score += 2;
      }

      if (!allFound) continue;

      let snippet = entry.text || '';
      const firstPos = textLow.indexOf(terms[0]);
      if (firstPos > 40) {
        snippet = '…' + entry.text.slice(Math.max(0, firstPos - 35), firstPos + 150) + '…';
      } else {
        snippet = entry.text.slice(0, 175) + (entry.text.length > 175 ? '…' : '');
      }

      matches.push({ entry, score, snippet });
    }

    matches.sort((a, b) => b.score - a.score);
    uiState.searchMatches = matches.slice(0, 35);
    uiState.searchSelectedIdx = 0;

    el.searchMeta.textContent = `${matches.length} Treffer für „${rawQuery.trim()}“`;
    renderSearchResults(terms[0]);
  }

  function renderSearchResults(highlightTerm) {
    if (uiState.searchMatches.length === 0) {
      el.searchResults.innerHTML = '<div class="hb-search-empty">Keine passenden Einträge für diesen Suchbegriff gefunden.</div>';
      return;
    }

    el.searchResults.innerHTML = uiState.searchMatches.map((m, idx) => `
      <a href="${esc(m.entry.href)}" class="hb-search-item ${idx === uiState.searchSelectedIdx ? 'is-selected' : ''}" data-search-idx="${idx}">
        <div class="hb-search-item-top">
          <span class="hb-search-chap">${esc(m.entry.areaLabel)} · ${highlightMatch(m.entry.badge, highlightTerm)}</span>
          <span class="hb-search-sec">${highlightMatch(m.entry.title, highlightTerm)}</span>
        </div>
        <div class="hb-search-snippet">${highlightMatch(m.snippet, highlightTerm)}</div>
      </a>
    `).join('');

    el.searchResults.querySelectorAll('.hb-search-item').forEach(link => {
      link.addEventListener('click', () => closeSearchModal());
    });
  }

  // --- Initialisierung ---
  function init() {
    updateTopbarCounts();
    applyTheme(state.theme);
    applySpeakerMode(state.speakerMode);
    updateGlobalProgressUI();

    el.btnTheme.addEventListener('click', () => applyTheme(state.theme === 'dark' ? 'light' : 'dark'));
    el.btnSpeakerGlobal.addEventListener('click', () => applySpeakerMode(!state.speakerMode));
    el.btnCloseSpeaker.addEventListener('click', () => applySpeakerMode(false));

    el.btnMarkComplete.addEventListener('click', toggleCurrentChapterComplete);
    el.btnMarkCompleteBottom.addEventListener('click', toggleCurrentChapterComplete);

    el.btnSidebarToggle.addEventListener('click', () => el.sidebar.classList.toggle('is-open'));

    if (el.sidebarQuickFilter) {
      el.sidebarQuickFilter.addEventListener('input', () => {
        uiState.sidebarFilter = el.sidebarQuickFilter.value;
        renderSidebar();
      });
    }

    el.btnResetProgress.addEventListener('click', () => {
      if (window.confirm('Möchtest du deinen gespeicherten Handbuch-Lernfortschritt und alle abgehakten Checklisten wirklich zurücksetzen?')) {
        state.completedChapters = {};
        state.checkedItems = {};
        saveState();
        updateGlobalProgressUI();
        handleRoute();
      }
    });

    // Suche
    el.btnOpenSearch.addEventListener('click', openSearchModal);
    el.btnCloseSearch.addEventListener('click', closeSearchModal);
    el.searchModal.addEventListener('click', e => {
      if (e.target === el.searchModal) closeSearchModal();
    });
    el.searchInput.addEventListener('input', () => performSearch(el.searchInput.value));

    if (el.searchScopeBar) {
      el.searchScopeBar.querySelectorAll('.hb-scope-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          uiState.searchScope = pill.getAttribute('data-scope') || 'all';
          el.searchScopeBar.querySelectorAll('.hb-scope-pill').forEach(p => {
            p.classList.toggle('is-active', p === pill);
          });
          performSearch(el.searchInput.value);
          el.searchInput.focus();
        });
      });
    }

    // Globale Tastaturkürzel (Strg+K, /, Pfeiltasten, Esc)
    window.addEventListener('keydown', e => {
      const inModal = !el.searchModal.classList.contains('hb-hidden');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (inModal) closeSearchModal();
        else openSearchModal();
        return;
      }
      if (!inModal && e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement || {}).tagName)) {
        e.preventDefault();
        openSearchModal();
        return;
      }
      if (inModal) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeSearchModal();
        } else if (e.key === 'ArrowDown' && uiState.searchMatches.length > 0) {
          e.preventDefault();
          uiState.searchSelectedIdx = (uiState.searchSelectedIdx + 1) % uiState.searchMatches.length;
          renderSearchResults(el.searchInput.value.trim().split(/\s+/)[0]);
        } else if (e.key === 'ArrowUp' && uiState.searchMatches.length > 0) {
          e.preventDefault();
          uiState.searchSelectedIdx = (uiState.searchSelectedIdx - 1 + uiState.searchMatches.length) % uiState.searchMatches.length;
          renderSearchResults(el.searchInput.value.trim().split(/\s+/)[0]);
        } else if (e.key === 'Enter' && uiState.searchMatches[uiState.searchSelectedIdx]) {
          e.preventDefault();
          const targetHref = uiState.searchMatches[uiState.searchSelectedIdx].entry.href;
          closeSearchModal();
          window.location.hash = targetHref;
        }
      }
    });

    window.addEventListener('hashchange', handleRoute);
    handleRoute();
  }

  init();
})();
