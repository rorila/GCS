/**
 * views-argon.js — Darstellungs-Module für das GCS Documentation Portal (Argon).
 * Rendert Portal-Startseite, Handbuch-Übersicht, Komponentenreferenz (128),
 * Feature-Katalog (12 + Fachartikel), Architektur-Doku und Entwicklerreferenz.
 */
(function () {
  'use strict';

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
        <div class="hb-hero-badge">GCS Documentation Portal · Argon Edition</div>
        <h1 class="hb-hero-title">Willkommen in der zentralen GCS-Wissensplattform</h1>
        <p class="hb-hero-lead">
          Von den ersten interaktiven Schritten ohne Programmierkenntnisse bis zur vollständigen Referenz über
          alle <strong>${c.components} Komponenten</strong>, <strong>${c.features} System-Features</strong>,
          <strong>${c.actions} Runtime-Actions</strong> und die technische Systemarchitektur.
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
          <a href="#architecture" class="hb-stat-card" style="text-decoration:none">
            <div class="hb-stat-value">${c.architectureDocs}</div>
            <div class="hb-stat-label">🏛️ Kanonische Architektur-Doks</div>
          </a>
          <a href="#devref/actions" class="hb-stat-card" style="text-decoration:none">
            <div class="hb-stat-value">${c.actions}</div>
            <div class="hb-stat-label">⚡ Dokumentierte Runtime-Actions</div>
          </a>
          <a href="#devref/doc-inventory" class="hb-stat-card" style="text-decoration:none">
            <div class="hb-stat-value">${c.inventoryDocuments}</div>
            <div class="hb-stat-label">🗂️ Inventarisierte Dokumente</div>
          </a>
        </div>

        <div class="hb-hero-actions">
          <a href="#handbook/${esc(nextChap.id)}" class="hb-primary-btn" style="text-decoration:none">
            ▶ Handbuch fortsetzen (${esc(nextChap.num)}: ${esc(nextChap.shortTitle)})
          </a>
          <div style="font-size:0.82rem;color:var(--text-muted)">
            Tipp: Drücke jederzeit <kbd class="hb-kbd">Strg K</kbd> oder <kbd class="hb-kbd">/</kbd> für die globale Volltextsuche über alle ${c.searchEntries} Einträge.
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
                <span class="hb-card-status">23 Kapitel</span>
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
                <span class="hb-card-status">${c.components} Bausteine</span>
              </div>
              <h3 class="hb-card-title">Komponentenreferenz &amp; Action-Katalog</h3>
              <p class="hb-card-goal">Nachschlagewerk für alle ${c.components} Komponenten (<code>TSprite</code>, <code>TButton</code>, <code>TTimer</code>, <code>TGameLoop</code> …) mit Inspector-Eigenschaften, Events, Vererbung und Querverweisen.</p>
            </div>
            <div class="hb-card-meta"><span>🔎 Filter nach 11 Kategorien</span><span>🔗 Kapitel-Links</span></div>
          </a>

          <a href="#architecture" class="hb-card hb-card-part-b">
            <div>
              <div class="hb-card-top">
                <span class="hb-card-num">⚙️ SYSTEM- &amp; KI-ENTWICKLER</span>
                <span class="hb-card-status">Engine &amp; Inventar</span>
              </div>
              <h3 class="hb-card-title">Architektur, Features &amp; Entwicklerreferenz</h3>
              <p class="hb-card-goal">Schichtenmodell, Modulkarte, Ausführungsfluss, Feature-Inventar (<code>FEAT-0001</code>…<code>0012</code>), Technical-Debt-Register (<code>TD-001</code>…<code>017</code>) und SWE-2-Datenschnittstelle.</p>
            </div>
            <div class="hb-card-meta"><span>🏛️ Code-verifiziert</span><span>🤖 SWE-2 Ready</span></div>
          </a>
        </div>
      </section>

      <section class="hb-part-section">
        <div class="hb-part-header">
          <span class="hb-part-badge hb-part-badge-b">Alle 6 Bereiche</span>
          <div>
            <h2 class="hb-part-title">Direktzugriff auf die Dokumentationsbereiche</h2>
            <p class="hb-part-sub">Alle Inhalte werden automatisiert durch <code>build-argon.cjs</code> aus den Markdown- und JSON-Quellen generiert</p>
          </div>
        </div>
        <div class="hb-card-grid">
          <a href="#handbook" class="hb-card">
            <div>
              <div class="hb-card-top"><span class="hb-card-num">📖 BEREICH 1</span><span>${c.handbookChapters} Kapitel</span></div>
              <h3 class="hb-card-title">Autoren-Handbuch</h3>
              <p class="hb-card-goal">15 Kapitel Teil A („Mein erster interaktiver Baum“) und 8 Kapitel Teil B („Der wachsende Baum“).</p>
            </div>
            <div class="hb-card-meta"><span>Quelle: docs/user-guide/</span></div>
          </a>
          <a href="#components" class="hb-card">
            <div>
              <div class="hb-card-top"><span class="hb-card-num">🧩 BEREICH 2</span><span>${c.components} Komponenten</span></div>
              <h3 class="hb-card-title">Komponentenreferenz</h3>
              <p class="hb-card-goal">${c.componentCardsMd} Markdown-Referenzkarten + 7 Schema-Einträge mit Eigenschaften, Events, Methoden und Beispielen.</p>
            </div>
            <div class="hb-card-meta"><span>Quelle: docs/reference/components/</span></div>
          </a>
          <a href="#features" class="hb-card">
            <div>
              <div class="hb-card-top"><span class="hb-card-num">✨ BEREICH 3</span><span>${c.features} Features</span></div>
              <h3 class="hb-card-title">Feature-Katalog</h3>
              <p class="hb-card-goal">12 inventarisierte System-Features (<code>FEAT-0001</code>…<code>0012</code>) und ${c.featureArticles} vertiefende Fachartikel.</p>
            </div>
            <div class="hb-card-meta"><span>Quelle: docs/features/ &amp; FEATURE-INVENTORY.json</span></div>
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
              <div class="hb-card-top"><span class="hb-card-num">🛠️ BEREICH 5</span><span>${c.actions} Actions · ${c.techDebtItems} TDs</span></div>
              <h3 class="hb-card-title">Entwicklerreferenz</h3>
              <p class="hb-card-goal">Action-Katalog, Developer Guidelines, Runtime-Guide, Stage-Schnittstellen, Security-Plan, Technical Debt &amp; Dokumenten-Inventar.</p>
            </div>
            <div class="hb-card-meta"><span>Quelle: docs/inventory/ &amp; DEVELOPER_GUIDELINES.md</span></div>
          </a>
          <a href="#devref/swe2-interface" class="hb-card hb-card-part-b">
            <div>
              <div class="hb-card-top"><span class="hb-card-num">🤝 BEREICH 6</span><span>JSON-Vertrag v1.0</span></div>
              <h3 class="hb-card-title">SWE-2 Datenschnittstelle</h3>
              <p class="hb-card-goal">Dokumentierter Integrationsvertrag (<code>portal-config-argon.json</code>) für strukturierte KI-Agenten-Referenzdaten von SWE-2.</p>
            </div>
            <div class="hb-card-meta"><span>Kanonische IDs: COMP / FEAT / DOC</span></div>
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
              <span class="hb-card-num">KAPITEL ${esc(c.num)}</span>
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
        <div class="hb-hero-badge">GCS Autoren-Handbuch · 23 Kapitel</div>
        <h1 class="hb-hero-title">Interaktive Spiele und Lernwelten entwickeln</h1>
        <p class="hb-hero-lead">Schritt für Schritt ohne Programmierkenntnisse — mit interaktiven Checklisten, deutschen Sprecher-Drehbüchern und direkten Links in die Komponentenreferenz.</p>

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
            <h2 class="hb-part-title">„Mein erster interaktiver Baum“ (Kapitel 1–15)</h2>
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
            <h2 class="hb-part-title">„Der wachsende Baum“ (Kapitel B1–B8)</h2>
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
      if (q) {
        const hay = `${c.name} ${c.id} ${c.categoryLabel} ${c.summary} ${c.properties.map(p => p.name).join(' ')} ${c.events.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return `
      <div class="hb-hero-card">
        <div class="hb-hero-badge">Komponentenreferenz · ${items.length} GCS-Komponenten</div>
        <h1 class="hb-hero-title">Alle Bausteine der GCS-Plattform</h1>
        <p class="hb-hero-lead">
          Vollständiges Verzeichnis aller <strong>${items.length} Komponenten</strong> (<code>COMP-0001</code> bis <code>COMP-0128</code>)
          mit Kategorien, Inspector-Eigenschaften, Ereignissen, Methoden, Vererbungsketten und direkten Verweisen in das Autoren-Handbuch.
        </p>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
          <input
            type="search"
            id="comp-catalog-search"
            value="${esc(uiState.compQuery || '')}"
            placeholder="Komponente, ID, Eigenschaft oder Event filtern (z. B. TSprite, onCollision, velocityX)…"
            style="flex:1;min-width:240px;padding:9px 14px;border-radius:8px;border:1px solid var(--border-strong);background:var(--bg-app);color:var(--text-primary);font-size:0.9rem"
          />
          <select id="comp-status-select" style="padding:9px 12px;border-radius:8px;border:1px solid var(--border-strong);background:var(--bg-app);color:var(--text-primary);font-size:0.85rem">
            <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>Alle Komponenten (${items.length})</option>
            <option value="handbook" ${statusFilter === 'handbook' ? 'selected' : ''}>Im Autoren-Handbuch genutzt (${items.filter(x => x.usedInChapters.length > 0).length})</option>
            <option value="used" ${statusFilter === 'used' ? 'selected' : ''}>In Spielprojekten verwendet (${items.filter(x => x.usageCount > 0).length})</option>
            <option value="curated" ${statusFilter === 'curated' ? 'selected' : ''}>Kuratierte Referenzkarten (${items.filter(x => x.isCurated).length})</option>
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
        ${filtered.map(c => `
          <a href="#components/${esc(c.name)}" class="hb-card ${c.isCurated ? 'is-done' : ''}">
            <div>
              <div class="hb-card-top">
                <span class="hb-card-num">${esc(c.id)} · ${c.categoryIcon} ${esc(c.categoryLabel)}</span>
                <span class="hb-card-status">${c.isCurated ? '⭐ Kuratiert' : esc(c.devStatus)}</span>
              </div>
              <h3 class="hb-card-title">${esc(c.name)}</h3>
              <p class="hb-card-goal">${esc(c.summary || 'GCS-Komponente')}</p>
            </div>
            <div class="hb-card-meta">
              <span>⚙️ ${c.properties.length} Props</span>
              <span>⚡ ${c.events.length} Events</span>
              ${c.usedInChapters.length > 0 ? `<span>📖 ${c.usedInChapters.length} Kap.</span>` : ''}
              ${c.usageCount > 0 ? `<span>🎮 ${c.usageCount} Proj.</span>` : ''}
            </div>
          </a>
        `).join('') || '<p class="hb-muted">Keine Komponenten für diesen Filter gefunden.</p>'}
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
            ${statusPill(comp.devStatus, 'Dev')}
            ${statusPill(comp.testStatus, 'Test')}
            ${statusPill(comp.docStatus, 'Doku')}
          </div>
        </div>

        <div class="hb-spec-grid">
          <div class="hb-spec-item">
            <span class="hb-spec-label">Inventar-ID &amp; Kategorie</span>
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
        <div class="hb-hero-badge">Feature-Katalog · ${feats.length} System-Features &amp; ${articles.length} Fachartikel</div>
        <h1 class="hb-hero-title">Funktionsbereiche der GCS-Plattform</h1>
        <p class="hb-hero-lead">
          Maschinenlesbar inventarisierte Haupt-Features (<code>FEAT-0001</code> bis <code>FEAT-0012</code>) aus
          <code>FEATURE-INVENTORY.json</code> sowie die detaillierten Fachspezifikationen aus <code>docs/features/</code>.
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
          <span class="hb-part-badge">Inventar</span>
          <div>
            <h2 class="hb-part-title">Die 12 übergeordneten GCS-Features (FEAT-0001 bis FEAT-0012)</h2>
            <p class="hb-part-sub">Geprüft gegen Quellcode, Tests und Laufzeit — mit Verweisen auf Komponenten und Handbuch-Kapitel</p>
          </div>
        </div>
        <div class="hb-card-grid">
          ${filteredFeats.map(f => `
            <a href="#features/${esc(f.id)}" class="hb-card">
              <div>
                <div class="hb-card-top">
                  <span class="hb-card-num">${esc(f.id)} · ${esc(f.category.toUpperCase())}</span>
                  <span class="hb-card-status">${esc(f.docStatus)}</span>
                </div>
                <h3 class="hb-card-title">${esc(f.name)}</h3>
                <p class="hb-card-goal">${esc(f.summary)}</p>
              </div>
              <div class="hb-card-meta">
                <span>📂 ${(f.sources || []).length} Quellen</span>
                <span>🧩 ${(f.linkedComponents || []).length} Komp.</span>
                <span>📖 ${(f.linkedChapters || []).length} Kap.</span>
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
                  <span class="hb-card-num">${esc(a.category)}</span>
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
            ${statusPill(item.devStatus, 'Dev')}
            ${statusPill(item.testStatus, 'Test')}
            ${statusPill(item.docStatus, 'Doku')}
          </div>
        </div>

        <div class="hb-spec-grid">
          <div class="hb-spec-item"><span class="hb-spec-label">Kategorie</span><span class="hb-spec-val">${esc(item.category.toUpperCase())}</span></div>
          <div class="hb-spec-item"><span class="hb-spec-label">Abhängigkeiten (dependsOn)</span><span class="hb-spec-val">${depTags}</span></div>
          <div class="hb-spec-item"><span class="hb-spec-label">Analyse-Umfang</span><span class="hb-spec-val">${esc(item.analysisScope || item.commit || '53e3dfb')}</span></div>
          <div class="hb-spec-item"><span class="hb-spec-label">Geprüft am / durch</span><span class="hb-spec-val">${esc(item.lastChecked || '—')} · ${esc(item.checkedBy || '—')}</span></div>
        </div>
      </header>

      <div class="hb-prose">
        <div class="hb-callout hb-callout-goal">
          <div class="hb-callout-icon">✨</div>
          <div class="hb-callout-body"><strong>Zusammenfassung:</strong> ${esc(item.summary)}</div>
        </div>

        ${item.notes ? `<div class="hb-callout hb-callout-info"><div class="hb-callout-icon">📝</div><div class="hb-callout-body"><strong>Technische Anmerkung:</strong> ${esc(item.notes)}</div></div>` : ''}

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
          <h2 id="einschraenkungen" class="hb-h2">Bekannte Einschränkungen &amp; Randbedingungen</h2>
          <ul class="hb-ul">${item.limitations.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
        ` : ''}

        ${(item.openQuestions && item.openQuestions.length > 0) ? `
          <h2 id="offene-fragen" class="hb-h2">Offene Fragen</h2>
          <ul class="hb-ul">${item.openQuestions.map(q => `<li>⚠️ ${esc(q)}</li>`).join('')}</ul>
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
                <span class="hb-card-num">${esc(d.category)}</span>
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
          <span class="hb-badge-num">${esc(doc.category)}</span>
        </div>

        <div class="hb-chapter-title-row">
          <h1 class="hb-h1">${esc(doc.title)}</h1>
          <span class="hb-status-pill hb-status-ok">📄 Quelle: ${esc(doc.path)}</span>
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

  // 8. ENTWICKLERREFERENZ (#devref, #devref/actions, #devref/doc-inventory, #devref/swe2-interface)
  function renderDevRefOverview(data, uiState) {
    const subView = uiState.devSubView || 'overview';
    const articles = data.devref.articles;
    const actions = data.devref.actions;
    const techDebt = data.devref.techDebt;
    const docInv = data.devref.documentInventory;

    if (subView === 'actions') {
      const q = (uiState.actionQuery || '').trim().toLowerCase();
      const filtered = actions.filter(a => {
        if (!q) return true;
        const pStr = (a.parameters || []).map(p => `${p.name} ${p.label || ''} ${p.hint || ''}`).join(' ');
        return `${a.type} ${a.label || ''} ${a.description || ''} ${pStr}`.toLowerCase().includes(q);
      });

      return `
        <div class="hb-hero-card">
          <div class="hb-hero-badge">Entwicklerreferenz · ${actions.length} Runtime-Actions</div>
          <h1 class="hb-hero-title">Action-Katalog (ActionRegistry)</h1>
          <p class="hb-hero-lead">
            Alle ${actions.length} registrierten Action-Typen aus <code>docs/inventory/action-metadata.json</code> inkl. Parameter-Spezifikation und Inspector-Hinweisen.
          </p>
          <input
            type="search"
            id="devref-action-search"
            value="${esc(uiState.actionQuery || '')}"
            placeholder="Action oder Parameter filtern (z. B. navigate_stage, property, calculate, store_token, http)…"
            style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid var(--border-strong);background:var(--bg-app);color:var(--text-primary);font-size:0.9rem"
          />
        </div>

        <div style="display:grid;gap:14px">
          ${filtered.map(act => `
            <div class="hb-card" style="cursor:default">
              <div class="hb-card-top">
                <span class="hb-card-num" style="font-size:0.84rem">⚡ ${esc(act.type)}</span>
                <span class="hb-card-status">${(act.parameters || []).length} Parameter</span>
              </div>
              <h3 class="hb-card-title">${esc(act.label || act.type)}</h3>
              <p class="hb-card-goal" style="-webkit-line-clamp:none">${esc(act.description || 'Keine Beschreibung hinterlegt.')}</p>
              ${(act.parameters && act.parameters.length > 0) ? `
                <div class="hb-table-wrap" style="margin:8px 0 0">
                  <table class="hb-table">
                    <thead><tr><th>Parameter</th><th>Label</th><th>Typ / Quelle</th><th>Hinweis</th></tr></thead>
                    <tbody>
                      ${act.parameters.map(p => `
                        <tr>
                          <td><code>${esc(p.name)}</code></td>
                          <td>${esc(p.label || '—')}</td>
                          <td><code>${esc(p.type || 'string')}</code>${p.source ? ` <small class="hb-muted">(${esc(p.source)})</small>` : ''}</td>
                          <td>${esc(p.hint || (p.options ? `Optionen: ${p.options.join(', ')}` : '—'))}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `;
    }

    if (subView === 'doc-inventory') {
      const q = (uiState.docInvQuery || '').trim().toLowerCase();
      const ratingFilter = uiState.docInvRating || 'all';
      const filtered = docInv.filter(d => {
        if (ratingFilter === 'canonical' && !d.canonical) return false;
        if (ratingFilter !== 'all' && ratingFilter !== 'canonical' && d.rating !== ratingFilter) return false;
        if (q && !`${d.id} ${d.file} ${d.type || ''} ${d.note || ''}`.toLowerCase().includes(q)) return false;
        return true;
      });

      return `
        <div class="hb-hero-card">
          <div class="hb-hero-badge">Dokumenten-Inventar · ${docInv.length} Einträge</div>
          <h1 class="hb-hero-title">Gesamtverzeichnis der inventarisierten Dokumente</h1>
          <p class="hb-hero-lead">Quelle: <code>docs/inventory/FEATURE-INVENTORY.json</code> (Sektion <code>documents[]</code>).</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <input
              type="search"
              id="devref-docinv-search"
              value="${esc(uiState.docInvQuery || '')}"
              placeholder="Nach DOC-ID, Dateipfad oder Anmerkung suchen…"
              style="flex:1;min-width:220px;padding:9px 14px;border-radius:8px;border:1px solid var(--border-strong);background:var(--bg-app);color:var(--text-primary)"
            />
            <select id="devref-docinv-rating" style="padding:9px 12px;border-radius:8px;border:1px solid var(--border-strong);background:var(--bg-app);color:var(--text-primary)">
              <option value="all" ${ratingFilter === 'all' ? 'selected' : ''}>Alle Bewertungen (${docInv.length})</option>
              <option value="canonical" ${ratingFilter === 'canonical' ? 'selected' : ''}>⭐ Kanonisch (${docInv.filter(x => x.canonical).length})</option>
              <option value="aktuell" ${ratingFilter === 'aktuell' ? 'selected' : ''}>Aktuell (${docInv.filter(x => x.rating === 'aktuell').length})</option>
              <option value="möglicherweise veraltet" ${ratingFilter === 'möglicherweise veraltet' ? 'selected' : ''}>Möglicherweise veraltet (${docInv.filter(x => x.rating === 'möglicherweise veraltet').length})</option>
            </select>
          </div>
        </div>

        <div class="hb-table-wrap">
          <table class="hb-table">
            <thead><tr><th>ID</th><th>Datei</th><th>Typ</th><th>Bewertung</th><th>Prüftiefe / Anmerkung</th></tr></thead>
            <tbody>
              ${filtered.map(d => `
                <tr>
                  <td><code>${esc(d.id)}</code></td>
                  <td><code>${esc(d.file)}</code> ${d.canonical ? '<span class="hb-status-pill hb-status-ok">kanonisch</span>' : ''}</td>
                  <td>${esc(d.type || '—')}</td>
                  <td>${statusPill(d.rating)}</td>
                  <td><small>${esc(d.reviewDepth || '')}${d.note ? ` — ${esc(d.note)}` : ''}</small></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (subView === 'swe2-interface') {
      const swe2 = data.meta.swe2Integration;
      return `
        <div class="hb-hero-card">
          <div class="hb-hero-badge">Zusammenarbeit mit SWE-2 · Datenschnittstelle v${esc(swe2.schemaVersion)}</div>
          <h1 class="hb-hero-title">Strukturierte Datenschnittstelle für KI-Agenten (SWE-2)</h1>
          <p class="hb-hero-lead">${esc(swe2.description)}</p>
        </div>

        <div class="hb-prose">
          <div class="hb-callout hb-callout-goal">
            <div class="hb-callout-icon">🤝</div>
            <div class="hb-callout-body">
              <strong>Strikt entkoppelte Architektur:</strong> Das Argon Documentation Portal liest sämtliche Bestandsdateien unter
              <code>docs/inventory/</code>, <code>docs/reference/components/</code>, <code>docs/features/</code> und <code>docs/architecture/</code>
              ausschließlich <strong>read-only</strong>. Keine Datei von SWE-2 wird verändert.
            </div>
          </div>

          <h2 class="hb-h2">Kanonische Join-Schlüssel (ID-Schema)</h2>
          <div class="hb-table-wrap">
            <table class="hb-table">
              <thead><tr><th>Entität</th><th>Primärer Join-Key</th><th>Beispiel</th></tr></thead>
              <tbody>
                <tr><td><strong>Komponente</strong></td><td><code>${esc(swe2.joinKeys.component)}</code></td><td><code>COMP-0097</code> / <code>TSprite</code></td></tr>
                <tr><td><strong>System-Feature</strong></td><td><code>${esc(swe2.joinKeys.feature)}</code></td><td><code>FEAT-0001</code></td></tr>
                <tr><td><strong>Dokument</strong></td><td><code>${esc(swe2.joinKeys.document)}</code></td><td><code>DOC-0117</code> / <code>docs/architecture/overview.md</code></td></tr>
                <tr><td><strong>Runtime-Action</strong></td><td><code>${esc(swe2.joinKeys.action)}</code></td><td><code>navigate_stage</code></td></tr>
              </tbody>
            </table>
          </div>

          <h2 class="hb-h2">Optionale SWE-2-Overlay-Pfade in <code>portal-config-argon.json</code></h2>
          <p class="hb-p">Sobald SWE-2 maschinenlesbare Vertragsdateien unter einem der folgenden Pfade ablegt, bindet <code>build-argon.cjs</code> diese beim nächsten Build automatisch ein:</p>
          <ul class="hb-ul">
            ${(swe2.optionalOverlayFiles || []).map(f => `<li><code>${esc(f)}</code></li>`).join('')}
          </ul>
        </div>
      `;
    }

    // Standard-Übersicht der Entwicklerreferenz (#devref)
    return `
      <div class="hb-hero-card">
        <div class="hb-hero-badge">Entwicklerreferenz · Engine, Actions, Governance &amp; Qualitätsbefunde</div>
        <h1 class="hb-hero-title">Technische Referenz für GCS- &amp; KI-Entwickler</h1>
        <p class="hb-hero-lead">
          Zentraler Zugriff auf die ${actions.length} registrierten Runtime-Actions, verbindliche Developer Guidelines,
          Stage-Schnittstellen, Security-Plan, Technical-Debt-Register (${techDebt.length} Befunde) und das vollständige Dokumenten-Inventar (${docInv.length} Einträge).
        </p>
      </div>

      <section class="hb-part-section">
        <div class="hb-part-header">
          <span class="hb-part-badge">Interaktive Kataloge</span>
          <div>
            <h2 class="hb-part-title">Maschinenlesbare Register &amp; Schnittstellen</h2>
            <p class="hb-part-sub">Durchsuchbare Spezialansichten aus den JSON-Inventaren</p>
          </div>
        </div>
        <div class="hb-card-grid">
          <a href="#devref/actions" class="hb-card">
            <div>
              <div class="hb-card-top"><span class="hb-card-num">⚡ ACTION-REGISTRY</span><span>${actions.length} Actions</span></div>
              <h3 class="hb-card-title">Runtime-Action-Katalog</h3>
              <p class="hb-card-goal">Alle ${actions.length} Action-Typen mit Parametern, Quell-Selektoren und Hinweisen aus <code>action-metadata.json</code>.</p>
            </div>
            <div class="hb-card-meta"><span>🔎 Mit Parameter-Suche</span></div>
          </a>
          <a href="#devref/doc-inventory" class="hb-card">
            <div>
              <div class="hb-card-top"><span class="hb-card-num">🗂️ DOC-INVENTAR</span><span>${docInv.length} Dokumente</span></div>
              <h3 class="hb-card-title">Dokumenten-Inventar (DOC-0001…0242)</h3>
              <p class="hb-card-goal">Vollständige Bewertungstabelle aller Bestandsdokumente nach Aktualität, Prüftiefe und Kanonizität.</p>
            </div>
            <div class="hb-card-meta"><span>⭐ Kanonisch-Filter</span></div>
          </a>
          <a href="#devref/swe2-interface" class="hb-card hb-card-part-b">
            <div>
              <div class="hb-card-top"><span class="hb-card-num">🤝 SWE-2 SCHNITTSTELLE</span><span>JSON Schema v1.0</span></div>
              <h3 class="hb-card-title">SWE-2 KI-Referenzdaten-Vertrag</h3>
              <p class="hb-card-goal">Dokumentierte Join-Schlüssel und Overlay-Mechanismen für die Zusammenarbeit mit SWE-2.</p>
            </div>
            <div class="hb-card-meta"><span>portal-config-argon.json</span></div>
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
                <div class="hb-card-top"><span class="hb-card-num">${esc(a.category)}</span><span class="hb-card-status">${esc(a.path)}</span></div>
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
