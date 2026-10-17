// Gemeinsamer HTTP-Eingangsschutz für CMS-Server und Subdienste.
//
// PUBLIC_ORIGIN legt den vertrauenswürdigen öffentlichen Origin fest
// (z. B. https://spiele.example.org hinter dem Fly-Proxy). Ohne gesetzte
// Variable bleibt das bisherige Verhalten: nur lokale Hostnamen.
//
// CMS_TRUST_PROXY=1 kennzeichnet den Betrieb hinter dem eigenen Reverse
// Proxy: erst dann darf X-Forwarded-For die Client-IP für Rate-Limits
// liefern — der Header ist nur vertrauenswürdig, wenn der unmittelbare
// Peer der eigene Proxy (Loopback) ist.
const { isIP } = require('node:net');
function createHttpGuards({ publicOrigin = process.env.PUBLIC_ORIGIN || '', trustProxy = process.env.CMS_TRUST_PROXY === '1' } = {}) {
  let origin = null;
  if (publicOrigin) {
    origin = new URL(publicOrigin);
    if (!['http:', 'https:'].includes(origin.protocol)) throw Error('PUBLIC_ORIGIN muss eine http(s)-URL sein.');
    origin.hash = ''; origin.search = ''; origin.pathname = '/';
  }
  const publicHost = origin ? origin.host : null;
  const localHost = h => /^(localhost|127\.0\.0\.1|::1|\[::1\])(:\d+)?$/.test(h);
  // Host-Header: lokal (mit beliebigem Port) oder exakt der öffentliche Host.
  const hostOk = req => {
    const h = String(req.headers.host || '');
    return localHost(h) || (publicHost !== null && h === publicHost);
  };
  // Origin muss zum Host der Anfrage passen — der Host selbst wurde bereits
  // gegen die erlaubte Liste geprüft. Fehlender Origin ist erlaubt (form-POSTs
  // und fetch ohne Origin werden an anderer Stelle per SameSite-Cookie
  // beziehungsweise expliziter Prüfung abgesichert).
  const originOk = req => {
    const o = req.headers.origin;
    if (!o) return true;
    let u; try { u = new URL(o); } catch { return false; }
    const h = String(req.headers.host || '');
    return u.host === h && (localHost(h) ? ['http:', 'https:'].includes(u.protocol) : u.origin === origin?.origin);
  };
  const clientIp = req => {
    const ra = req.socket?.remoteAddress || '';
    if (trustProxy && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ra)) {
      const xff = String(req.headers['x-forwarded-for'] || '').trim();
      // Our nginx forwards exactly one normalized address, never a chain.
      if (isIP(xff)) return xff;
    }
    return ra;
  };
  const secure = !!origin && origin.protocol === 'https:';
  const baseUrl = req => origin ? origin.origin : `http://${req.headers.host}`;
  return { hostOk, originOk, clientIp, secure, baseUrl, publicOrigin: origin, trustProxy };
}
module.exports = { createHttpGuards };
