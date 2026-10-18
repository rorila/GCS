/**
 * swe2-adapter-argon.js — Client-seitiges Adapter- & Darstellungsmodul für die
 * SWE-2-Wissensbasis im GCS Documentation Portal (Argon).
 *
 * Setzt die Vertragsregeln aus docs/gcs-knowledge-swe2/SCHNITTSTELLE-ARGON.md (§2.2–§2.5) um:
 * - Kennzeichnung von provenance.confidence (verified | documented | inferred)
 * - Kennzeichnung von status.dev (implementiert | geplant | veraltet)
 * - Sperre für gelöschte Dokumente (missing: true → kein Link)
 * - Kennzeichnung von Action-Flags (hidden, requiresServer, requiresMultiplayer, isAlias)
 * - Darstellung von SWE-2-Relations (COMP, FEAT, ACT, MTH, EVT, SCM, GUIDE, DOC, CON)
 * - Spezial-Ansichten für Methoden (MTH), Events (EVT), Schemas (SCM) & Konzepte (CON)
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

  function confidenceBadge(confidence) {
    const c = String(confidence || 'documented').toLowerCase();
    if (c === 'verified') {
      return '<span class="hb-status-pill hb-status-ok" title="Quellcode-/Registry-belegt (provenance.confidence = verified)">✔ Verifiziert (Code/Registry)</span>';
    }
    if (c === 'inferred') {
      return '<span class="hb-status-pill hb-status-danger" title="Abgeleitet, nicht vollständig verifiziert (provenance.confidence = inferred)">⚠️ Nicht verifiziert (inferred)</span>';
    }
    return '<span class="hb-status-pill hb-status-info" title="Aus Dokumentation/Inventar übernommen (provenance.confidence = documented)">📄 Dokumentiert</span>';
  }

  function devStatusBadge(devStatus) {
    const d = String(devStatus || 'implementiert').toLowerCase();
    if (d === 'geplant') {
      return '<span class="hb-status-pill hb-status-warn" title="status.dev = geplant">🚧 Geplant (nicht implementiert)</span>';
    }
    if (d === 'veraltet') {
      return '<span class="hb-status-pill hb-status-danger" title="status.dev = veraltet">🗄️ Veraltet</span>';
    }
    return `<span class="hb-status-pill hb-status-ok">Dev: ${esc(devStatus || 'implementiert')}</span>`;
  }

  function actionFlagsBadges(flags) {
    if (!flags || typeof flags !== 'object') return '';
    const pills = [];
    if (flags.hidden) {
      pills.push('<span class="hb-status-pill hb-status-warn" title="flags.hidden = true: Nicht in der Editor-Palette sichtbar">🔒 Nur Entwickleransicht (hidden)</span>');
    }
    if (flags.isAlias) {
      pills.push('<span class="hb-status-pill hb-status-info" title="flags.isAlias = true">🔀 Alias-Action</span>');
    }
    if (flags.requiresServer) {
      pills.push('<span class="hb-status-pill hb-status-info" title="flags.requiresServer = true">🌐 Server erforderlich</span>');
    }
    if (flags.requiresMultiplayer) {
      pills.push('<span class="hb-status-pill hb-status-info" title="flags.requiresMultiplayer = true">👥 Multiplayer</span>');
    }
    return pills.join(' ');
  }

  function renderContractNoticeBanner(entity) {
    if (!entity) return '';
    const dev = String(entity.devStatus || entity.status?.dev || '').toLowerCase();
    const conf = String(entity.confidence || entity.provenance?.confidence || '').toLowerCase();
    const notices = [];

    if (dev === 'geplant') {
      notices.push(`
        <div class="hb-callout hb-callout-warn">
          <div class="hb-callout-icon">🚧</div>
          <div class="hb-callout-body">
            <strong>Geplante Funktion (<code>status.dev = "geplant"</code>):</strong>
            Dieses Element (${esc(entity.id)}) ist laut SWE-2-Wissensbasis derzeit nur geplant bzw. im Schema vorbereitet und in der Laufzeit noch nicht aktiv implementiert.
          </div>
        </div>
      `);
    } else if (dev === 'veraltet') {
      notices.push(`
        <div class="hb-callout hb-callout-danger">
          <div class="hb-callout-icon">🗄️</div>
          <div class="hb-callout-body">
            <strong>Veraltetes Element (<code>status.dev = "veraltet"</code>):</strong>
            Dieses Element (${esc(entity.id)}) ist als veraltet eingestuft und sollte in neuen Projekten nicht mehr verwendet werden.
          </div>
        </div>
      `);
    }

    if (conf === 'inferred') {
      notices.push(`
        <div class="hb-callout hb-callout-warn">
          <div class="hb-callout-icon">⚠️</div>
          <div class="hb-callout-body">
            <strong>Nicht verifizierte Angabe (<code>provenance.confidence = "inferred"</code>):</strong>
            Einzelne Metadaten dieses Eintrags wurden heuristisch abgeleitet und sind noch nicht vollständig gegen den Quellcode verifiziert.
          </div>
        </div>
      `);
    }

    return notices.join('');
  }

  function renderRelationsPills(relations) {
    if (!Array.isArray(relations) || relations.length === 0) {
      return '<span class="hb-muted">Keine expliziten SWE-2-Relations</span>';
    }
    const typeLabels = {
      inherits: 'Vererbt von',
      hasSchema: 'Schema',
      seeAlso: 'Siehe auch',
      dependsOn: 'Abhängig von',
      documentedIn: 'Dokumentiert in',
      declaresEvent: 'Deklariert von'
    };
    return relations.map(r => {
      const label = typeLabels[r.type] || r.type;
      if (r.targetMissing || r.linkable === false) {
        return `<span class="hb-status-pill hb-status-danger" title="Gelöschte Zieldatei (missing: true)">🗑️ ${esc(label)}: ${esc(r.target)} (${esc(r.targetName || 'gelöscht')})</span>`;
      }
      return `<a href="${esc(r.href)}" class="hb-comp-tag" title="${esc(label)}: ${esc(r.targetTitle || r.targetName)}">🔗 ${esc(label)}: <strong>${esc(r.target)}</strong> (${esc(r.targetName)})</a>`;
    }).join(' ');
  }

  function renderComponentSwe2Section(comp) {
    const props = comp.properties || [];
    const eventsDetail = comp.eventsDetail || [];
    const methodsDetail = comp.methodsDetail || [];
    const lims = comp.limitations || [];
    const openQs = comp.openQuestions || [];
    const src = comp.sourcesByType || { code: comp.sources || [], docs: [], tests: comp.tests || [] };

    return `
      ${renderContractNoticeBanner(comp)}

      ${props.length > 0 ? `
        <h2 id="swe2-properties" class="hb-h2">Eigenschaften &amp; Standardwerte (SWE-2 Schema &amp; Inspector)</h2>
        <div class="hb-table-wrap">
          <table class="hb-table">
            <thead>
              <tr><th>Eigenschaft</th><th>Label / Gruppe</th><th>Typ</th><th>Standardwert</th><th>Quelle &amp; Beschreibung</th></tr>
            </thead>
            <tbody>
              ${props.map(p => `
                <tr>
                  <td><code>${esc(p.name)}</code></td>
                  <td>${esc(p.label || p.name)} <small class="hb-muted">(${esc(p.group || '—')})</small></td>
                  <td><code>${esc(p.type || 'string')}</code></td>
                  <td><code>${esc(typeof p.defaultValue === 'object' ? JSON.stringify(p.defaultValue) : String(p.defaultValue ?? '—'))}</code></td>
                  <td>
                    <span class="hb-status-pill ${p.source === 'schema' ? 'hb-status-ok' : 'hb-status-info'}">${esc(p.source || 'schema')}</span>
                    ${p.description ? ` <small>${esc(p.description)}</small>` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      ${(eventsDetail.length > 0 || methodsDetail.length > 0) ? `
        <h2 id="swe2-events-methods" class="hb-h2">Ereignisse (EVT) &amp; Methoden (MTH) aus SWE-2</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin:14px 0">
          <div class="hb-card" style="cursor:default">
            <h3 class="hb-card-title">📡 Ereignisse (${eventsDetail.length})</h3>
            ${eventsDetail.length > 0 ? `
              <div class="hb-table-wrap" style="margin:6px 0 0">
                <table class="hb-table">
                  <thead><tr><th>SWE-2 ID</th><th>Event</th><th>Herkunft</th></tr></thead>
                  <tbody>
                    ${eventsDetail.map(ev => `
                      <tr>
                        <td>${ev.id ? `<a href="#devref/events?q=${encodeURIComponent(ev.id)}" class="hb-code hb-comp-ref">${esc(ev.id)}</a>` : '—'}</td>
                        <td><code>${esc(ev.name)}</code></td>
                        <td><small>${esc(ev.origin)} (${esc(ev.source)})</small></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : '<p class="hb-muted">Keine eigenen Events registriert.</p>'}
          </div>

          <div class="hb-card" style="cursor:default">
            <h3 class="hb-card-title">🔧 Methoden (${methodsDetail.length})</h3>
            ${methodsDetail.length > 0 ? `
              <div class="hb-table-wrap" style="margin:6px 0 0">
                <table class="hb-table">
                  <thead><tr><th>SWE-2 ID</th><th>Methode</th><th>Parameter / Quelle</th></tr></thead>
                  <tbody>
                    ${methodsDetail.map(m => `
                      <tr>
                        <td>${m.id ? `<a href="#devref/methods?q=${encodeURIComponent(m.id)}" class="hb-code hb-comp-ref">${esc(m.id)}</a>` : '—'}</td>
                        <td><code>${esc(m.name)}</code></td>
                        <td>
                          ${(m.parameters && m.parameters.length > 0)
                            ? m.parameters.map(p => `<code>${esc(p.name)}: ${esc(p.type)}</code>`).join(', ')
                            : `<small class="hb-muted">${esc(m.origin)} (${esc(m.source)})</small>`}
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : '<p class="hb-muted">Keine Methoden dokumentiert.</p>'}
          </div>
        </div>
      ` : ''}

      ${(lims.length > 0 || openQs.length > 0) ? `
        <h2 id="swe2-limitations" class="hb-h2">Dokumentierte Einschränkungen &amp; Offene Fragen (SWE-2)</h2>
        ${lims.length > 0 ? `<ul class="hb-ul">${lims.map(l => `<li>⚠️ ${esc(l)}</li>`).join('')}</ul>` : ''}
        ${openQs.length > 0 ? `<ul class="hb-ul">${openQs.map(q => `<li>❓ <strong>Offene Frage:</strong> ${esc(q)}</li>`).join('')}</ul>` : ''}
      ` : ''}

      <h2 id="swe2-provenance" class="hb-h2">SWE-2-Quellenverweise &amp; Relations (${esc(comp.id)})</h2>
      <div class="hb-comp-row" style="margin-bottom:12px">
        <strong style="font-size:0.78rem;color:var(--text-muted)">Aufgelöste SWE-2-Relations:</strong>
        ${renderRelationsPills(comp.relations)}
      </div>
      <div class="hb-table-wrap">
        <table class="hb-table">
          <thead><tr><th>Quellentyp</th><th>Pfade / Nachweise</th></tr></thead>
          <tbody>
            <tr><td><strong>Quellcode (<code>sources.code</code>)</strong></td><td>${(src.code || []).map(s => `<code>${esc(s)}</code>`).join(', ') || '—'}</td></tr>
            <tr><td><strong>Dokumentation (<code>sources.docs</code>)</strong></td><td>${(src.docs || []).map(s => `<code>${esc(s)}</code>`).join(', ') || '—'}</td></tr>
            <tr><td><strong>Tests (<code>sources.tests</code>)</strong></td><td>${(src.tests || []).map(s => `<code>${esc(s)}</code>`).join(', ') || '—'}</td></tr>
            <tr><td><strong>Provenance &amp; Hash</strong></td><td>Methoden: <code>${esc((comp.provenance?.method || []).join(', '))}</code> · Hash: <code>${esc(comp.version?.contentHash || '—')}</code></td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  function renderMethodsCatalog(data, uiState) {
    const methods = data.devref.methods || [];
    const q = (uiState.methodQuery || '').trim().toLowerCase();
    const filtered = methods.filter(m => {
      if (!q) return true;
      const pStr = (m.parameters || []).map(p => `${p.name} ${p.label || ''}`).join(' ');
      const cStr = (m.usedByComponents || []).map(c => `${c.id} ${c.name}`).join(' ');
      return `${m.id} ${m.name} ${m.description} ${pStr} ${cStr}`.toLowerCase().includes(q);
    });

    return `
      <div class="hb-hero-card">
        <div class="hb-hero-badge">SWE-2 Methoden-Referenz · ${methods.length} Methoden (MTH-0001…0038)</div>
        <h1 class="hb-hero-title">Registrierte Komponenten-Methoden (MethodRegistry)</h1>
        <p class="hb-hero-lead">Alle ${methods.length} in <code>docs/gcs-knowledge-swe2/entities/methods-swe2.json</code> erfassten Methoden mit Parametern und verwendenden Komponenten.</p>
        <input
          type="search"
          id="devref-method-search"
          value="${esc(uiState.methodQuery || '')}"
          placeholder="Nach MTH-ID, Methodenname, Parameter oder Komponente suchen (z. B. MTH-0001, speak, moveTo, TSprite)…"
          style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid var(--border-strong);background:var(--bg-app);color:var(--text-primary);font-size:0.9rem"
        />
      </div>

      <div style="display:grid;gap:12px">
        ${filtered.map(m => `
          <div class="hb-card" style="cursor:default">
            <div class="hb-card-top">
              <span class="hb-card-num">🔧 ${esc(m.id)} · ${esc(m.name)}()</span>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                ${devStatusBadge(m.devStatus)}
                ${confidenceBadge(m.confidence)}
              </div>
            </div>
            <h3 class="hb-card-title">${esc(m.name)}(${(m.parameters || []).map(p => `${esc(p.name)}${p.optional ? '?' : ''}: ${esc(p.type)}`).join(', ')})</h3>
            <p class="hb-card-goal">${esc(m.description)}</p>
            ${(m.usedByComponents && m.usedByComponents.length > 0) ? `
              <div class="hb-comp-row">
                <small class="hb-muted">Komponenten:</small>
                ${m.usedByComponents.map(c => `<a href="#components/${esc(c.id)}" class="hb-comp-tag">🧩 ${esc(c.id)} (${esc(c.name)})</a>`).join(' ')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderEventsCatalog(data, uiState) {
    const events = data.devref.events || [];
    const q = (uiState.eventQuery || '').trim().toLowerCase();
    const filtered = events.filter(ev => {
      if (!q) return true;
      return `${ev.id} ${ev.name} ${ev.description} ${(ev.declaredBy || []).join(' ')}`.toLowerCase().includes(q);
    });

    return `
      <div class="hb-hero-card">
        <div class="hb-hero-badge">SWE-2 Event-Katalog · ${events.length} Events (EVT-0001…0158)</div>
        <h1 class="hb-hero-title">Ereignis-Referenz aller GCS-Komponenten</h1>
        <p class="hb-hero-lead">Vollständiges Verzeichnis aus <code>docs/gcs-knowledge-swe2/entities/events-swe2.json</code> mit aufgelösten <code>declaresEvent</code>-Relations.</p>
        <input
          type="search"
          id="devref-event-search"
          value="${esc(uiState.eventQuery || '')}"
          placeholder="Nach EVT-ID, Eventname oder deklarierender Komponente filtern (z. B. EVT-0001, onClick, onCollision, TSprite)…"
          style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid var(--border-strong);background:var(--bg-app);color:var(--text-primary);font-size:0.9rem"
        />
      </div>

      <div class="hb-table-wrap">
        <table class="hb-table">
          <thead><tr><th>ID</th><th>Event</th><th>Status &amp; Provenance</th><th>Deklariert von Komponenten (<code>declaresEvent</code>)</th></tr></thead>
          <tbody>
            ${filtered.map(ev => `
              <tr>
                <td><code>${esc(ev.id)}</code></td>
                <td><strong><code>${esc(ev.name)}</code></strong></td>
                <td>${devStatusBadge(ev.devStatus)} ${confidenceBadge(ev.confidence)}</td>
                <td>
                  <div class="hb-comp-row">
                    ${(ev.relations || []).map(r => `<a href="${esc(r.href)}" class="hb-comp-tag">🧩 ${esc(r.target)} (${esc(r.targetName)})</a>`).join(' ')}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderSchemasAndConcepts(data, uiState) {
    const schemas = data.devref.schemas || [];
    const concepts = data.devref.concepts || [];
    const q = (uiState.schemaQuery || '').trim().toLowerCase();
    const fSchemas = schemas.filter(s => !q || `${s.id} ${s.name} ${s.title} ${s.description}`.toLowerCase().includes(q));
    const fConcepts = concepts.filter(c => !q || `${c.id} ${c.name} ${c.title} ${c.description}`.toLowerCase().includes(q));

    return `
      <div class="hb-hero-card">
        <div class="hb-hero-badge">SWE-2 Schemas (${schemas.length}) &amp; Konzepte (${concepts.length})</div>
        <h1 class="hb-hero-title">Schema-Module (SCM) &amp; Architektur-Konzepte (CON)</h1>
        <p class="hb-hero-lead">Maschinenlesbare JSON-Schemas (<code>SCM-0001…0013</code>) und Konzepte (<code>CON-0001…0015</code>) aus der SWE-2-Wissensbasis.</p>
        <input
          type="search"
          id="devref-schema-search"
          value="${esc(uiState.schemaQuery || '')}"
          placeholder="Nach SCM-/CON-ID, Name oder Komponente filtern…"
          style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid var(--border-strong);background:var(--bg-app);color:var(--text-primary);font-size:0.9rem"
        />
      </div>

      <h2 class="hb-h2">📐 Schema-Module (${fSchemas.length})</h2>
      <div class="hb-card-grid" style="margin-bottom:24px">
        ${fSchemas.map(sc => `
          <div class="hb-card" style="cursor:default">
            <div>
              <div class="hb-card-top">
                <span class="hb-card-num">${esc(sc.id)} · ${esc(sc.name)}</span>
                ${confidenceBadge(sc.confidence)}
              </div>
              <h3 class="hb-card-title">${esc(sc.title)}</h3>
              <p class="hb-card-goal">${esc(sc.description)}</p>
              <div class="hb-comp-row" style="margin-top:8px">${renderRelationsPills(sc.relations)}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <h2 class="hb-h2">💡 Referenz- &amp; Architektur-Konzepte (${fConcepts.length})</h2>
      <div class="hb-card-grid">
        ${fConcepts.map(con => `
          <a href="${esc(con.portalHref)}" class="hb-card">
            <div>
              <div class="hb-card-top">
                <span class="hb-card-num">${esc(con.id)} · ${esc(con.name)}</span>
                ${confidenceBadge(con.confidence)}
              </div>
              <h3 class="hb-card-title">${esc(con.title)}</h3>
              <p class="hb-card-goal">${esc(con.description)}</p>
            </div>
            <div class="hb-card-meta"><span>📄 ${esc((con.sources?.docs || [])[0] || '')}</span></div>
          </a>
        `).join('')}
      </div>
    `;
  }

  window.ArgonSwe2Adapter = {
    confidenceBadge,
    devStatusBadge,
    actionFlagsBadges,
    renderContractNoticeBanner,
    renderRelationsPills,
    renderComponentSwe2Section,
    renderMethodsCatalog,
    renderEventsCatalog,
    renderSchemasAndConcepts
  };
})();
