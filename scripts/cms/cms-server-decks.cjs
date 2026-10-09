// Kartenstapel (cardDecks): Sammlungen von Lernkarten, die Kindern zugeordnet
// werden — nicht Räumen. Zwei Arten:
//   ownerType 'account' — verwalteter Stapel (Erwachsene: Eltern/HouseAdmin/
//     RaumAdmin/SuperAdmin erstellen, publizieren und ordnen Kindern zu)
//   ownerType 'child'   — Kind-Stapel aus eigenem Kasten ("Thema teilen");
//     Veröffentlichung wartet auf Erwachsenen-Freigabe (pendingApproval)
// Stapelkarten sind flashcards-Rows mit deckId statt childId (kein Lernfach —
// Lernstand existiert nur in Kinder-Kästen). Übernehmen = Kopieren in den
// Kasten (box 1) mit sourceDeckId/sourceCardId; Nachladen dedupliziert darüber.
// Fabrik: exprOf wird injiziert (kein Require-Zyklus zu cms-server-components).
const crypto = require('node:crypto');
const { areaActive, childrenOf, houseOfPerson, activeRoles } = require('./cms-core.cjs');

module.exports = ({ exprOf }) => {

// Stapelkarten-DTO für die Galerie-Vorschau (kein Lernfach — Stapel kennen
// keinen Leitner-Stand).
const deckCardDto = (db, c) => {
  const by = db.people.find(p => p.id === c.createdBy);
  return { id: c.id, subject: c.subject, topic: c.topic, question: c.question, answers: c.answers, answerFormat: c.answerFormat, createdByName: by?.name || '', createdAt: c.createdAt };
};

const deckDto = (db, d, childId) => {
  const cards = db.flashcards.filter(c => c.deckId === d.id && c.active !== false);
  const imported = childId ? db.flashcards.filter(c => c.childId === childId && c.active !== false && c.sourceDeckId === d.id) : [];
  const have = new Set(imported.map(c => c.sourceCardId).filter(Boolean));
  const owner = db.people.find(p => p.id === d.ownerId);
  const own = !!childId && d.ownerId === childId;
  const newCards = cards.filter(c => !have.has(c.id)).length;
  return {
    id: d.id, name: d.name, description: d.description || '', subject: d.subject || '',
    ownerType: d.ownerType, ownerId: d.ownerId, ownerName: owner?.name || '',
    published: !!d.published, pendingApproval: !!d.pendingApproval, own,
    status: d.pendingApproval ? 'wartet auf Freigabe' : d.published ? 'veröffentlicht' : 'Entwurf',
    publishable: own && !d.published && !d.pendingApproval,
    unpublishable: own && !!d.published,
    cardCount: cards.length, newCards, hasNew: newCards > 0, importedCount: imported.length,
    assignedChildIds: d.assignedChildIds || [], createdAt: d.createdAt, updatedAt: d.updatedAt,
  };
};

const findDeck = (db, id) => (db.cardDecks || []).find(d => d.id === id && d.active !== false);
const norm = v => String(v ?? '').trim();
const nowIso = () => new Date().toISOString();
const answersOf = raw => (Array.isArray(raw) ? raw : String(raw || '').split(/\r?\n|;|\|/)).map(norm).filter(Boolean);

return { TServerDecks: {
  dto(_ctx, _component, params) { return params?.[0] || {}; },

  // Sichtbare Stapel eines Kasten-Kontexts: eigene + zugeordnete +
  // freigegebene Haus-Stapel (viewDeck in can(), Kontext via viewCards).
  decks(ctx, _c, params) {
    const spec = params?.[0] || {}, db = ctx.core.db, s = ctx.session;
    const childId = exprOf(ctx, spec.childId, {}) || s.personId;
    if (!ctx.core.can(s, 'viewCards', { childId })) return { ok: false, status: 403, message: 'Kein Zugriff auf diesen Karteikasten.' };
    const items = (db.cardDecks || []).filter(d => d.active !== false && ctx.core.can(s, 'viewDeck', { deck: d, childId }))
      .map(d => ({ ...deckDto(db, d, childId), editable: ctx.core.can(s, 'manageDeck', { deck: d }) }));
    return { ok: true, items, message: items.length ? items.length + ' Stapel' : 'Noch keine Stapel verfügbar.' };
  },

  // Einzelner Stapel für die Bearbeitungs-Stage: Metadaten + Rechte-Flags.
  // Sichtbar für Verwaltende (manageDeck) und Freigabestellen (approveDeck).
  deckInfo(ctx, _c, params) {
    const spec = params?.[0] || {}, db = ctx.core.db, s = ctx.session;
    const deck = findDeck(db, exprOf(ctx, spec.deckId, {}));
    if (!deck) return { ok: false, status: 404, message: 'Stapel nicht gefunden.' };
    const manageable = ctx.core.can(s, 'manageDeck', { deck });
    const approvable = ctx.core.can(s, 'approveDeck', { deck });
    if (!manageable && !approvable) return { ok: false, status: 403, message: 'Kein Zugriff auf diesen Stapel.' };
    return { ok: true, deck: { ...deckDto(db, deck, null), manageable, canPublish: manageable && !deck.published && !deck.pendingApproval, canUnpublish: manageable && !!deck.published, canApprove: approvable && !!deck.pendingApproval } };
  },

  // Erwachsenen-Sicht: verwaltbare Stapel + ausstehende Freigaben der
  // eigenen Zuständigkeit (Eltern: Stapel der eigenen Kinder).
  decksManage(ctx) {
    const db = ctx.core.db, s = ctx.session;
    const manage = (db.cardDecks || []).filter(d => d.active !== false && ctx.core.can(s, 'manageDeck', { deck: d }));
    const pending = (db.cardDecks || []).filter(d => d.active !== false && ctx.core.can(s, 'approveDeck', { deck: d }));
    const mine = new Set(manage.map(d => d.id));
    const items = [
      ...manage.map(d => ({ ...deckDto(db, d, null), manageable: true, canPublish: !d.published, canUnpublish: !!d.published, canApprove: false })),
      ...pending.filter(d => !mine.has(d.id)).map(d => ({ ...deckDto(db, d, null), manageable: false, canPublish: false, canUnpublish: false, canApprove: true })),
    ];
    return { ok: true, items };
  },

  // Stapelkarten zur Vorschau — sichtbar für Empfänger (viewDeck),
  // Pflegende (manageDeck) und Freigebende (approveDeck).
  deckCards(ctx, _c, params) {
    const spec = params?.[0] || {}, db = ctx.core.db, s = ctx.session;
    const deck = findDeck(db, exprOf(ctx, spec.deckId, {}));
    if (!deck) return { ok: false, status: 404, message: 'Stapel nicht gefunden.' };
    const childId = exprOf(ctx, spec.childId, {}) || s.personId;
    if (!ctx.core.can(s, 'viewDeck', { deck, childId }) && !ctx.core.can(s, 'manageDeck', { deck }) && !ctx.core.can(s, 'approveDeck', { deck }))
      return { ok: false, status: 403, message: 'Kein Zugriff auf diesen Stapel.' };
    return { ok: true, items: db.flashcards.filter(c => c.deckId === deck.id && c.active !== false).map(c => deckCardDto(db, c)) };
  },

  // Stapel anlegen oder Metadaten ändern. Kind → ownerType 'child' +
  // Haus aus Mitgliedschaft; Erwachsene → 'account'.
  deckSave(ctx, _c, params) {
    const spec = params?.[0] || {}, db = ctx.core.db, s = ctx.session;
    const deckId = exprOf(ctx, spec.deckId, {});
    const name = norm(exprOf(ctx, spec.name, {})), subject = norm(exprOf(ctx, spec.subject, {})), description = norm(exprOf(ctx, spec.description, {}));
    if (deckId) {
      const deck = findDeck(db, deckId);
      if (!deck) return { ok: false, status: 404, message: 'Stapel nicht gefunden.' };
      if (!ctx.core.can(s, 'manageDeck', { deck })) return { ok: false, status: 403, message: 'Dieser Stapel kann nicht geändert werden.' };
      ctx.commit(s, 'deck-update', deck.houseId, next => {
        const d = next.cardDecks.find(x => x.id === deckId);
        d.name = name || d.name; d.subject = subject; d.description = description; d.updatedAt = nowIso();
      });
      return { ok: true, deckId, message: 'Stapel gespeichert.' };
    }
    if (!name) return { ok: false, status: 400, message: 'Der Stapel braucht einen Namen.' };
    if (!ctx.core.can(s, 'createDeck')) return { ok: false, status: 403, message: 'Keine Berechtigung zum Stapel anlegen.' };
    const person = db.people.find(p => p.id === s.personId);
    const ownerType = person?.kind === 'child' ? 'child' : 'account';
    const id = 'deck-' + crypto.randomUUID(), now = nowIso();
    ctx.commit(s, 'deck-create', houseOfPerson(db, s.personId), next => {
      next.cardDecks.push({ id, name, subject, description, ownerType, ownerId: s.personId, houseId: houseOfPerson(db, s.personId), published: false, pendingApproval: false, assignedChildIds: [], active: true, createdAt: now, updatedAt: now });
    });
    return { ok: true, deckId: id, message: 'Stapel angelegt.' };
  },

  // Stapel entfernen (weich) — seine Karten werden mit deaktiviert.
  deckRemove(ctx, _c, params) {
    const spec = params?.[0] || {}, db = ctx.core.db, s = ctx.session;
    const deck = findDeck(db, exprOf(ctx, spec.deckId, {}));
    if (!deck) return { ok: false, status: 404, message: 'Stapel nicht gefunden.' };
    if (!ctx.core.can(s, 'manageDeck', { deck })) return { ok: false, status: 403, message: 'Dieser Stapel kann nicht gelöscht werden.' };
    ctx.commit(s, 'deck-delete', deck.houseId, next => {
      const d = next.cardDecks.find(x => x.id === deck.id); if (d) { d.active = false; d.updatedAt = nowIso(); }
      for (const c of next.flashcards.filter(x => x.deckId === deck.id)) c.active = false;
    });
    return { ok: true, message: 'Stapel gelöscht.' };
  },

  // Karte im Stapel anlegen/ändern (Pflegende; Kind nur im Entwurfsstatus).
  deckCardSave(ctx, _c, params) {
    const spec = params?.[0] || {}, db = ctx.core.db, s = ctx.session;
    const deck = findDeck(db, exprOf(ctx, spec.deckId, {}));
    if (!deck) return { ok: false, status: 404, message: 'Stapel nicht gefunden.' };
    if (!ctx.core.can(s, 'manageDeck', { deck })) return { ok: false, status: 403, message: 'Dieser Stapel kann nicht geändert werden.' };
    const cardId = exprOf(ctx, spec.cardId, {});
    const question = norm(exprOf(ctx, spec.question, {})), subject = norm(exprOf(ctx, spec.subject, {})), topic = norm(exprOf(ctx, spec.topic, {}));
    const answers = answersOf(exprOf(ctx, spec.answers, {}));
    const answerFormat = ['text', 'self'].includes(exprOf(ctx, spec.answerFormat, {})) ? exprOf(ctx, spec.answerFormat, {}) : 'text';
    if (!question || !subject) return { ok: false, status: 400, message: 'Frage und Schulfach sind Pflicht.' };
    if (answerFormat === 'text' && !answers.length) return { ok: false, status: 400, message: 'Mindestens eine akzeptierte Antwort angeben.' };
    if (cardId) {
      const card = db.flashcards.find(c => c.id === cardId && c.deckId === deck.id && c.active !== false);
      if (!card) return { ok: false, status: 404, message: 'Karte nicht gefunden.' };
      ctx.commit(s, 'deck-card-update', deck.houseId, next => {
        const c = next.flashcards.find(x => x.id === cardId);
        c.question = question; c.subject = subject; c.topic = topic; c.answers = answers; c.answerFormat = answerFormat; c.updatedAt = nowIso();
      });
      return { ok: true, cardId, message: 'Stapelkarte gespeichert.' };
    }
    const id = 'card-' + crypto.randomUUID();
    ctx.commit(s, 'deck-card-create', deck.houseId, next => {
      next.flashcards.push({ id, deckId: deck.id, subject, topic, question, answers, answerFormat, createdBy: s.personId, createdAt: nowIso(), updatedAt: nowIso(), active: true });
      const d = next.cardDecks.find(x => x.id === deck.id); if (d) d.updatedAt = nowIso();
    });
    return { ok: true, cardId: id, message: 'Karte angelegt.' };
  },

  deckCardRemove(ctx, _c, params) {
    const spec = params?.[0] || {}, db = ctx.core.db, s = ctx.session;
    const deck = findDeck(db, exprOf(ctx, spec.deckId, {}));
    if (!deck) return { ok: false, status: 404, message: 'Stapel nicht gefunden.' };
    if (!ctx.core.can(s, 'manageDeck', { deck })) return { ok: false, status: 403, message: 'Dieser Stapel kann nicht geändert werden.' };
    const cardId = exprOf(ctx, spec.cardId, {});
    const card = db.flashcards.find(c => c.id === cardId && c.deckId === deck.id && c.active !== false);
    if (!card) return { ok: false, status: 404, message: 'Karte nicht gefunden.' };
    ctx.commit(s, 'deck-card-delete', deck.houseId, next => { const c = next.flashcards.find(x => x.id === cardId); if (c) c.active = false; });
    return { ok: true, message: 'Stapelkarte gelöscht.' };
  },

  // Veröffentlichen: Kind-Eigentümer beantragt die Erwachsenen-Freigabe
  // (pendingApproval); Erwachsene mit manageDeck schalten published direkt.
  deckPublish(ctx, _c, params) {
    const spec = params?.[0] || {}, db = ctx.core.db, s = ctx.session;
    const deck = findDeck(db, exprOf(ctx, spec.deckId, {}));
    if (!deck) return { ok: false, status: 404, message: 'Stapel nicht gefunden.' };
    const publish = exprOf(ctx, spec.publish, {}) !== false && exprOf(ctx, spec.publish, {}) !== 'false';
    const isOwner = deck.ownerId === s.personId;
    if (deck.ownerType === 'child' && isOwner) {
      if (deck.published) return { ok: false, status: 409, message: 'Der Stapel ist veröffentlicht — Rücknahme über Erwachsene.' };
      ctx.commit(s, 'deck-publish-request', deck.houseId, next => {
        const d = next.cardDecks.find(x => x.id === deck.id);
        d.pendingApproval = publish; d.updatedAt = nowIso();
      });
      return { ok: true, message: publish ? 'Freigabe angefragt — Erwachsene prüfen den Stapel.' : 'Freigabe-Anfrage zurückgezogen.' };
    }
    if (!ctx.core.can(s, 'manageDeck', { deck })) return { ok: false, status: 403, message: 'Keine Berechtigung zum Veröffentlichen.' };
    ctx.commit(s, 'deck-publish', deck.houseId, next => {
      const d = next.cardDecks.find(x => x.id === deck.id);
      d.published = publish; d.pendingApproval = false; d.updatedAt = nowIso();
    });
    return { ok: true, message: publish ? 'Stapel veröffentlicht — jetzt Kindern zuordnen.' : 'Veröffentlichung beendet.' };
  },

  // Erwachsenen-Freigabe für Kind-Stapel: approve → published; Ablehnung
  // stellt den Entwurfsstatus wieder her.
  deckApprove(ctx, _c, params) {
    const spec = params?.[0] || {}, db = ctx.core.db, s = ctx.session;
    const deck = findDeck(db, exprOf(ctx, spec.deckId, {}));
    if (!deck) return { ok: false, status: 404, message: 'Stapel nicht gefunden.' };
    if (!ctx.core.can(s, 'approveDeck', { deck })) return { ok: false, status: 403, message: 'Keine Freigabeberechtigung für diesen Stapel.' };
    const approve = exprOf(ctx, spec.approve, {}) !== false && exprOf(ctx, spec.approve, {}) !== 'false';
    ctx.commit(s, approve ? 'deck-approve' : 'deck-reject', deck.houseId, next => {
      const d = next.cardDecks.find(x => x.id === deck.id);
      d.pendingApproval = false; if (approve) d.published = true; d.updatedAt = nowIso();
    });
    return { ok: true, message: approve ? 'Stapel freigegeben — für Hauskinder sichtbar.' : 'Freigabe abgelehnt — Stapel bleibt Entwurf.' };
  },

  // Stapel einem Kind zuordnen oder Zuordnung lösen (assign: true|false).
  // Beim Zuordnen landen die Stapelkarten sofort als Kopien in Fach 1 des
  // Kindes (Dedup über sourceCardId); beim Entfernen bleiben Kopien erhalten.
  deckAssign(ctx, _c, params) {
    const spec = params?.[0] || {}, db = ctx.core.db, s = ctx.session;
    const deck = findDeck(db, exprOf(ctx, spec.deckId, {}));
    if (!deck) return { ok: false, status: 404, message: 'Stapel nicht gefunden.' };
    const childId = norm(exprOf(ctx, spec.childId, {}));
    if (!childId) return { ok: false, status: 400, message: 'Kein Kind angegeben.' };
    if (!ctx.core.can(s, 'assignDeck', { deck, childId })) return { ok: false, status: 403, message: 'Diesem Kind darf kein Stapel zugeordnet werden.' };
    const assign = exprOf(ctx, spec.assign, {}) !== false && exprOf(ctx, spec.assign, {}) !== 'false';
    const now = nowIso(); let added = 0;
    ctx.commit(s, assign ? 'deck-assign' : 'deck-unassign', deck.houseId, next => {
      const d = next.cardDecks.find(x => x.id === deck.id);
      const list = new Set(d.assignedChildIds || []);
      if (assign) list.add(childId); else list.delete(childId);
      d.assignedChildIds = [...list]; d.updatedAt = now;
      if (assign) {
        const have = new Set(next.flashcards.filter(c => c.childId === childId && c.sourceDeckId === deck.id).map(c => c.sourceCardId));
        for (const c of next.flashcards.filter(c => c.deckId === deck.id && c.active !== false && !have.has(c.id))) {
          next.flashcards.push({ id: 'card-' + crypto.randomUUID(), childId, subject: c.subject, topic: c.topic, question: c.question, answers: c.answers, answerFormat: c.answerFormat, box: 1, status: 'active', createdBy: s.personId, sourceDeckId: deck.id, sourceCardId: c.id, createdAt: now, updatedAt: now, lastReviewedAt: null, active: true });
          added++;
        }
      }
    });
    const child = db.people.find(p => p.id === childId);
    return { ok: true, added, message: assign ? `Stapel ${child?.name || childId} zugeordnet — ${added} Karte${added === 1 ? '' : 'n'} in Fach 1.` : `Zuordnung zu ${child?.name || childId} gelöst.` };
  },

  // Kinder im Zuordnungsbereich der Sitzung (für die Zuordnungs-UI):
  // Eltern → eigene Kinder; HouseAdmin → Hausbewohner; RaumAdmin →
  // Raummitglieder; SuperAdmin → alle.
  deckAssignables(ctx, _c, params) {
    const spec = params?.[0] || {}, db = ctx.core.db, s = ctx.session;
    const deck = findDeck(db, exprOf(ctx, spec.deckId, {}));
    if (!deck) return { ok: false, status: 404, message: 'Stapel nicht gefunden.' };
    const ids = new Set(childrenOf(db, s.personId));
    const rs = activeRoles(db, s);
    if (rs.some(r => r.role === 'superAdmin' && r.areaId === 'root'))
      db.people.filter(p => p.kind === 'child' && p.active).forEach(p => ids.add(p.id));
    for (const r of rs.filter(r => r.role === 'areaAdmin')) {
      const area = db.areas.find(a => a.id === r.areaId);
      if (!area) continue;
      db.memberships
        .filter(m => m.active && m.areaId === area.id && areaActive(db, m.areaId))
        .map(m => db.people.find(p => p.id === m.personId))
        .filter(p => p?.kind === 'child' && p.active)
        .forEach(p => ids.add(p.id));
    }
    const items = [...ids].map(id => {
      const p = db.people.find(x => x.id === id);
      const assigned = (deck.assignedChildIds || []).includes(id);
      const assignable = ctx.core.can(s, 'assignDeck', { deck, childId: id });
      return { id, name: p?.name || id, avatar: p?.avatar || '👤', assigned, assignedLabel: assigned ? '✔' : '—', assignable, canAssign: assignable && !assigned, canUnassign: assignable && assigned };
    });
    return { ok: true, items };
  },

  // Kind teilt ein Thema seines Kastens: neuer Entwurfs-Stapel mit Kopien
  // der eigenen Karten dieses subject (+ topic).
  deckFromTopic(ctx, _c, params) {
    const spec = params?.[0] || {}, db = ctx.core.db, s = ctx.session;
    const person = db.people.find(p => p.id === s.personId);
    if (person?.kind !== 'child') return { ok: false, status: 403, message: 'Nur Kinder teilen Kasten-Themen als Stapel.' };
    if (!ctx.core.can(s, 'createDeck')) return { ok: false, status: 403, message: 'Keine Berechtigung zum Stapel anlegen.' };
    const subject = norm(exprOf(ctx, spec.subject, {})), topic = norm(exprOf(ctx, spec.topic, {}));
    if (!subject) return { ok: false, status: 400, message: 'Schulfach fehlt.' };
    const cards = db.flashcards.filter(c => c.childId === s.personId && c.active !== false && c.subject === subject && (!topic || c.topic === topic));
    if (!cards.length) return { ok: false, status: 400, message: 'Keine Karten zu diesem Thema im Kasten.' };
    const name = norm(exprOf(ctx, spec.name, {})) || [subject, topic].filter(Boolean).join(' · ');
    const description = norm(exprOf(ctx, spec.description, {}));
    const deckId = 'deck-' + crypto.randomUUID(), now = nowIso();
    ctx.commit(s, 'deck-from-topic', houseOfPerson(db, s.personId), next => {
      next.cardDecks.push({ id: deckId, name, subject, description, ownerType: 'child', ownerId: s.personId, houseId: houseOfPerson(db, s.personId), published: false, pendingApproval: false, assignedChildIds: [], active: true, createdAt: now, updatedAt: now });
      for (const c of cards)
        next.flashcards.push({ id: 'card-' + crypto.randomUUID(), deckId, subject: c.subject, topic: c.topic, question: c.question, answers: c.answers, answerFormat: c.answerFormat, createdBy: s.personId, createdAt: now, updatedAt: now, active: true });
    });
    return { ok: true, deckId, cardCount: cards.length, message: `Stapel „${name}" mit ${cards.length} Karten angelegt — in der Stapel-Galerie veröffentlichen.` };
  },

  // Übernahme: fehlende Stapelkarten als Kopien in den Kasten (Fach 1).
  // Dedup über sourceCardId — erneutes Übernehmen lädt nur neue Karten nach.
  deckImport(ctx, _c, params) {
    const spec = params?.[0] || {}, db = ctx.core.db, s = ctx.session;
    const deck = findDeck(db, exprOf(ctx, spec.deckId, {}));
    if (!deck) return { ok: false, status: 404, message: 'Stapel nicht gefunden.' };
    const childId = exprOf(ctx, spec.childId, {}) || s.personId;
    if (!ctx.core.can(s, 'viewDeck', { deck, childId })) return { ok: false, status: 403, message: 'Dieser Stapel ist nicht sichtbar.' };
    if (!ctx.core.can(s, 'manageCards', { childId })) return { ok: false, status: 403, message: 'Kein Zugriff auf diesen Karteikasten.' };
    const have = new Set(db.flashcards.filter(c => c.childId === childId && c.sourceDeckId === deck.id).map(c => c.sourceCardId));
    const fresh = db.flashcards.filter(c => c.deckId === deck.id && c.active !== false && !have.has(c.id));
    if (!fresh.length) return { ok: true, added: 0, message: 'Alle Stapelkarten sind bereits im Kasten.' };
    const now = nowIso();
    ctx.commit(s, 'deck-import', childId, next => {
      for (const c of fresh)
        next.flashcards.push({ id: 'card-' + crypto.randomUUID(), childId, subject: c.subject, topic: c.topic, question: c.question, answers: c.answers, answerFormat: c.answerFormat, box: 1, status: 'active', createdBy: s.personId, sourceDeckId: deck.id, sourceCardId: c.id, createdAt: now, updatedAt: now, lastReviewedAt: null, active: true });
    });
    return { ok: true, added: fresh.length, message: fresh.length + (fresh.length === 1 ? ' Karte übernommen (Fach 1).' : ' Karten übernommen (Fach 1).') };
  },
} };
};
