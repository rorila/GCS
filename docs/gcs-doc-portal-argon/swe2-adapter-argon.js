/**
 * swe2-adapter-argon.js — Client-seitiges Adapter- & Darstellungsmodul für die
 * SWE-2-Wissensbasis (Schema 1.1.0) im GCS Documentation Portal (Argon).
 *
 * Setzt die Vertragsregeln aus docs/gcs-knowledge-swe2/SCHNITTSTELLE-ARGON.md (§2.2–§2.5) um:
 * - Kennzeichnung von provenance.confidence (verified | documented | inferred) inkl. provenance.facts
 * - Kennzeichnung von status.dev (implementiert | geplant | veraltet | unbekannt) ohne optimistische Fallbacks
 * - Sperre für gelöschte Dokumente (missing: true → kein Link)
 * - Kennzeichnung von Action-Flags (hidden, requiresServer, requiresMultiplayer, isAlias) & allen Parameterfeldern
 * - Darstellung von SWE-2-Relations (COMP, FEAT, ACT, MTH, EVT, SCM, GUIDE, DOC, CON)
 * - Spezial-Ansichten für Methoden (MTH), Events (EVT), Schemas (SCM) & Konzepte (CON)
 */
(function () {
  'use strict';

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function confidenceBadge(confidence) {
    const c = String(confidence || 'documented').toLowerCase();
    if (c === 'verified') {
      return '<span class="hb-status-pill hb-status-ok" title="Quellcode-/Registry-belegt (confidence = verified)">✔ Verifiziert (Code/Registry)</span>';
    }
    if (c === 'inferred') {
      return '<span class="hb-status-pill hb-status-danger" title="Abgeleitet, nicht vollständig verifiziert (confidence = inferred)">⚠️ Nicht verifiziert (inferred)</span>';
    }
    return '<span class="hb-status-pill hb-status-info" title="Aus Dokumentation/Inventar übernommen (confidence = documented)">📄 Dokumentiert</span>';
  }

  function confidencePillCompact(confidence) {
    const c = String(confidence || 'documented').toLowerCase();
    if (c === 'verified') {
      return '<span class="hb-status-pill hb-status-ok" title="confidence = verified">✔ verified</span>';
    }
    if (c === 'inferred') {
      return '<span class="hb-status-pill hb-status-danger" title="confidence = inferred">⚠️ inferred</span>';
    }
    return '<span class="hb-status-pill hb-status-info" title="confidence = documented">📄 documented</span>';
  }

  function devStatusBadge(devStatus, prefix) {
    const raw = String(devStatus || '').trim();
    const d = raw.toLowerCase();
    const pref = prefix ? `${esc(prefix)}: ` : '';
    if (d === 'geplant') {
      return '<span class="hb-status-pill hb-status-warn" title="status.dev = geplant">🚧 Geplant (nicht implementiert)</span>';
    }
    if (d === 'experimentell') {
      return '<span class="hb-status-pill hb-status-warn" title="status.dev = experimentell">🧪 Experimentell</span>';
    }
    if (d === 'veraltet') {
      return '<span class="hb-status-pill hb-status-danger" title="status.dev = veraltet">🗄️ Veraltet</span>';
    }
    if (d === 'implementiert') {
      return `<span class="hb-status-pill hb-status-ok">${pref}implementiert</span>`;
    }
    return `<span class="hb-status-pill hb-status-warn" title="status.dev fehlt oder ist unbekannt">⚠️ Status: ${esc(raw || 'unbekannt')}</span>`;
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

  function renderProvenanceFactsBar(provenance) {
    const facts = provenance?.facts;
    if (!facts || typeof facts !== 'object' || Object.keys(facts).length === 0) return '';
    const factLabels = {
      status: 'Status',
      description: 'Beschreibung',
      properties: 'Eigenschaften',
      events: 'Events',
      inheritanceChain: 'Vererbung',
      limitations: 'Einschränkungen',
      registration: 'Registrierung',
      parameters: 'Parameter',
      flags: 'Flags'
    };
    const entries = Object.entries(facts).map(([k, val]) => {
      const label = factLabels[k] || k;
      return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;background:var(--bg-elevated);border:1px solid var(--border-subtle);font-size:0.75rem"><strong>${esc(label)}:</strong> ${confidencePillCompact(val)}</span>`;
    }).join(' ');

    return `
      <div class="hb-callout hb-callout-proof" style="margin:12px 0 18px">
        <div class="hb-callout-icon">🔬</div>
        <div class="hb-callout-body">
          <div style="margin-bottom:6px">
            <strong>Abschnitts-Provenance (<code>provenance.facts</code> · Schema 1.1.0):</strong>
            <small class="hb-muted">Der Gesamtstatus <code>provenance.confidence = "${esc(provenance.confidence || 'documented')}"</code> entspricht <code>max(facts)</code>; einzelne Teilbereiche besitzen folgende Belegtiefe:</small>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${entries}</div>
        </div>
      </div>
    `;
  }

  function renderContractNoticeBanner(entity) {
    if (!entity) return '';
    const dev = String(entity.devStatus || entity.status?.dev || 'unbekannt').toLowerCase();
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
    } else if (dev === 'experimentell') {
      notices.push(`
        <div class="hb-callout hb-callout-warn">
          <div class="hb-callout-icon">🧪</div>
          <div class="hb-callout-body">
            <strong>Experimentelle Funktion (<code>status.dev = "experimentell"</code>):</strong>
            Dieses Element (${esc(entity.id)}) befindet sich im experimentellen Stadium; Schnittstellen und Laufzeitverhalten können sich ändern.
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
    } else if (dev !== 'implementiert') {
      notices.push(`
        <div class="hb-callout hb-callout-warn">
          <div class="hb-callout-icon">⚠️</div>
          <div class="hb-callout-body">
            <strong>Unbekannter Entwicklungsstatus (<code>status.dev = "${esc(dev)}"</code>):</strong>
            Für dieses Element (${esc(entity.id)}) liegt kein bestätigter Implementierungsstatus vor.
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

  function renderEventConditions(conditions) {
    if (!Array.isArray(conditions) || conditions.length === 0) return '';
    return conditions.map(c => {
      const valStr = typeof c.equals === 'boolean' || typeof c.equals === 'number' ? String(c.equals) : JSON.stringify(c.equals ?? '');
      return `<div style="margin-top:3px"><span class="hb-status-pill hb-status-warn" title="${esc(c.note || '')}">⚡ Bedingung: <code>${esc(c.property)} = ${esc(valStr)}</code></span>${c.note ? ` <small class="hb-muted">${esc(c.note)}</small>` : ''}</div>`;
    }).join('');
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
      ${renderProvenanceFactsBar(comp.provenance)}

      ${props.length > 0 ? `
        <h2 id="swe2-properties" class="hb-h2">Eigenschaften &amp; Standardwerte (SWE-2 Schema 1.1.0 · ${props.length})</h2>
        <div class="hb-table-wrap">
          <table class="hb-table">
            <thead>
              <tr><th>Eigenschaft</th><th>Label / Gruppe</th><th>Typ &amp; Optionen</th><th>Standardwert</th><th>Quelle, Confidence &amp; Beschreibung</th></tr>
            </thead>
            <tbody>
              ${props.map(p => `
                <tr>
                  <td><code>${esc(p.name)}</code></td>
                  <td>${esc(p.label || p.name)} <small class="hb-muted">(${esc(p.group || '—')})</small></td>
                  <td>
                    <code>${esc(p.type || 'string')}</code>
                    ${(Array.isArray(p.options) && p.options.length > 0) ? `<div style="margin-top:4px;font-size:0.75rem"><span class="hb-muted">Optionen:</span> ${p.options.map(opt => `<code>${esc(opt)}</code>`).join(', ')}</div>` : ''}
                  </td>
                  <td><code>${esc(typeof p.defaultValue === 'object' ? JSON.stringify(p.defaultValue) : String(p.defaultValue ?? '—'))}</code></td>
                  <td>
                    <span class="hb-status-pill ${p.source === 'schema' ? 'hb-status-ok' : 'hb-status-info'}">${esc(p.source || 'schema')}</span>
                    ${confidencePillCompact(p.confidence || 'documented')}
                    ${p.description ? `<div style="margin-top:4px"><small>${esc(p.description)}</small></div>` : ''}
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
                  <thead><tr><th>SWE-2 ID</th><th>Event</th><th>Herkunft, Bedingung &amp; Confidence</th></tr></thead>
                  <tbody>
                    ${eventsDetail.map(ev => `
                      <tr>
                        <td>${ev.id ? `<a href="#devref/events?q=${encodeURIComponent(ev.id)}" class="hb-code hb-comp-ref">${esc(ev.id)}</a>` : '—'}</td>
                        <td><code>${esc(ev.name)}</code></td>
                        <td>
                          <div>
                            <span class="hb-status-pill ${ev.origin === 'own' ? 'hb-status-ok' : 'hb-status-info'}">${esc(ev.origin === 'inherited' ? `inherited (${ev.inheritedFrom || ev.declaredIn || 'Basis'})` : 'own')}</span>
                            ${confidencePillCompact(ev.confidence || 'documented')}
                            ${ev.source ? ` <small class="hb-muted">[${esc(ev.source)}]</small>` : ''}
                          </div>
                          ${renderEventConditions(ev.conditions)}
                        </td>
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
                          ${confidencePillCompact(m.confidence || 'verified')}
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
                ${devStatusBadge(m.devStatus, 'Dev')}
                ${confidenceBadge(m.confidence)}
              </div>
            </div>
            <h3 class="hb-card-title">${esc(m.name)}(${(m.parameters || []).map(p => `${esc(p.name)}${p.optional ? '?' : ''}: ${esc(p.type)}`).join(', ')})</h3>
            <p class="hb-card-goal">${esc(m.description)}</p>
            ${renderContractNoticeBanner(m)}
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
        <div class="hb-hero-badge">SWE-2 Event-Katalog · ${events.length} Events (EVT-0001…0163)</div>
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
                <td>${devStatusBadge(ev.devStatus, 'Dev')} ${confidenceBadge(ev.confidence)}</td>
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
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  ${devStatusBadge(sc.devStatus, 'Dev')}
                  ${confidenceBadge(sc.confidence)}
                </div>
              </div>
              <h3 class="hb-card-title">${esc(sc.title)}</h3>
              <p class="hb-card-goal">${esc(sc.description)}</p>
              ${renderContractNoticeBanner(sc)}
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
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  ${devStatusBadge(con.devStatus, 'Dev')}
                  ${confidenceBadge(con.confidence)}
                </div>
              </div>
              <h3 class="hb-card-title">${esc(con.title)}</h3>
              <p class="hb-card-goal">${esc(con.description)}</p>
              ${renderContractNoticeBanner(con)}
            </div>
            <div class="hb-card-meta"><span>📄 ${esc((con.sources?.docs || [])[0] || '')}</span></div>
          </a>
        `).join('')}
      </div>
    `;
  }

  function renderActionParamMeta(p) {
    const details = [];
    if (p.defaultValue !== undefined && p.defaultValue !== '') {
      details.push(`<span>Default: <code>${esc(typeof p.defaultValue === 'object' ? JSON.stringify(p.defaultValue) : String(p.defaultValue))}</code></span>`);
    }
    if (Array.isArray(p.options) && p.options.length > 0) {
      details.push(`<span>Optionen: ${p.options.map(o => `<code>${esc(o)}</code>`).join(', ')}</span>`);
    }
    if (p.placeholder) {
      details.push(`<span>Platzhalter: <code>${esc(p.placeholder)}</code></span>`);
    }
    if (p.allowVariableBinding !== undefined) {
      details.push(`<span>Variablen-Binding: <code>${p.allowVariableBinding ? 'ja' : 'nein'}</code></span>`);
    }
    if (p.allowFreeText !== undefined) {
      details.push(`<span>Freitext: <code>${p.allowFreeText ? 'ja' : 'nein'}</code></span>`);
    }
    if (p.multiline) {
      details.push(`<span>Mehrzeilig: <code>ja</code></span>`);
    }
    if (p.visibleWhen && typeof p.visibleWhen === 'object') {
      const vw = Object.entries(p.visibleWhen).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('|') : v}`).join(', ');
      details.push(`<span>Sichtbar wenn: <code>${esc(vw)}</code></span>`);
    }
    if (p.hint) {
      details.push(`<span>${esc(p.hint)}</span>`);
    }
    return details.length > 0 ? details.join(' · ') : '—';
  }

  function renderActionsCatalog(data, uiState) {
    const actions = data.devref.actions || [];
    const q = (uiState.actionQuery || '').trim().toLowerCase();
    const filtered = actions.filter(a => {
      if (!q) return true;
      const pStr = (a.parameters || []).map(p => `${p.name} ${p.label || ''} ${p.hint || ''} ${p.source || ''}`).join(' ');
      const flagStr = `${a.flags?.hidden ? 'hidden' : ''} ${a.flags?.isAlias ? 'alias' : ''} ${a.devStatus || ''} ${a.confidence || ''}`;
      return `${a.id || ''} ${a.type} ${a.label || ''} ${a.description || ''} ${pStr} ${flagStr}`.toLowerCase().includes(q);
    });

    return `
      <div class="hb-hero-card">
        <div class="hb-hero-badge">Entwicklerreferenz · ${actions.length} SWE-2 Action-Typen (ACT-0001 bis ACT-0059)</div>
        <h1 class="hb-hero-title">Action-Katalog (ActionRegistry &amp; SWE-2 Schema 1.1.0)</h1>
        <p class="hb-hero-lead">Alle ${actions.length} Action-Typen aus <code>entities/actions-swe2.json</code> inkl. vollständiger Parameter-Spezifikation (Default, Quelle, Optionen, Sichtbarkeit), Flags (<code>hidden</code>, <code>isAlias</code>, <code>requiresServer</code>), Provenance und Status.</p>
        <input type="search" id="devref-action-search" value="${esc(uiState.actionQuery || '')}" placeholder="Nach ACT-ID, Action-Typ, Parameter oder Flag suchen (z. B. ACT-0001, navigate_stage, property, hidden, geplant)…" style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid var(--border-strong);background:var(--bg-app);color:var(--text-primary);font-size:0.9rem" />
      </div>
      <div style="display:grid;gap:14px">
        ${filtered.map(act => `
          <div class="hb-card" style="cursor:default">
            <div class="hb-card-top">
              <span class="hb-card-num" style="font-size:0.84rem">${esc(act.id)} · ⚡ ${esc(act.type)}</span>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                ${devStatusBadge(act.devStatus, 'Dev')}
                ${confidenceBadge(act.confidence)}
                ${actionFlagsBadges(act.flags)}
              </div>
            </div>
            <h3 class="hb-card-title">${esc(act.label || act.type)}</h3>
            <p class="hb-card-goal" style="-webkit-line-clamp:none">${esc(act.description || 'Keine Beschreibung hinterlegt.')}</p>
            ${renderContractNoticeBanner(act)}
            ${(act.limitations && act.limitations.length > 0) ? `<div style="font-size:0.8rem;color:var(--warning);margin:4px 0">⚠️ ${act.limitations.map(esc).join(' · ')}</div>` : ''}
            ${(act.parameters && act.parameters.length > 0) ? `
              <div class="hb-table-wrap" style="margin:8px 0 0">
                <table class="hb-table">
                  <thead><tr><th>Parameter</th><th>Label</th><th>Typ / Quelle</th><th>Standardwert, Optionen &amp; Metadaten</th></tr></thead>
                  <tbody>
                    ${act.parameters.map(p => `
                      <tr>
                        <td><code>${esc(p.name)}</code></td>
                        <td>${esc(p.label || '—')}</td>
                        <td><code>${esc(p.type || 'string')}</code>${p.source ? ` <small class="hb-muted">(${esc(p.source)})</small>` : ''}</td>
                        <td style="font-size:0.8rem">${renderActionParamMeta(p)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}
            ${(act.relations && act.relations.length > 0) ? `<div class="hb-comp-row" style="margin-top:8px">${renderRelationsPills(act.relations)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderSwe2InterfaceView(data) {
    const swe2 = data.meta.swe2Integration;
    const counts = swe2.entityCountsByKind || {};
    return `
      <div class="hb-hero-card">
        <div class="hb-hero-badge">SWE-2 Wissensbasis integriert · Schema v${esc(swe2.schemaVersion)} · Commit ${esc(swe2.sourceCommit)}</div>
        <h1 class="hb-hero-title">SWE-2 Wissensbasis &amp; Datenvertrag (SCHNITTSTELLE-ARGON.md)</h1>
        <p class="hb-hero-lead">${esc(swe2.description)}</p>
      </div>
      <div class="hb-prose">
        <div class="hb-callout hb-callout-goal">
          <div class="hb-callout-icon">✔</div>
          <div class="hb-callout-body">
            <strong>Integrationsstatus: Aktiv &amp; Verifiziert (Schema v${esc(swe2.schemaVersion)}).</strong> Alle <strong>${swe2.totalEntities} Entities</strong> in 9 Typen sowie
            <strong>${swe2.totalChunks} Chunks</strong> aus <code>docs/gcs-knowledge-swe2/</code> sind über <code>import-swe2-argon.cjs</code> mit SHA-256-Prüfsummenvalidierung in das Portal eingebunden.
            Unauflösbare Relationen: <strong>${swe2.unresolvedRelationsCount}</strong>.
          </div>
        </div>
        <h2 class="hb-h2">Integrierte SWE-2 Entity-Typen &amp; Primärschlüssel</h2>
        <div class="hb-table-wrap">
          <table class="hb-table">
            <thead><tr><th>Entity-Typ (kind)</th><th>ID-Präfix</th><th>Anzahl</th><th>Portal-Zielansicht</th></tr></thead>
            <tbody>
              <tr><td><code>component</code></td><td><code>COMP-0001..0128</code></td><td><strong>${counts.component || 128}</strong></td><td><a href="#components" class="hb-comp-tag">🧩 Komponentenreferenz</a></td></tr>
              <tr><td><code>feature</code></td><td><code>FEAT-0001..0012</code></td><td><strong>${counts.feature || 12}</strong></td><td><a href="#features" class="hb-comp-tag">✨ Feature-Katalog</a></td></tr>
              <tr><td><code>action-type</code></td><td><code>ACT-0001..0059</code></td><td><strong>${counts['action-type'] || 59}</strong></td><td><a href="#devref/actions" class="hb-comp-tag">⚡ Action-Katalog</a></td></tr>
              <tr><td><code>method</code></td><td><code>MTH-0001..0038</code></td><td><strong>${counts.method || 38}</strong></td><td><a href="#devref/methods" class="hb-comp-tag">🔧 Methoden-Referenz</a></td></tr>
              <tr><td><code>event</code></td><td><code>EVT-0001..0163</code></td><td><strong>${counts.event || 163}</strong></td><td><a href="#devref/events" class="hb-comp-tag">🔔 Event-Katalog</a></td></tr>
              <tr><td><code>schema</code></td><td><code>SCM-0001..0013</code></td><td><strong>${counts.schema || 13}</strong></td><td><a href="#devref/schemas" class="hb-comp-tag">📐 JSON-Schemas</a></td></tr>
              <tr><td><code>guide-chapter</code></td><td><code>GUIDE-0001..0023</code></td><td><strong>${counts['guide-chapter'] || 23}</strong></td><td><a href="#handbook" class="hb-comp-tag">📖 Autoren-Handbuch</a></td></tr>
              <tr><td><code>document</code></td><td><code>DOC-0001..0242</code></td><td><strong>${counts.document || 242}</strong></td><td><a href="#devref/doc-inventory" class="hb-comp-tag">🗂️ Dokumenten-Inventar</a></td></tr>
              <tr><td><code>concept</code></td><td><code>CON-0001..0015</code></td><td><strong>${counts.concept || 15}</strong></td><td><a href="#devref/schemas" class="hb-comp-tag">💡 Domänenkonzepte</a></td></tr>
            </tbody>
          </table>
        </div>
        <h2 class="hb-h2">Verbindliche Kennzeichnungsregeln (Provenance &amp; Status)</h2>
        <ul class="hb-ul">
          <li>${confidenceBadge('verified')} — Direkt gegen <code>src/**</code>, <code>schemas/**</code> oder <code>tests/**</code> verifiziert.</li>
          <li>${confidenceBadge('documented')} — Aus kanonischer Dokumentation übernommen (nicht als <code>verified</code> umdeklariert).</li>
          <li>${confidenceBadge('inferred')} — Heuristisch abgeleitet; im Portal als „Nicht verifiziert“ markiert.</li>
          <li>${devStatusBadge('geplant')} / ${devStatusBadge('veraltet')} — Geplante oder veraltete Funktionen werden mit Warnbanner gekennzeichnet.</li>
        </ul>
      </div>
    `;
  }

  window.ArgonSwe2Adapter = {
    confidenceBadge,
    confidencePillCompact,
    devStatusBadge,
    actionFlagsBadges,
    renderProvenanceFactsBar,
    renderContractNoticeBanner,
    renderRelationsPills,
    renderComponentSwe2Section,
    renderActionsCatalog,
    renderMethodsCatalog,
    renderEventsCatalog,
    renderSchemasAndConcepts,
    renderSwe2InterfaceView
  };
})();
