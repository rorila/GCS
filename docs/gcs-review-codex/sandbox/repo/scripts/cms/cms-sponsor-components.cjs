// Sponsor-Komponentenmethoden (v8): registrierte Fachoperationen für
// TServerSponsorship / TServerSponsorAgreement / TServerReward /
// TServerPerformance. Jede Methode ist eine klar abgegrenzte atomare
// Operation — Berechtigungen und Integritätsbedingungen werden in den
// Fachmodulen (cms-sponsor/-performance/-rewards) erneut geprüft, nie nur
// im sichtbaren Flow. Mutierende Methoden laufen in einem commit().
const { createSponsor } = require('./cms-sponsor.cjs');
const perf = require('./cms-performance.cjs');
const { createRewards } = require('./cms-rewards.cjs');

module.exports = ({ exprOf }) => {
  const sponsor = createSponsor(null);
  const rewards = createRewards(sponsor, perf);
  const I = sponsor._i;

  const parseJson = (v, fallback) => { try { const r = typeof v === 'string' ? JSON.parse(v) : v; return r && typeof r === 'object' ? r : fallback; } catch { return fallback; } };
  const csv = v => String(v || '').split(',').map(x => x.trim()).filter(Boolean);
  // Flache Eingabefelder der Stages → terms-Objekt der Vereinbarung.
  const flatTerms = b => {
    const keys = b.cardPointMode === 'strict' ? ['cards.promotions','cards.resets'] : b.cardPointMode === 'progress' ? ['cards.promotions'] : b.metricKeysCsv ? csv(b.metricKeysCsv) : (Array.isArray(b.metricKeys) ? b.metricKeys : []);
    const t = {
      ...(b.rewardMode === 'cardRounds' ? { rewardMode: 'cardRounds' } : {}),
      metricKeys: keys,
      pointsTarget: Number(b.pointsTarget),
      rewardText: String(b.rewardText || ''),
      consumePoints: b.consumePoints === true || b.consumePoints === 'true',
      carryOver: b.carryOver === 'carry' ? 'carry' : 'none',
    };
    if (b.from) t.from = b.from; if (b.until) t.until = b.until; if (b.validUntil) t.validUntil = b.validUntil;
    return t;
  };
  // Flache Eingabefelder → scope-Objekt der Sichtfreigabe.
  const flatScope = b => b.scope ? parseJson(b.scope, null) : {
    subjects: b.subjectsCsv ? csv(b.subjectsCsv) : [],
    activities: b.activitiesCsv ? csv(b.activitiesCsv) : [],
    detailLevel: b.detailLevel,
    windowDays: Number(b.windowDays),
  };

  // spec → aufgelöste Parameter + Actor-Sitzung. String-Specs ('$body')
  // werden zuerst per exprOf zum Objekt aufgelöst; Objekt-Felder einzeln.
  const args = (ctx, params) => {
    const spec0 = params?.[0];
    const spec = typeof spec0 === 'string' ? (exprOf(ctx, spec0, {}) || {}) : (spec0 || {});
    const b = {};
    for (const [k, v] of Object.entries(spec)) b[k] = exprOf(ctx, v, {});
    return { s: ctx.session, b };
  };
  const deny = (status, message) => ({ ok: false, status, message });
  const needSession = s => !s ? deny(401, 'Anmeldung erforderlich.') : s.assurance !== 'account' && s.assurance !== 'profile' ? deny(403, 'Konto- oder Profilsitzung erforderlich.') : null;
  const needAccount = s => !s ? deny(401, 'Anmeldung erforderlich.') : s.assurance !== 'account' ? deny(403, 'Kontositzung erforderlich.') : null;
  const needProfile = s => !s ? deny(401, 'Anmeldung erforderlich.') : s.assurance !== 'profile' ? deny(403, 'Profilsitzung (Kind) erforderlich.') : null;

  return {
    TServerSponsorship: {
      // Eltern: Kontakt-Fähigkeit ausstellen (Klartext-Code nur in der Antwort).
      contactCodeCreate(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needAccount(s); if (gate) return gate;
        let out;
        ctx.commit(s, 'sponsor-contact-code', null, next => {
          out = sponsor.createContactCode(next, { actorId: s.personId, childId: b.childId, label: b.label });
          return out;
        });
        return out;
      },
      contactCodes(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needAccount(s); if (gate) return gate;
        return sponsor.listContactCodes(ctx.core.db, { actorId: s.personId, childId: b.childId });
      },
      contactCodeRevoke(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needAccount(s); if (gate) return gate;
        let out;
        ctx.commit(s, 'sponsor-contact-revoke', null, next => {
          out = sponsor.revokeContactCode(next, { actorId: s.personId, capabilityId: b.capabilityId });
          return out;
        });
        return out;
      },
      // Sponsor: Anfrage über Kontaktcode (idempotent über requestId).
      requestCreate(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needAccount(s); if (gate) return gate;
        let out;
        ctx.commit(s, 'sponsor-request', null, next => {
          const days = Number(b.periodDays);
          const periodEnd = b.periodEnd || (Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null);
          out = sponsor.createRequest(next, { sponsorId: s.personId, contactCode: b.contactCode, purpose: b.purpose, periodEnd, notes: b.notes, requestId: b.requestId, commandPayload: { contactCode: b.contactCode, purpose: b.purpose, periodEnd: b.periodEnd, periodDays: b.periodDays, notes: b.notes } });
          return out;
        });
        return out;
      },
      requestWithdraw(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needAccount(s); if (gate) return gate;
        let out;
        ctx.commit(s, 'sponsor-request-withdraw', null, next => {
          out = sponsor.withdrawRequest(next, { sponsorId: s.personId, sponsorshipId: b.sponsorshipId });
          return out;
        });
        return out;
      },
      // Eltern: Anfrage entscheiden (Quorum aller Eltern bei Zustimmung).
      requestDecide(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needAccount(s); if (gate) return gate;
        let out;
        ctx.commit(s, 'sponsor-request-decision', null, next => {
          out = sponsor.decideRequest(next, { sponsorshipId: b.sponsorshipId, guardianId: s.personId, approve: b.approve === true || b.approve === 'true', scope: parseJson(b.scope, undefined) });
          return out;
        });
        return out;
      },
      // Zustandswechsel — Berechtigung hängt vom Akteur ab (Fachmodul prüft).
      pause(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needSession(s); if (gate) return gate;
        let out;
        ctx.commit(s, 'sponsor-pause', null, next => {
          out = sponsor.pause(next, { actorId: s.personId, sponsorshipId: b.sponsorshipId });
          return out;
        });
        return out;
      },
      resume(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needSession(s); if (gate) return gate;
        let out;
        ctx.commit(s, 'sponsor-resume', null, next => {
          out = sponsor.resume(next, { actorId: s.personId, sponsorshipId: b.sponsorshipId });
          return out;
        });
        return out;
      },
      end(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needSession(s); if (gate) return gate;
        let out;
        ctx.commit(s, 'sponsor-end', null, next => {
          out = sponsor.end(next, { actorId: s.personId, sponsorshipId: b.sponsorshipId, reason: b.reason });
          if (out.ok !== false) {
            const sp = I.sponsorship(next, b.sponsorshipId);
            if (sp && sp.status === 'ended') rewards.finalizeOnEnd(next, sp);
          }
          return out;
        });
        return out;
      },
      // Kind: ablehnen bzw. eigene Pause fortsetzen.
      childDecision(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needProfile(s); if (gate) return gate;
        let out;
        ctx.commit(s, 'sponsor-child-decision', null, next => {
          out = sponsor.childDecision(next, { childId: s.personId, sponsorshipId: b.sponsorshipId, accept: b.accept === true || b.accept === 'true' });
          if (out.ok !== false && b.accept) {
            const sp = I.sponsorship(next, b.sponsorshipId);
            if (sp) perf.evaluateSponsorship(next, sp, { notify: I.notify });
          }
          return out;
        });
        return out;
      },
      // Sichtfreigaben.
      accessPropose(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needAccount(s); if (gate) return gate;
        let out;
        ctx.commit(s, 'sponsor-access-propose', null, next => {
          out = sponsor.proposeAccess(next, { actorId: s.personId, sponsorshipId: b.sponsorshipId, scope: flatScope(b) });
          return out;
        });
        return out;
      },
      accessConsent(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needAccount(s); if (gate) return gate;
        if (![true, false, 'true', 'false'].includes(b.approve)) return deny(400, 'Bitte ausdrücklich zustimmen oder ablehnen.');
        let out;
        ctx.commit(s, 'sponsor-access-consent', null, next => {
          out = sponsor.consentAccess(next, { actorId: s.personId, sponsorshipId: b.sponsorshipId, versionId: b.versionId, approve: b.approve !== false && b.approve !== 'false' });
          return out;
        });
        return out;
      },
      // Lesesichten.
      listSponsor(ctx) {
        const { s } = args(ctx, []);
        const gate = needAccount(s); if (gate) return gate;
        if (!I.isSponsor(ctx.core.db, s.personId)) return deny(403, 'Keine Sponsor-Berechtigung.');
        return sponsor.listForSponsor(ctx.core.db, { sponsorId: s.personId });
      },
      listParent(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needAccount(s); if (gate) return gate;
        return sponsor.listForParent(ctx.core.db, { actorId: s.personId, childId: b.childId, sponsorshipId: b.sponsorshipId });
      },
      listChild(ctx) {
        const { s } = args(ctx, []);
        const gate = needProfile(s); if (gate) return gate;
        return sponsor.listForChild(ctx.core.db, { childId: s.personId });
      },
      progress(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needSession(s); if (gate) return gate;
        return sponsor.progress(ctx.core.db, { actorId: s.personId, sponsorshipId: b.sponsorshipId });
      },
      history(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needSession(s); if (gate) return gate;
        return sponsor.history(ctx.core.db, { actorId: s.personId, sponsorshipId: b.sponsorshipId });
      },
      obligations(ctx) {
        const { s } = args(ctx, []);
        const gate = needAccount(s); if (gate) return gate;
        if (!I.isSponsor(ctx.core.db, s.personId)) return deny(403, 'Keine Sponsor-Berechtigung.');
        return sponsor.obligations(ctx.core.db, { sponsorId: s.personId });
      },
      messageSend(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needSession(s); if (gate) return gate;
        let out;
        ctx.commit(s, 'sponsor-message', null, next => {
          out = sponsor.sendMessage(next, { actorId: s.personId, sponsorshipId: b.sponsorshipId, targetType: b.targetType || 'sponsorship', targetId: b.targetId || '', text: b.text });
          return out;
        });
        return out;
      },
      messageList(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needSession(s); if (gate) return gate;
        return sponsor.listMessages(ctx.core.db, { actorId: s.personId, sponsorshipId: b.sponsorshipId });
      },
      notifications(ctx) {
        const { s } = args(ctx, []);
        const gate = needSession(s); if (gate) return gate;
        return sponsor.notificationsFor(ctx.core.db, { personId: s.personId });
      },
      notificationRead(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needSession(s); if (gate) return gate;
        let out;
        ctx.commit(s, 'sponsor-notification-read', null, next => {
          out = sponsor.markNotificationRead(next, { personId: s.personId, notificationId: b.notificationId });
          return out;
        });
        return out;
      },
    },

    TServerSponsorAgreement: {
      list(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needSession(s); if (gate) return gate;
        const db = ctx.core.db, sp = I.sponsorship(db, b.sponsorshipId);
        if (!sp) return deny(404, 'Begleitung nicht gefunden.');
        const allowed = I.canReadRelationship(db, sp, s.personId);
        if (!allowed) return deny(403, 'Keine Berechtigung.');
        return { ok: true, items: I.agreementsOf(db, sp.id).map(a => ({ id: a.id, activeVersion: a.activeVersion, versions: db.sponsorAgreementVersions.filter(v => v.agreementId === a.id).map(v => ({ id: a.id + ':' + v.version, agreementId: a.id, version: v.version, status: v.status, terms: v.terms, proposedBy: v.proposedBy, createdAt: v.createdAt })) })) };
      },
      propose(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needSession(s); if (gate) return gate;
        if (b.cardPointMode != null && !['progress','strict'].includes(b.cardPointMode)) return deny(400, 'Ungültige Karteikasten-Zählregel.');
        let out;
        ctx.commit(s, 'sponsor-agreement-propose', null, next => {
          let terms = parseJson(b.terms, null) || flatTerms(b);
          // Ein kindseitiger Ziel-/Belohnungsvorschlag übernimmt die übrigen
          // Bedingungen der gewählten Version, statt sie still zurückzusetzen.
          if (!Array.isArray(terms.metricKeys)) return out = deny(400, 'Ungültige Leistungskennzahlen.');
          if (!terms.metricKeys.length) {
            const ag = I.agreementsOf(next, b.sponsorshipId).find(a => a.activeVersion);
            const base = ag && next.sponsorAgreementVersions.find(v => v.agreementId === ag.id && v.version === Number(b.baseVersion || ag.activeVersion));
            if (base) terms = { ...base.terms, pointsTarget: Number(b.pointsTarget), rewardText: String(b.rewardText || '') };
          }
          out = sponsor.proposeAgreement(next, { actorId: s.personId, sponsorshipId: b.sponsorshipId, terms, proposalId: b.proposalId });
          return out;
        });
        return out;
      },
      consent(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needAccount(s); if (gate) return gate;
        if (![true, false, 'true', 'false'].includes(b.approve)) return deny(400, 'Bitte ausdrücklich zustimmen oder ablehnen.');
        let out;
        ctx.commit(s, 'sponsor-agreement-consent', null, next => {
          out = sponsor.consentAgreement(next, { actorId: s.personId, agreementId: b.agreementId, version: Number(b.version), approve: b.approve !== false && b.approve !== 'false' });
          // Wirksamwerden löst die Anspruchsbewertung noch im selben Commit aus.
          if (out.ok !== false && out.activate) {
            const ag = I.agreement(next, b.agreementId);
            const sp = ag && I.sponsorship(next, ag.sponsorshipId);
            if (sp) perf.evaluateSponsorship(next, sp, { notify: I.notify });
          }
          return out;
        });
        return out;
      },
      diff(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needSession(s); if (gate) return gate;
        return sponsor.diffAgreement(ctx.core.db, { actorId: s.personId, agreementId: b.agreementId, version: Number(b.version) });
      },
    },

    TServerReward: {
      list(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needSession(s); if (gate) return gate;
        return rewards.listFor(ctx.core.db, { actorId: s.personId, sponsorshipId: b.sponsorshipId });
      },
      request(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needSession(s); if (gate) return gate;
        let out;
        ctx.commit(s, 'sponsor-claim-request', null, next => {
          out = rewards.requestRedemption(next, { actorId: s.personId, claimKey: b.claimKey, requestId: b.requestId });
          return out;
        });
        return out;
      },
      decision(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needAccount(s); if (gate) return gate;
        let out;
        ctx.commit(s, 'sponsor-claim-decision', null, next => {
          out = rewards.guardianDecision(next, { actorId: s.personId, claimKey: b.claimKey, approve: b.approve === true || b.approve === 'true', reason: b.reason });
          return out;
        });
        return out;
      },
      cancel(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needAccount(s); if (gate) return gate;
        let out;
        ctx.commit(s, 'sponsor-claim-cancel', null, next => {
          out = rewards.cancelClaim(next, { actorId: s.personId, claimKey: b.claimKey, reason: b.reason });
          return out;
        });
        return out;
      },
      fulfillmentReport(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needAccount(s); if (gate) return gate;
        let out;
        ctx.commit(s, 'sponsor-fulfillment-report', null, next => {
          out = rewards.fulfillmentReport(next, { actorId: s.personId, claimKey: b.claimKey, note: b.note });
          return out;
        });
        return out;
      },
      fulfillmentConfirm(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needAccount(s); if (gate) return gate;
        let out;
        ctx.commit(s, 'sponsor-fulfillment-confirm', null, next => {
          out = rewards.confirmFulfillment(next, { actorId: s.personId, claimKey: b.claimKey });
          return out;
        });
        return out;
      },
    },

    TServerPerformance: {
      // Elterliche Leistungsanerkennung — einzige nicht-automatische Quelle.
      recognize(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needAccount(s); if (gate) return gate;
        let out;
        ctx.commit(s, 'sponsor-performance-recognize', null, next => {
          if (!I.isGuardianOf(next, b.childId, s.personId)) { out = deny(403, 'Nur Erziehungsberechtigte erkennen Leistungen an.'); return out; }
          out = perf.recognize(next, { childId: b.childId, actorId: s.personId, metricKey: b.metricKey, value: Number(b.value), unit: b.unit, occurredAt: b.occurredAt, progressEventId: b.progressEventId, note: b.note });
          if (out.ok !== false) perf.evaluateAllForChild(next, b.childId, { notify: I.notify });
          return out;
        });
        return out;
      },
      // Lesesicht für Eltern: geprüftes Ledger des Kindes (keine Rohinhalte).
      ledger(ctx, _c, params) {
        const { s, b } = args(ctx, params);
        const gate = needAccount(s); if (gate) return gate;
        const db = ctx.core.db;
        if (!I.isGuardianOf(db, b.childId, s.personId)) return deny(403, 'Nur Erziehungsberechtigte sehen das Leistungskonto.');
        return {
          ok: true,
          items: db.performanceLedger.filter(e => e.childId === b.childId)
            .map(e => ({ id: e.eventId, eventId: e.eventId, sourceEventId: e.sourceEventId, metricKey: e.metricKey, points: e.points, value: e.value, unit: e.unit, occurredAt: e.occurredAt, verification: e.verification === 'verified' && e.provenance !== 'server' ? 'reported' : e.verification, provenance: e.provenance })),
        };
      },
      rules(ctx) {
        const { s } = args(ctx, []);
        const gate = needSession(s); if (gate) return gate;
        const items = [...new Map(ctx.core.db.performanceRuleVersions.filter(r => r.status === 'published').map(r => [perf.metricKeyOf(r), { metricKey: perf.metricKeyOf(r), subjectKey: r.subjectKey, activityKey: r.activityKey, pointsPerUnit: r.pointsPerUnit }])).values()];
        return { ok: true, items };
      },
    },
  };
};
