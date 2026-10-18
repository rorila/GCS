/**
 * views-argon.js — Darstellungs-Module für das GCS Documentation Portal (Argon).
 * Rendert Portal-Startseite, Handbuch-Übersicht, Komponentenreferenz (128 COMP),
 * Feature-Katalog (12 FEAT + Fachartikel), Architektur-Doku und Entwicklerreferenz
 * inkl. vollständiger Integration der SWE-2-Wissensbasis (688 Entities, 1.774 Chunks).
 */
(function () {
  'use strict';

  const SWE2 = window.ArgonSwe2Adapter;

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function statusPill(value, axis) {
    const v = String(value || '').toLowerCase();
    let cls = 'hb-status-info';
    if (v.includes('implementiert') || v.includes('geprüft') || v.includes('freigegeben') || v.includes('erfolgreich') || v.includes('aktuell')) {
      cls = 'hb-status-ok';
    } else if (v.includes('entwurf') || v.includes('vorhanden') || v.includes('experimentell') || v.includes('geplant')) {
      cls = 'hb-status-warn';
    } else if (v.includes('fehlgeschlagen') || v.includes('nicht getestet') || v.includes('veraltet')) {
      cls = 'hb-status-danger';
    }
    const prefix = axis ? `<span style="opacity:0.75">${esc(axis)}:</span> ` : '';
    return `<span class="hb-status-pill ${cls}">${prefix}${esc(value || '—')}</span>`;
  }

  // 1. PORTAL-STARTSEITE (#home)
  function renderPortalHome(data, state, helpers) {
    const c = data.meta.counts;
    const doneCount = data.handbook.chapters.filter(ch => helpers.isChapterDone(ch)).length;
    const nextChap = data.handbook.chapters.find(ch => !helpers.isChapterDone(ch)) || data.handbook.chapters[0];

    return `
      <div class="hb-hero-card">
        <div class="hb-hero-badge">GCS Documentation Portal · Argon Edition · SWE-2 Knowledge Integrated</div>
        <h1 class="hb-hero-title">Willkommen in der zentralen GCS-Wissensplattform</h1>
        <p class="hb-hero-lead">
          Von den ersten interaktiven Schritten ohne Programmierkenntnisse bis zur verifizierten SWE-2-Referenz über
          alle <strong>${c.components} Komponenten</strong>, <strong>${c.features} System-Features</strong>,
          <strong>${c.actions} Runtime-Actions</strong>, <strong>${c.methods} Methoden</strong>, <strong>${c.events} Events</strong> und <strong>${c.swe2EntitiesTotal} verknüpfte Entities</strong>.
        </p>

        <div class="hb-hero-stats">
          <a href="#handbook" class="hb-stat-card" style="text-decoration:none">
            <div class="hb-stat-value">${c.handbookChapters}</div>
            <div class="hb-stat-label">📖 Handbuch-Kapitel (${doneCount}/${c.handbookChapters} erledigt)</div>
          </a>
          <a href="#components" class="hb-stat-card" style="text-decoration:none">
            <div class="hb-stat-value">${c.components}</div>
            <div class="hb-stat-label">🧩 GCS-Komponenten (${c.componentCategories} Kategorien)</div>
          </a>
          <a href="#features" class="hb-stat-card" style="text-decoration:none">
            <div class="hb-stat-value">${c.features} + ${c.featureArticles}</div>
            <div class="hb-stat-label">✨ Kern-Features &amp; Fachartikel</div>
          </a>
          <a href="#devref/actions" class="hb-stat-card" style="text-decoration:none">
            <div class="hb-stat-value">${c.actions}</div>
            <div class="hb-stat-label">⚡ Action-Typen (ACT-0001…0059)</div>
          </a>
          <a href="#devref/methods" class="hb-stat-card" style="text-decoration:none">
            <div class="hb-stat-value">${c.methods} / ${c.events}</div>
            <div class="hb-stat-label">🔧 Methoden &amp; 🔔 Events (SWE-2)</div>
          </a>
          <a href="#devref/swe2-interface" class="hb-stat-card" style="text-decoration:none">
            <div class="hb-stat-value">${c.swe2ChunksTotal}</div>
            <div class="hb-stat-label">🔍 Semantische Such-Chunks (SWE-2)</div>
          </a>
        </div>

        <div class="hb-hero-actions">
          <a href="#handbook/${esc(nextChap.id)}" class="hb-primary-btn" style="text-decoration:none">
            ▶ Handbuch fortsetzen (${esc(nextChap.num)}: ${esc(nextChap.shortTitle)})
          </a>
          <div style="font-size:0.82rem;color:var(--text-muted)">
            Tipp: Drücke jederzeit <kbd class="hb-kbd">Strg K</kbd> oder <kbd class="hb-kbd">/</kbd> für die globale Suche über alle ${c.searchEntries} Einträge (${c.swe2ChunksTotal} SWE-2-Chunks).
          </div>
        </div>
      </div>

      <section class="hb-part-section">
        <div class="hb-part-header">
          <span class="hb-part-badge">Einstieg nach Rolle</span>
          <div>
            <h2 class="hb-part-title">Für wen ist welcher Bereich gedacht?</h2>
            <p class="hb-part-sub">Wähle deinen Einstiegspunkt passend zu deinem Vorhaben in GCS</p>
          </div>
        </div>
        <div class="hb-card-grid">
          <a href="#handbook" class="hb-card">
            <div>
              <div class="hb-card-top">
                <span class="hb-card-num">🌱 EINSTEIGER &amp; AUTOREN</span>
                <span class="hb-card-status">GUIDE-0001…0023</span>
              </div>
              <h3 class="hb-card-title">Autoren-Handbuch (Teil A &amp; B)</h3>
              <p class="hb-card-goal">Schritt für Schritt ohne Vorwissen vom ersten Baum-Sprite über Variablen, Tasks und Bedingungen bis zur kompletten Lernwelt mit Baumhaus und Drag &amp; Drop.</p>
            </div>
            <div class="hb-card-meta"><span>✅ Interaktive Checklisten</span><span>🎙️ Sprecher-Drehbücher</span></div>
          </a>

          <a href="#components" class="hb-card">
            <div>
              <div class="hb-card-top">
                <span class="hb-card-num">🧩 SPIELENTWICKLER</span>
                <span class="hb-card-status">COMP-0001…0128</span>
              </div>
              <h3 class="hb-card-title">Komponentenreferenz &amp; Action-Katalog</h3>
              <p class="hb-card-goal">Nachschlagewerk für alle ${c.components} Komponenten (<code>TSprite</code>, <code>TButton</code>, <code>TTimer</code> …) mit SWE-2-verifizierten Eigenschaften, Events (<code>EVT-####</code>), Methoden (<code>MTH-####</code>) und Vererbung.</p>
            </div>
            <div class="hb-card-meta"><span>🔎 Filter nach 11 Kategorien</span><span>✔ Provenance-Badges</span></div>
          </a>

          <a href="#architecture" class="hb-card hb-card-part-b">
            <div>
              <div class="hb-card-top">
                <span class="hb-card-num">⚙️ SYSTEM- &amp; KI-ENTWICKLER</span>
                <span class="hb-card-status">688 SWE-2 Entities</span>
              </div>
              <h3 class="hb-card-title">Architektur, Features &amp; Entwicklerreferenz</h3>
              <p class="hb-card-goal">Schichtenmodell, Modulkarte, Ausführungsfluss, Feature-Inventar (<code>FEAT-0001</code>…<code>0012</code>), Schemas (<code>SCM-0001</code>…<code>0013</code>), Konzepte (<code>CON-0001</code>…<code>0015</code>) &amp; SWE-2-Wissensbasis.</p>
            </div>
            <div class="hb-card-meta"><span>🏛️ Code-verifiziert</span><span>🤖 SWE-2 Integrated</span></div>
          </a>
        </div>
      </section>

      <section class="hb-part-section">
        <div class="hb-part-header">
          <span class="hb-part-badge hb-part-badge-b">Alle 6 Bereiche</span>
          <div>
            <h2 class="hb-part-title">Direktzugriff auf die Dokumentationsbereiche</h2>
            <p class="hb-part-sub">Alle Inhalte werden über <code>build-argon.cjs</code> und <code>import-swe2-argon.cjs</code> konsolidiert</p>
          </div>
        </div>
        <div class="hb-card-grid">
          <a href="#handbook" class="hb-card">
            <div>
              <div class="hb-card-top"><span class="hb-card-num">📖 BEREICH 1</span><span>${c.handbookChapters} Kapitel</span></div>
              <h3 class="hb-card-title">Autoren-Handbuch (GUIDE-0001…0023)</h3>
              <p class="hb-card-goal">15 Kapitel Teil A („Mein erster interaktiver Baum“) und 8 Kapitel Teil B („Der wachsende Baum“).</p>
            </div>
            <div class="hb-card-meta"><span>Quelle: docs/user-guide/ &amp; guide-chapters-swe2.json</span></div>
          </a>
          <a href="#components" class="hb-card">
            <div>
              <div class="hb-card-top"><span class="hb-card-num">🧩 BEREICH 2</span><span>${c.components} Komponenten</span></div>
              <h3 class="hb-card-title">Komponentenreferenz (COMP-0001…0128)</h3>
              <p class="hb-card-goal">128 SWE-2-Entities kombiniert mit ${c.componentCardsMd} Markdown-Referenzkarten, Schema-Defaults, Events und Methoden.</p>
            </div>
            <div class="hb-card-meta"><span>Quelle: components-swe2.json &amp; docs/reference/</span></div>
          </a>
          <a href="#features" class="hb-card">
            <div>
              <div class="hb-card-top"><span class="hb-card-num">✨ BEREICH 3</span><span>${c.features} Features</span></div>
              <h3 class="hb-card-title">Feature-Katalog (FEAT-0001…0012)</h3>
              <p class="hb-card-goal">12 inventarisierte System-Features und ${c.featureArticles} vertiefende Fachartikel inkl. Provenance- und Status-Kennzeichnung.</p>
            </div>
            <div class="hb-card-meta"><span>Quelle: features-swe2.json &amp; docs/features/</span></div>
          </a>
          <a href="#architecture" class="hb-card">
            <div>
              <div class="hb-card-top"><span class="hb-card-num">🏛️ BEREICH 4</span><span>${c.architectureDocs} Dokumente</span></div>
              <h3 class="hb-card-title">Architektur-Dokumentation</h3>
              <p class="hb-card-goal">Systemübersicht, Modulkarte aller Code-Verzeichnisse und Laufzeit-Ausführungsfluss.</p>
            </div>
            <div class="hb-card-meta"><span>Quelle: docs/architecture/</span></div>
          </a>
          <a href="#devref" class="hb-card">
            <div>
              <div class="hb-card-top"><span class="hb-card-num">🛠️ BEREICH 5</span><span>${c.actions} ACT · ${c.methods} MTH · ${c.events} EVT</span></div>
              <h3 class="hb-card-title">Entwicklerreferenz &amp; SWE-2-Kataloge</h3>
              <p class="hb-card-goal">Action-Typen, Methoden, Events, JSON-Schemas, Domänenkonzepte, Dokumenten-Inventar &amp; Technical Debt.</p>
            </div>
            <div class="hb-card-meta"><span>Quelle: docs/gcs-knowledge-swe2/entities/</span></div>
          </a>
          <a href="#devref/swe2-interface" class="hb-card hb-card-part-b">
            <div>
              <div class="hb-card-top"><span class="hb-card-num">🤝 BEREICH 6</span><span>Schema v${esc(data.meta.swe2Integration?.schemaVersion || '1.1.0')} aktiv</span></div>
              <h3 class="hb-card-title">SWE-2 Wissensbasis-Integration</h3>
              <p class="hb-card-goal">${c.swe2EntitiesTotal} Entities in 9 Typen und ${c.swe2ChunksTotal} Chunks vollständig verknüpft (0 unauflösbare Relationen).</p>
            </div>
            <div class="hb-card-meta"><span>SCHNITTSTELLE-ARGON.md erfüllt</span></div>
          </a>
        </div>
      </section>
    `;
  }

  // 2. HANDBUCH-ÜBERSICHT (#handbook)
  function renderHandbookOverview(data, state, helpers) {
    const chapters = data.handbook.chapters;
    const total = chapters.length;
    const done = chapters.filter(ch => helpers.isChapterDone(ch)).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const totalChecks = chapters.reduce((acc, c) => acc + c.checklists.length, 0);
    const doneChecks = chapters.reduce((acc, c) => acc + c.checklists.filter(chk => state.checkedItems[chk.id]).length, 0);
    const nextChap = chapters.find(c => !helpers.isChapterDone(c)) || chapters[0];
    const filter = state.activeFilter || 'all';

    const renderCard = (c) => {
      const isDone = helpers.isChapterDone(c);
      const chkDone = c.checklists.filter(chk => state.checkedItems[chk.id]).length;
      const chkTotal = c.checklists.length;
      return `
        <a href="#handbook/${esc(c.id)}" class="hb-card ${c.part === 'B' ? 'hb-card-part-b' : ''} ${isDone ? 'is-done' : ''}">
          <div>
            <div class="hb-card-top">
              <span class="hb-card-num">KAPITEL ${esc(c.num)} · ${esc(c.guideId || '')}</span>
              <span class="hb-card-status">${isDone ? '✔ Erledigt' : (chkTotal > 0 ? `${chkDone}/${chkTotal} Checks` : 'Offen')}</span>
            </div>
            <h3 class="hb-card-title">${esc(c.shortTitle)}</h3>
            <p class="hb-card-goal">${esc(c.learningGoal || c.title)}</p>
          </div>
          <div class="hb-card-meta">
            <span>📸 ${c.screenshots.length}</span>
            <span>✅ ${chkTotal} Checks</span>
            ${c.mediaSection ? '<span>🎙️ Drehbuch</span>' : ''}
          </div>
        </a>
      `;
    };

    const listA = chapters.filter(c => c.part === 'A' && (filter === 'all' || filter === 'A' || (filter === 'open' && !helpers.isChapterDone(c))));
    const listB = chapters.filter(c => c.part === 'B' && (filter === 'all' || filter === 'B' || (filter === 'open' && !helpers.isChapterDone(c))));

    return `
      <div class="hb-hero-card">
        <div class="hb-hero-badge">GCS Autoren-Handbuch · 23 Kapitel (GUIDE-0001 bis GUIDE-0023)</div>
        <h1 class="hb-hero-title">Interaktive Spiele und Lernwelten entwickeln</h1>
        <p class="hb-hero-lead">Schritt für Schritt ohne Programmierkenntnisse — mit interaktiven Checklisten, deutschen Sprecher-Drehbüchern und verknüpften SWE-2-Komponenten.</p>

        <div class="hb-hero-stats">
          <div class="hb-stat-card"><div class="hb-stat-value">${total}</div><div class="hb-stat-label">Kapitel gesamt (15 Teil A · 8 Teil B)</div></div>
          <div class="hb-stat-card"><div class="hb-stat-value">${done} / ${total}</div><div class="hb-stat-label">Kapitel abgeschlossen</div></div>
          <div class="hb-stat-card"><div class="hb-stat-value">${doneChecks} / ${totalChecks}</div><div class="hb-stat-label">Checklisten-Punkte abgehakt</div></div>
          <div class="hb-stat-card"><div class="hb-stat-value">${pct}%</div><div class="hb-stat-label">Gesamtfortschritt</div></div>
        </div>

        <div class="hb-hero-actions">
          <a href="#handbook/${esc(nextChap.id)}" class="hb-primary-btn" style="text-decoration:none">
            ▶ ${done === 0 ? `Mit Kapitel A1 starten` : `Weiterlesen: ${nextChap.num} — ${nextChap.shortTitle}`}
          </a>
          <div class="hb-filter-pills" role="tablist">
            <button type="button" class="hb-filter-pill ${filter === 'all' ? 'is-active' : ''}" data-hb-filter="all">Alle (23)</button>
            <button type="button" class="hb-filter-pill ${filter === 'A' ? 'is-active' : ''}" data-hb-filter="A">Teil A: Einsteiger (15)</button>
            <button type="button" class="hb-filter-pill ${filter === 'B' ? 'is-active' : ''}" data-hb-filter="B">Teil B: Lernwelt (8)</button>
            <button type="button" class="hb-filter-pill ${filter === 'open' ? 'is-active' : ''}" data-hb-filter="open">Noch offen</button>
          </div>
        </div>
      </div>

      ${filter !== 'B' ? `
      <section class="hb-part-section">
        <div class="hb-part-header">
          <span class="hb-part-badge">Teil A</span>
          <div>
            <h2 class="hb-part-title">„Mein erster interaktiver Baum“ (Kapitel 1–15 · GUIDE-0001…0015)</h2>
            <p class="hb-part-sub">Für absolute Einsteiger — vom ersten Klick im Editor bis zum fertigen Mini-Spiel</p>
          </div>
        </div>
        <div class="hb-card-grid">${listA.map(renderCard).join('') || '<p class="hb-muted">Keine Kapitel für diesen Filter.</p>'}</div>
      </section>` : ''}

      ${filter !== 'A' ? `
      <section class="hb-part-section">
        <div class="hb-part-header">
          <span class="hb-part-badge hb-part-badge-b">Teil B</span>
          <div>
            <h2 class="hb-part-title">„Der wachsende Baum“ (Kapitel B1–B8 · GUIDE-0016…0023)</h2>
            <p class="hb-part-sub">Vom ersten Baum zur mehrstufigen Lernwelt mit Aufgaben-Stage, Baumhaus, Drag &amp; Drop und Zufallsfragen</p>
          </div>
        </div>
        <div class="hb-card-grid">${listB.map(renderCard).join('') || '<p class="hb-muted">Keine Kapitel für diesen Filter.</p>'}</div>
      </section>` : ''}
    `;
  }

  // 3. KOMPONENTENREFERENZ — KATALOG (#components)
  function renderComponentsCatalog(data, uiState) {
    const items = data.components.items;
    const cats = data.components.categories;
    const catFilter = uiState.compCategory || 'all';
    const statusFilter = uiState.compStatus || 'all';
    const q = (uiState.compQuery || '').trim().toLowerCase();

    const filtered = items.filter(c => {
      if (catFilter !== 'all' && c.categoryKey !== catFilter) return false;
      if (statusFilter === 'curated' && !c.isCurated) return false;
      if (statusFilter === 'used' && c.usageCount <= 0 && c.usedInChapters.length === 0) return false;
      if (statusFilter === 'handbook' && c.usedInChapters.length === 0) return false;
      if (statusFilter === 'geplant' && c.devStatus !== 'geplant' && c.devStatus !== 'veraltet') return false;
      if (statusFilter === 'verified' && c.confidence !== 'verified') return false;
      if (statusFilter === 'documented' && c.confidence !== 'documented') return false;
      if (statusFilter === 'inferred' && c.confidence !== 'inferred') return false;
      if (q) {
        const hay = `${c.name} ${c.id} ${c.categoryLabel} ${c.summary} ${c.devStatus} ${c.confidence} ${c.properties.map(p => p.name).join(' ')} ${c.events.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const plannedCount = items.filter(x => x.devStatus === 'geplant' || x.devStatus === 'veraltet').length;
    const verifiedCount = items.filter(x => x.confidence === 'verified').length;
    const documentedCount = items.filter(x => x.confidence === 'documented').length;
    const inferredCount = items.filter(x => x.confidence === 'inferred').length;

    return `
      <div class="hb-hero-card">
        <div class="hb-hero-badge">Komponentenreferenz · ${items.length} SWE-2-Komponenten (COMP-0001…0128)</div>
        <h1 class="hb-hero-title">Alle Bausteine der GCS-Plattform</h1>
        <p class="hb-hero-lead">
          Vollständiges Verzeichnis aller <strong>${items.length} Komponenten</strong> aus <code>entities/components-swe2.json</code>
          mit Kategorien, Schema-Eigenschaften, Events (<code>EVT-####</code>), Methoden (<code>MTH-####</code>), Provenance-Level und Handbuch-Verweisen.
        </p>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
          <input
            type="search"
            id="comp-catalog-search"
            value="${esc(uiState.compQuery || '')}"
            placeholder="Komponente, COMP-ID, Eigenschaft oder Event filtern (z. B. TSprite, COMP-0097, onCollision, velocityX)…"
            style="flex:1;min-width:240px;padding:9px 14px;border-radius:8px;border:1px solid var(--border-strong);background:var(--bg-app);color:var(--text-primary);font-size:0.9rem"
          />
          <select id="comp-status-select" style="padding:9px 12px;border-radius:8px;border:1px solid var(--border-strong);background:var(--bg-app);color:var(--text-primary);font-size:0.85rem">
            <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>Alle Komponenten (${items.length})</option>
            <option value="handbook" ${statusFilter === 'handbook' ? 'selected' : ''}>Im Autoren-Handbuch genutzt (${items.filter(x => x.usedInChapters.length > 0).length})</option>
            <option value="used" ${statusFilter === 'used' ? 'selected' : ''}>In Spielprojekten verwendet (${items.filter(x => x.usageCount > 0).length})</option>
            <option value="curated" ${statusFilter === 'curated' ? 'selected' : ''}>Kuratierte Referenzkarten (${items.filter(x => x.isCurated).length})</option>
            <option value="verified" ${statusFilter === 'verified' ? 'selected' : ''}>✔ Verifiziert / verified (${verifiedCount})</option>
            <option value="documented" ${statusFilter === 'documented' ? 'selected' : ''}>📄 Dokumentiert / documented (${documentedCount})</option>
            ${plannedCount > 0 ? `<option value="geplant" ${statusFilter === 'geplant' ? 'selected' : ''}>🚧 Geplant / Veraltet (${plannedCount})</option>` : ''}
            ${inferredCount > 0 ? `<option value="inferred" ${statusFilter === 'inferred' ? 'selected' : ''}>⚠️ Nicht verifiziert / inferred (${inferredCount})</option>` : ''}
          </select>
        </div>

        <div class="hb-filter-pills" role="tablist">
          <button type="button" class="hb-filter-pill ${catFilter === 'all' ? 'is-active' : ''}" data-comp-cat="all">Alle Kategorien (${items.length})</button>
          ${cats.map(cat => `
            <button type="button" class="hb-filter-pill ${catFilter === cat.id ? 'is-active' : ''}" data-comp-cat="${esc(cat.id)}">
              ${cat.icon} ${esc(cat.label)} (${cat.count})
            </button>
          `).join('')}
        </div>
      </div>

      <div style="margin-bottom:14px;font-size:0.85rem;color:var(--text-muted)">
        Zeige <strong>${filtered.length}</strong> von ${items.length} Komponenten
      </div>

      <div class="hb-card-grid">
        ${filtered.map(c => {
          const descConf = c.provenance?.facts?.description || c.confidence;
          const propConf = c.provenance?.facts?.properties || c.confidence;
          const hasMixedConfidence = c.confidence === 'verified' && (descConf !== 'verified' || propConf !== 'verified');
          return `
          <a href="#components/${esc(c.name)}" class="hb-card ${c.isCurated ? 'is-done' : ''}">
            <div>
              <div class="hb-card-top">
                <span class="hb-card-num">${esc(c.id)} · ${c.categoryIcon} ${esc(c.categoryLabel)}</span>
                <span class="hb-card-status">${c.devStatus !== 'implementiert' ? SWE2.devStatusBadge(c.devStatus) : (c.isCurated ? '⭐ Kuratiert' : '✔ implementiert')}</span>
              </div>
              <h3 class="hb-card-title">${esc(c.name)}</h3>
              <p class="hb-card-goal">${esc(c.summary || 'GCS-Komponente')}</p>
            </div>
            <div class="hb-card-meta">
              <span>⚙️ ${c.properties.length} Props</span>
              <span>🔔 ${c.events.length} Events</span>
              ${(c.methods && c.methods.length > 0) ? `<span>🔧 ${c.methods.length} Meth.</span>` : ''}
              ${SWE2.confidencePillCompact(c.confidence)}
              ${hasMixedConfidence ? `<span class="hb-status-pill hb-status-info" title="provenance.confidence = max(facts); Beschreibung=${esc(descConf)}, Props=${esc(propConf)}">📄 Doku: ${esc(descConf)}</span>` : ''}
            </div>
          </a>
        `;
        }).join('') || '<p class="hb-muted">Keine Komponenten für diesen Filter gefunden.</p>'}
      </div>
    `;
  }

  // 4. KOMPONENTENREFERENZ — DETAILANSICHT (#components/<TName>)
  function renderComponentDetail(comp, data) {
    const inhLinks = (comp.inheritanceChain || [comp.name]).map(name => {
      if (name === comp.name) return `<strong><code>${esc(name)}</code></strong>`;
      return `<a href="#components/${esc(name)}" class="hb-code hb-comp-ref">${esc(name)}</a>`;
    }).join(' → ');

    const chapLinks = comp.usedInChapters.length > 0
      ? comp.usedInChapters.map(ch => `<a href="#handbook/${esc(ch.id)}" class="hb-comp-tag">📖 ${esc(ch.num)}: ${esc(ch.shortTitle)}</a>`).join(' ')
      : '<span class="hb-muted">In keinem Einsteiger-Kapitel direkt referenziert</span>';

    const relCompLinks = comp.relatedComponents.length > 0
      ? comp.relatedComponents.map(name => `<a href="#components/${esc(name)}" class="hb-comp-tag">🧩 ${esc(name)}</a>`).join(' ')
      : '<span class="hb-muted">—</span>';

    const relFeatLinks = comp.relatedFeatures.length > 0
      ? comp.relatedFeatures.map(f => `<a href="#features/${esc(f.id)}" class="hb-comp-tag">✨ ${esc(f.id)}: ${esc(f.name)}</a>`).join(' ')
      : '';

    return `
      <header class="hb-chapter-header">
        <div class="hb-chapter-breadcrumb">
          <a href="#home" class="hb-crumb-link">Portal</a>
          <span>›</span>
          <a href="#components" class="hb-crumb-link">Komponentenreferenz</a>
          <span>›</span>
          <span>${comp.categoryIcon} ${esc(comp.categoryLabel)}</span>
          <span>›</span>
          <span class="hb-badge-num">${esc(comp.id)}</span>
        </div>

        <div class="hb-chapter-title-row">
          <h1 class="hb-h1">${esc(comp.name)}</h1>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${SWE2.devStatusBadge(comp.devStatus, 'Dev')}
            ${statusPill(comp.testStatus, 'Test')}
            ${statusPill(comp.docStatus, 'Doku')}
            ${SWE2.confidenceBadge(comp.confidence)}
          </div>
        </div>

        <div class="hb-spec-grid">
          <div class="hb-spec-item">
            <span class="hb-spec-label">SWE-2 Entity-ID &amp; Kategorie</span>
            <span class="hb-spec-val"><code>${esc(comp.id)}</code> · ${comp.categoryIcon} ${esc(comp.categoryLabel)}</span>
          </div>
          <div class="hb-spec-item">
            <span class="hb-spec-label">Vererbungskette</span>
            <span class="hb-spec-val">${inhLinks}</span>
          </div>
          <div class="hb-spec-item">
            <span class="hb-spec-label">Registrierung</span>
            <span class="hb-spec-val">Editor: ${comp.registered?.editor ? '✔' : '—'} · Runtime: ${comp.registered?.runtime ? '✔' : '—'}</span>
          </div>
          <div class="hb-spec-item">
            <span class="hb-spec-label">Quelldatei &amp; Schema</span>
            <span class="hb-spec-val"><code>${esc((comp.sources && comp.sources[0]) || '—')}</code>${comp.schemaFile ? `<br/><small class="hb-muted">${esc(comp.schemaFile)}</small>` : ''}</span>
          </div>
          <div class="hb-spec-item">
            <span class="hb-spec-label">Projekt-Verwendung</span>
            <span class="hb-spec-val">${comp.usageCount > 0 ? `In ${comp.usageCount} mitgelieferten Projekten` : 'Basis-/Spezialbaustein'}</span>
          </div>
        </div>

        <div style="display:grid;gap:8px;margin-top:8px">
          <div class="hb-comp-row"><strong style="font-size:0.78rem;color:var(--text-muted)">Handbuch-Kapitel:</strong> ${chapLinks}</div>
          <div class="hb-comp-row"><strong style="font-size:0.78rem;color:var(--text-muted)">Verwandte Komponenten:</strong> ${relCompLinks}</div>
          ${relFeatLinks ? `<div class="hb-comp-row"><strong style="font-size:0.78rem;color:var(--text-muted)">Zugehörige Features:</strong> ${relFeatLinks}</div>` : ''}
        </div>
      </header>

      <div class="hb-prose">
        ${SWE2.renderComponentSwe2Section(comp)}
        <h2 id="referenzkarte-md" class="hb-h2">Ausführliche Referenzkarte &amp; Beispiele</h2>
        ${comp.htmlContent}
      </div>

      <footer class="hb-chapter-footer">
        <nav class="hb-prev-next">
          <a href="#components" class="hb-pn-card hb-pn-prev">
            <span class="hb-pn-dir">← Übersicht</span>
            <strong class="hb-pn-title">Alle ${data.components.items.length} Komponenten</strong>
          </a>
          <a href="#devref/actions" class="hb-pn-card hb-pn-next">
            <span class="hb-pn-dir">Weiterführend →</span>
            <strong class="hb-pn-title">59 Runtime-Actions durchsuchen</strong>
          </a>
        </nav>
      </footer>
    `;
  }

  // 5. FEATURE-KATALOG (#features)
  function renderFeaturesCatalog(data, uiState) {
    const feats = data.features.inventory;
    const articles = data.features.articles;
    const catFilter = uiState.featCategory || 'all';
    const cats = Array.from(new Set(feats.map(f => f.category)));
    const filteredFeats = feats.filter(f => catFilter === 'all' || f.category === catFilter);

    return `
      <div class="hb-hero-card">
        <div class="hb-hero-badge">Feature-Katalog · ${feats.length} SWE-2-Features (FEAT-0001…0012) &amp; ${articles.length} Fachartikel</div>
        <h1 class="hb-hero-title">Funktionsbereiche der GCS-Plattform</h1>
        <p class="hb-hero-lead">
          Maschinenlesbar verifizierte Haupt-Features (<code>FEAT-0001</code> bis <code>FEAT-0012</code>) aus
          <code>entities/features-swe2.json</code> sowie die detaillierten Fachspezifikationen aus <code>docs/features/</code>.
        </p>

        <div class="hb-filter-pills" role="tablist">
          <button type="button" class="hb-filter-pill ${catFilter === 'all' ? 'is-active' : ''}" data-feat-cat="all">Alle Features (${feats.length})</button>
          ${cats.map(cat => `
            <button type="button" class="hb-filter-pill ${catFilter === cat ? 'is-active' : ''}" data-feat-cat="${esc(cat)}">
              ${esc(cat.toUpperCase())} (${feats.filter(x => x.category === cat).length})
            </button>
          `).join('')}
        </div>
      </div>

      <section class="hb-part-section">
        <div class="hb-part-header">
          <span class="hb-part-badge">SWE-2 Inventar</span>
          <div>
            <h2 class="hb-part-title">Die 12 übergeordneten GCS-Features (FEAT-0001 bis FEAT-0012)</h2>
            <p class="hb-part-sub">Geprüft gegen Quellcode, Tests und Laufzeit — inkl. Provenance-Level und aufgelösten Relationen</p>
          </div>
        </div>
        <div class="hb-card-grid">
          ${filteredFeats.map(f => `
            <a href="#features/${esc(f.id)}" class="hb-card">
              <div>
                <div class="hb-card-top">
                  <span class="hb-card-num">${esc(f.id)} · ${esc(f.category.toUpperCase())}</span>
                  <span class="hb-card-status">${SWE2.devStatusBadge(f.devStatus)}</span>
                </div>
                <h3 class="hb-card-title">${esc(f.name)}</h3>
                <p class="hb-card-goal">${esc(f.summary)}</p>
              </div>
              <div class="hb-card-meta">
                <span>📂 ${(f.sources || []).length} Quellen</span>
                <span>🧩 ${(f.linkedComponents || []).length} Komp.</span>
                <span>📖 ${(f.linkedChapters || []).length} Kap.</span>
                <span>${f.confidence === 'verified' ? '✔ verified' : esc(f.confidence)}</span>
              </div>
            </a>
          `).join('')}
        </div>
      </section>

      <section class="hb-part-section">
        <div class="hb-part-header">
          <span class="hb-part-badge hb-part-badge-b">Fachartikel</span>
          <div>
            <h2 class="hb-part-title">Vertiefende Feature-Dokumentation (docs/features/)</h2>
            <p class="hb-part-sub">Detailbeschreibungen zu Editor, Flow-Editor, Inspector, Stage-Editor, Runtime, Multiplayer, CMS und Lernwelten</p>
          </div>
        </div>
        <div class="hb-card-grid">
          ${articles.map(a => `
            <a href="#features/${esc(a.id)}" class="hb-card hb-card-part-b">
              <div>
                <div class="hb-card-top">
                  <span class="hb-card-num">${esc(a.docId || a.category)}</span>
                  <span class="hb-card-status">${esc(a.path)}</span>
                </div>
                <h3 class="hb-card-title">${esc(a.title)}</h3>
                <p class="hb-card-goal">${esc(a.summary)}</p>
              </div>
              <div class="hb-card-meta">
                <span>📑 ${a.headings.length} Abschnitte</span>
                <span>🧩 ${a.components.length} Komponenten</span>
              </div>
            </a>
          `).join('')}
        </div>
      </section>
    `;
  }

  // 6. FEATURE-DETAILANSICHT (#features/FEAT-xxxx oder #features/feat-doc-...)
  function renderFeatureDetail(item, isInventoryFeature, data) {
    if (!isInventoryFeature) {
      return renderGenericDocDetail(item, 'features', 'Feature-Katalog', '#features', data.features.articles);
    }

    const compTags = (item.linkedComponents || []).map(c => `<a href="#components/${esc(c)}" class="hb-comp-tag">🧩 ${esc(c)}</a>`).join(' ') || '<span class="hb-muted">—</span>';
    const chapTags = (item.linkedChapters || []).map(ch => `<a href="#handbook/${esc(ch.id)}" class="hb-comp-tag">📖 ${esc(ch.num)}: ${esc(ch.shortTitle)}</a>`).join(' ') || '<span class="hb-muted">—</span>';
    const depTags = (item.dependsOn || []).map(d => `<a href="#features/${esc(d)}" class="hb-comp-tag">🔗 ${esc(d)}</a>`).join(' ') || '<span class="hb-muted">Keine</span>';

    return `
      <header class="hb-chapter-header">
        <div class="hb-chapter-breadcrumb">
          <a href="#home" class="hb-crumb-link">Portal</a>
          <span>›</span>
          <a href="#features" class="hb-crumb-link">Feature-Katalog</a>
          <span>›</span>
          <span class="hb-badge-num">${esc(item.id)}</span>
        </div>

        <div class="hb-chapter-title-row">
          <h1 class="hb-h1">${esc(item.id)}: ${esc(item.name)}</h1>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${SWE2.devStatusBadge(item.devStatus, 'Dev')}
            ${statusPill(item.testStatus, 'Test')}
            ${statusPill(item.docStatus, 'Doku')}
            ${SWE2.confidenceBadge(item.confidence)}
          </div>
        </div>

        <div class="hb-spec-grid">
          <div class="hb-spec-item"><span class="hb-spec-label">Kategorie</span><span class="hb-spec-val">${esc(item.category.toUpperCase())}</span></div>
          <div class="hb-spec-item"><span class="hb-spec-label">Abhängigkeiten (dependsOn)</span><span class="hb-spec-val">${depTags}</span></div>
          <div class="hb-spec-item"><span class="hb-spec-label">Provenance / Commit</span><span class="hb-spec-val">${esc(item.confidence)} · Commit <code>${esc(item.commit || '53e3dfb')}</code></span></div>
          <div class="hb-spec-item"><span class="hb-spec-label">Geprüft am / durch</span><span class="hb-spec-val">${esc(item.lastChecked || '—')} · ${esc(item.checkedBy || '—')}</span></div>
        </div>
      </header>

      <div class="hb-prose">
        ${SWE2.renderContractNoticeBanner(item)}
        ${SWE2.renderProvenanceFactsBar(item.provenance)}

        <div class="hb-callout hb-callout-goal">
          <div class="hb-callout-icon">✨</div>
          <div class="hb-callout-body"><strong>Zusammenfassung:</strong> ${esc(item.summary)}</div>
        </div>

        ${item.notes ? `<div class="hb-callout hb-callout-info"><div class="hb-callout-icon">📝</div><div class="hb-callout-body"><strong>Technische Anmerkung:</strong> ${esc(item.notes)}</div></div>` : ''}

        ${(item.relations && item.relations.length > 0) ? `
          <h2 id="swe2-relationen" class="hb-h2">Aufgelöste SWE-2-Relationen (dependsOn &amp; documentedIn)</h2>
          <div class="hb-comp-row" style="margin-bottom:14px">${SWE2.renderRelationsPills(item.relations)}</div>
        ` : ''}

        <h2 id="quellen-tests" class="hb-h2">Maßgebliche Quelldateien &amp; Tests</h2>
        <div class="hb-table-wrap">
          <table class="hb-table">
            <thead><tr><th>Typ</th><th>Pfad / Referenz</th></tr></thead>
            <tbody>
              ${(item.sources || []).map(s => `<tr><td><span class="hb-status-pill hb-status-info">Quelldatei</span></td><td><code>${esc(s)}</code></td></tr>`).join('')}
              ${(item.tests || []).map(t => `<tr><td><span class="hb-status-pill hb-status-ok">Testskript</span></td><td><code>${esc(t)}</code></td></tr>`).join('')}
              ${(item.relatedDocs || []).map(d => `<tr><td><span class="hb-status-pill hb-status-warn">Verwandtes Dokument</span></td><td><code>${esc(d)}</code></td></tr>`).join('')}
            </tbody>
          </table>
        </div>

        ${(item.testRuns && item.testRuns.length > 0) ? `
          <h2 id="testlaeufe" class="hb-h2">Protokollierte Testläufe</h2>
          <div class="hb-table-wrap">
            <table class="hb-table">
              <thead><tr><th>Befehl</th><th>Datum</th><th>Ergebnis</th><th>Details</th></tr></thead>
              <tbody>
                ${item.testRuns.map(tr => `
                  <tr>
                    <td><code>${esc(tr.command)}</code></td>
                    <td>${esc(tr.date)}</td>
                    <td>${statusPill(tr.result)}</td>
                    <td>${esc(tr.detail)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        ${(item.limitations && item.limitations.length > 0) ? `
          <h2 id="einschraenkungen" class="hb-h2">Dokumentierte Einschränkungen (SWE-2)</h2>
          <ul class="hb-ul">${item.limitations.map(l => `<li>⚠️ ${esc(l)}</li>`).join('')}</ul>
        ` : ''}

        ${(item.openQuestions && item.openQuestions.length > 0) ? `
          <h2 id="offene-fragen" class="hb-h2">Offene Fragen</h2>
          <ul class="hb-ul">${item.openQuestions.map(q => `<li>❓ ${esc(q)}</li>`).join('')}</ul>
        ` : ''}

        <h2 id="querverweise" class="hb-h2">Zugehörige Komponenten &amp; Handbuch-Kapitel</h2>
        <p class="hb-p"><strong>Verknüpfte Komponenten:</strong></p>
        <div class="hb-comp-row" style="margin-bottom:16px">${compTags}</div>
        <p class="hb-p"><strong>Relevante Kapitel im Autoren-Handbuch:</strong></p>
        <div class="hb-comp-row">${chapTags}</div>
      </div>

      <footer class="hb-chapter-footer">
        <nav class="hb-prev-next">
          <a href="#features" class="hb-pn-card hb-pn-prev">
            <span class="hb-pn-dir">← Übersicht</span>
            <strong class="hb-pn-title">Alle 12 Features &amp; Fachartikel</strong>
          </a>
          <a href="#components" class="hb-pn-card hb-pn-next">
            <span class="hb-pn-dir">Weiterführend →</span>
            <strong class="hb-pn-title">Komponentenreferenz (128)</strong>
          </a>
        </nav>
      </footer>
    `;
  }

  // 7. ARCHITEKTUR-ÜBERSICHT (#architecture) & GENERISCHE DOKUMENT-DETAILANSICHT
  function renderArchitectureOverview(data) {
    const docs = data.architecture.articles;
    return `
      <div class="hb-hero-card">
        <div class="hb-hero-badge">Systemarchitektur · ${docs.length} Kanonische Dokumente</div>
        <h1 class="hb-hero-title">GCS Architektur-Dokumentation</h1>
        <p class="hb-hero-lead">
          Quellcode-verifizierte Architektur-Spezifikation: Schichtenmodell, Editor- und Runtime-Zusammenspiel,
          Modulkarte aller Verzeichnisse und detaillierter Ausführungsfluss vom Benutzer-Event bis zur Action.
        </p>
      </div>

      <div class="hb-card-grid">
        ${docs.map(d => `
          <a href="#architecture/${esc(d.id)}" class="hb-card">
            <div>
              <div class="hb-card-top">
                <span class="hb-card-num">${esc(d.docId || d.category)}</span>
                <span class="hb-card-status">${esc(d.path)}</span>
              </div>
              <h3 class="hb-card-title">${esc(d.title)}</h3>
              <p class="hb-card-goal">${esc(d.summary)}</p>
            </div>
            <div class="hb-card-meta">
              <span>📑 ${d.headings.length} Abschnitte</span>
              <span>🧩 ${d.components.length} erwähnte Komponenten</span>
            </div>
          </a>
        `).join('')}
      </div>
    `;
  }

  function renderGenericDocDetail(doc, areaKey, areaLabel, areaHref, siblings) {
    const idx = (siblings || []).findIndex(s => s.id === doc.id);
    const prev = idx > 0 ? siblings[idx - 1] : null;
    const next = idx >= 0 && idx < (siblings || []).length - 1 ? siblings[idx + 1] : null;

    const compTags = (doc.components || []).map(c => `<a href="#components/${esc(c)}" class="hb-comp-tag">🧩 ${esc(c)}</a>`).join(' ');
    const featTags = (doc.features || []).map(f => `<a href="#features/${esc(f)}" class="hb-comp-tag">✨ ${esc(f)}</a>`).join(' ');

    return `
      <header class="hb-chapter-header">
        <div class="hb-chapter-breadcrumb">
          <a href="#home" class="hb-crumb-link">Portal</a>
          <span>›</span>
          <a href="${esc(areaHref)}" class="hb-crumb-link">${esc(areaLabel)}</a>
          <span>›</span>
          <span class="hb-badge-num">${esc(doc.docId || doc.category)}</span>
        </div>

        <div class="hb-chapter-title-row">
          <h1 class="hb-h1">${esc(doc.title)}</h1>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <span class="hb-status-pill hb-status-ok">📄 Quelle: ${esc(doc.path)}</span>
            ${doc.confidence ? SWE2.confidenceBadge(doc.confidence) : ''}
          </div>
        </div>

        ${(compTags || featTags) ? `
          <div class="hb-comp-row">
            <span style="font-size:0.76rem;color:var(--text-muted)">Verknüpfte Elemente:</span>
            ${featTags} ${compTags}
          </div>
        ` : ''}
      </header>

      <div class="hb-prose">
        ${doc.htmlContent}
      </div>

      <footer class="hb-chapter-footer">
        <nav class="hb-prev-next">
          <a href="${prev ? `#${areaKey}/${esc(prev.id)}` : esc(areaHref)}" class="hb-pn-card hb-pn-prev">
            <span class="hb-pn-dir">← ${prev ? 'Vorheriges Dokument' : 'Zurück zur Übersicht'}</span>
            <strong class="hb-pn-title">${esc(prev ? prev.title : areaLabel)}</strong>
          </a>
          <a href="${next ? `#${areaKey}/${esc(next.id)}` : esc(areaHref)}" class="hb-pn-card hb-pn-next">
            <span class="hb-pn-dir">${next ? 'Nächstes Dokument' : 'Übersicht'} →</span>
            <strong class="hb-pn-title">${esc(next ? next.title : areaLabel)}</strong>
          </a>
        </nav>
      </footer>
    `;
  }

  // 8. ENTWICKLERREFERENZ (#devref, #devref/actions, #devref/methods, #devref/events, #devref/schemas, #devref/doc-inventory, #devref/swe2-interface)
  function renderDevRefOverview(data, uiState) {
    const subView = uiState.devSubView || 'overview';
    const articles = data.devref.articles;
    const actions = data.devref.actions;
    const methods = data.devref.methods || [];
    const events = data.devref.events || [];
    const schemas = data.devref.schemas || [];
    const concepts = data.devref.concepts || [];
    const techDebt = data.devref.techDebt;
    const docInv = data.devref.documentInventory;

    if (subView === 'actions') return SWE2.renderActionsCatalog(data, uiState);
    if (subView === 'methods') return SWE2.renderMethodsCatalog(data, uiState);
    if (subView === 'events') return SWE2.renderEventsCatalog(data, uiState);
    if (subView === 'schemas' || subView === 'concepts') return SWE2.renderSchemasAndConcepts(data, uiState);
    if (subView === 'swe2-interface') return SWE2.renderSwe2InterfaceView(data);

    if (subView === 'doc-inventory') {
      const q = (uiState.docInvQuery || '').trim().toLowerCase();
      const ratingFilter = uiState.docInvRating || 'all';
      const filtered = docInv.filter(d => {
        if (ratingFilter === 'canonical' && !d.canonical) return false;
        if (ratingFilter === 'missing' && !d.missing) return false;
        if (ratingFilter !== 'all' && ratingFilter !== 'canonical' && ratingFilter !== 'missing' && d.rating !== ratingFilter) return false;
        if (q && !`${d.id} ${d.file} ${d.title || ''} ${d.type || ''} ${d.note || ''}`.toLowerCase().includes(q)) return false;
        return true;
      });

      return `
        <div class="hb-hero-card">
          <div class="hb-hero-badge">Dokumenten-Inventar · ${docInv.length} SWE-2 Dokumente (DOC-0001…0242)</div>
          <h1 class="hb-hero-title">Gesamtverzeichnis der inventarisierten Dokumente</h1>
          <p class="hb-hero-lead">Quelle: <code>entities/documents-swe2.json</code>. Gelöschte Dateien (<code>missing: true</code>) sind gemäß Datenvertrag explizit markiert und nicht als toter Link klickbar.</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <input type="search" id="devref-docinv-search" value="${esc(uiState.docInvQuery || '')}" placeholder="Nach DOC-ID, Dateipfad oder Anmerkung suchen (z. B. DOC-0117, DOC-0041)…" style="flex:1;min-width:220px;padding:9px 14px;border-radius:8px;border:1px solid var(--border-strong);background:var(--bg-app);color:var(--text-primary)" />
            <select id="devref-docinv-rating" style="padding:9px 12px;border-radius:8px;border:1px solid var(--border-strong);background:var(--bg-app);color:var(--text-primary)">
              <option value="all" ${ratingFilter === 'all' ? 'selected' : ''}>Alle Bewertungen (${docInv.length})</option>
              <option value="canonical" ${ratingFilter === 'canonical' ? 'selected' : ''}>⭐ Kanonisch (${docInv.filter(x => x.canonical).length})</option>
              <option value="aktuell" ${ratingFilter === 'aktuell' ? 'selected' : ''}>Aktuell (${docInv.filter(x => x.rating === 'aktuell').length})</option>
              <option value="möglicherweise veraltet" ${ratingFilter === 'möglicherweise veraltet' ? 'selected' : ''}>Möglicherweise veraltet (${docInv.filter(x => x.rating === 'möglicherweise veraltet').length})</option>
              <option value="missing" ${ratingFilter === 'missing' ? 'selected' : ''}>🗑️ Datei gelöscht / missing (${docInv.filter(x => x.missing).length})</option>
            </select>
          </div>
        </div>
        <div class="hb-table-wrap">
          <table class="hb-table">
            <thead><tr><th>ID</th><th>Datei / Portal-Ansicht</th><th>Typ</th><th>Bewertung &amp; Provenance</th><th>Prüftiefe / Anmerkung</th></tr></thead>
            <tbody>
              ${filtered.map(d => `
                <tr>
                  <td><code>${esc(d.id)}</code></td>
                  <td>
                    ${(!d.missing && d.portalHref) ? `<a href="${esc(d.portalHref)}" class="hb-comp-tag">📄 ${esc(d.file)}</a>` : `<code>${esc(d.file)}</code>`}
                    ${d.canonical ? '<span class="hb-status-pill hb-status-ok">kanonisch</span>' : ''}
                    ${d.missing ? '<span class="hb-status-pill hb-status-danger" title="Datei laut Git-Status gelöscht — kein toter Link">🗑️ Datei gelöscht</span>' : ''}
                  </td>
                  <td>${esc(d.type || '—')}</td>
                  <td>${statusPill(d.rating)} ${SWE2.confidenceBadge(d.confidence)}</td>
                  <td><small>${esc(d.reviewDepth || '')}${d.note ? ` — ${esc(d.note)}` : ''}</small></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // Standard-Übersicht der Entwicklerreferenz (#devref)
    return `
      <div class="hb-hero-card">
        <div class="hb-hero-badge">Entwicklerreferenz · SWE-2 Entities, Actions, Methoden, Events &amp; Qualitätsbefunde</div>
        <h1 class="hb-hero-title">Technische Referenz für GCS- &amp; KI-Entwickler</h1>
        <p class="hb-hero-lead">
          Zentraler Zugriff auf alle <strong>${actions.length} Action-Typen</strong>, <strong>${methods.length} Komponenten-Methoden</strong>,
          <strong>${events.length} Events</strong>, <strong>${schemas.length} JSON-Schemas</strong>, <strong>${concepts.length} Domänenkonzepte</strong>,
          Technical-Debt-Register (${techDebt.length} Befunde) und das Dokumenten-Inventar (${docInv.length} Einträge).
        </p>
      </div>

      <section class="hb-part-section">
        <div class="hb-part-header">
          <span class="hb-part-badge">SWE-2 Register</span>
          <div>
            <h2 class="hb-part-title">Maschinenlesbare SWE-2-Kataloge &amp; Schnittstellen</h2>
            <p class="hb-part-sub">Direkt aus <code>docs/gcs-knowledge-swe2/entities/</code> importierte Spezialansichten</p>
          </div>
        </div>
        <div class="hb-card-grid">
          <a href="#devref/actions" class="hb-card">
            <div>
              <div class="hb-card-top"><span class="hb-card-num">⚡ ACT-0001…0059</span><span>${actions.length} Actions</span></div>
              <h3 class="hb-card-title">Runtime-Action-Katalog</h3>
              <p class="hb-card-goal">Alle ${actions.length} Action-Typen mit Parametern, Flags (<code>hidden</code>, <code>isAlias</code>) und Provenance aus <code>actions-swe2.json</code>.</p>
            </div>
            <div class="hb-card-meta"><span>🔎 Mit Parameter- &amp; Flag-Suche</span></div>
          </a>
          <a href="#devref/methods" class="hb-card">
            <div>
              <div class="hb-card-top"><span class="hb-card-num">🔧 MTH-0001…0038</span><span>${methods.length} Methoden</span></div>
              <h3 class="hb-card-title">Komponenten-Methoden</h3>
              <p class="hb-card-goal">Alle ${methods.length} aufrufbaren Laufzeit-Methoden mit Signatur und verknüpfter Komponente (<code>COMP-####</code>).</p>
            </div>
            <div class="hb-card-meta"><span>Quelle: methods-swe2.json</span></div>
          </a>
          <a href="#devref/events" class="hb-card">
            <div>
              <div class="hb-card-top"><span class="hb-card-num">🔔 EVT-0001…0163</span><span>${events.length} Events</span></div>
              <h3 class="hb-card-title">Event-Katalog</h3>
              <p class="hb-card-goal">Alle ${events.length} Komponenten-Ereignisse (<code>onClick</code>, <code>onCollision</code> …) inkl. Standard-Events.</p>
            </div>
            <div class="hb-card-meta"><span>Quelle: events-swe2.json</span></div>
          </a>
          <a href="#devref/schemas" class="hb-card">
            <div>
              <div class="hb-card-top"><span class="hb-card-num">📐 SCM &amp; CON</span><span>${schemas.length} Schemas · ${concepts.length} Konzepte</span></div>
              <h3 class="hb-card-title">JSON-Schemas &amp; Domänenkonzepte</h3>
              <p class="hb-card-goal">13 Komponenten-Schemas (<code>SCM-0001…0013</code>) und 15 zentrale GCS-Domänenkonzepte (<code>CON-0001…0015</code>).</p>
            </div>
            <div class="hb-card-meta"><span>Quelle: schemas-swe2.json &amp; concepts-swe2.json</span></div>
          </a>
          <a href="#devref/doc-inventory" class="hb-card">
            <div>
              <div class="hb-card-top"><span class="hb-card-num">🗂️ DOC-0001…0242</span><span>${docInv.length} Dokumente</span></div>
              <h3 class="hb-card-title">Dokumenten-Inventar</h3>
              <p class="hb-card-goal">Bewertungstabelle aller 242 Bestandsdokumente nach Aktualität, Kanonizität und <code>missing</code>-Status.</p>
            </div>
            <div class="hb-card-meta"><span>⭐ Kanonisch- &amp; Missing-Filter</span></div>
          </a>
          <a href="#devref/swe2-interface" class="hb-card hb-card-part-b">
            <div>
              <div class="hb-card-top"><span class="hb-card-num">🤝 SWE-2 VERTRAG</span><span>${data.meta.counts.swe2EntitiesTotal} Entities · ${data.meta.counts.swe2ChunksTotal} Chunks</span></div>
              <h3 class="hb-card-title">SWE-2 Wissensbasis-Status</h3>
              <p class="hb-card-goal">Live-Übersicht der integrierten SWE-2-Wissensbasis gemäß <code>SCHNITTSTELLE-ARGON.md</code>.</p>
            </div>
            <div class="hb-card-meta"><span>0 unauflösbare Relationen</span></div>
          </a>
        </div>
      </section>

      <section class="hb-part-section">
        <div class="hb-part-header">
          <span class="hb-part-badge hb-part-badge-b">Technische Dokumente</span>
          <div>
            <h2 class="hb-part-title">Richtlinien, Runtime-Guides, Security &amp; Technical Debt</h2>
            <p class="hb-part-sub">Aufbereitete Referenzdokumente mit automatischer Komponenten- und Feature-Verlinkung</p>
          </div>
        </div>
        <div class="hb-card-grid">
          ${articles.map(a => `
            <a href="#devref/${esc(a.id)}" class="hb-card">
              <div>
                <div class="hb-card-top"><span class="hb-card-num">${esc(a.docId || a.category)}</span><span class="hb-card-status">${esc(a.path)}</span></div>
                <h3 class="hb-card-title">${esc(a.title)}</h3>
                <p class="hb-card-goal">${esc(a.summary)}</p>
              </div>
              <div class="hb-card-meta"><span>📑 ${a.headings.length} Abschnitte</span></div>
            </a>
          `).join('')}
        </div>
      </section>
    `;
  }

  window.ArgonPortalViews = {
    esc,
    statusPill,
    renderPortalHome,
    renderHandbookOverview,
    renderComponentsCatalog,
    renderComponentDetail,
    renderFeaturesCatalog,
    renderFeatureDetail,
    renderArchitectureOverview,
    renderGenericDocDetail,
    renderDevRefOverview
  };
})();
