const assert = require('node:assert/strict');
const path = require('node:path');
const { Readable } = require('node:stream');
const { test } = require('node:test');
const { createEditorTestService, PLAYERS } = require('./cms/cms-editor-test.cjs');
const project = require('../game-server/public/projects/Karteikasten-Quiz.json');

test('All editor test players can start all decks under house and room permissions', async () => {
  const service = createEditorTestService({ cmsFile: path.resolve(__dirname, '../game-server/public/projects/GCS-CMS.json') });
  try {
    for (const player of Object.keys(PLAYERS)) {
      for (const deck of ['math', 'self', 'empty']) {
        const req = Object.assign(Readable.from([Buffer.from(JSON.stringify({ player, deck, project }))]), {
          method: 'POST', url: '/api/cms/editor-test/start',
          socket: { remoteAddress: '127.0.0.1' },
          headers: { 'content-type': 'application/json', 'x-gcs-editor-test': '1' }
        });
        const result = await service.handle(req);
        assert.equal(result.status, 200, JSON.stringify(result));
        assert.equal(result.data.ok, true);
        assert.ok(result.data.launchKey);
        const play = async body => service.handle(Object.assign(Readable.from([Buffer.from(JSON.stringify({ launchKey: result.data.launchKey, ...body }))]), {
          method: 'POST', url: '/api/cms/editor-test/play', socket: { remoteAddress: '127.0.0.1' }, headers: {}
        }));
        const drawn = await play({ action: 'cardNext', learningPoints: true });
        assert.equal(drawn.data.ok, true, JSON.stringify(drawn));
        if (drawn.data.card) {
          const answered = await play({ action: 'cardAnswer', cardId: drawn.data.card.id, attemptId: drawn.data.card.attemptId, answer: deck === 'self' ? 'Paris' : '6', correct: true });
          assert.equal(answered.data.ok, true, JSON.stringify(answered));
          assert.equal(answered.data.box, 2);
          assert.equal(answered.data.pointsDelta, 1);
          assert.ok(answered.data.learningEventId);
          const repeat = await play({ action: 'cardAnswer', cardId: drawn.data.card.id, attemptId: drawn.data.card.attemptId, answer: deck === 'self' ? 'Paris' : '6', correct: true });
          assert.equal(repeat.data.reused, true);
          assert.equal(repeat.data.learningEventId, answered.data.learningEventId);
        }
        const points = await play({ action: 'cardPointSummary' });
        assert.equal(points.data.ok, true, JSON.stringify(points));
        assert.equal(points.data.learning.totalPoints, drawn.data.card ? 1 : 0);
        const stop = Object.assign(Readable.from([Buffer.from(JSON.stringify({ launchKey: result.data.launchKey }))]), {
          method: 'POST', url: '/api/cms/editor-test/close', socket: { remoteAddress: '127.0.0.1' }, headers: {}
        });
        assert.equal((await service.handle(stop)).status, 200);
      }
    }
  } finally { service.dispose(); }
});
