/* Tasyir — منطق المزامنة المشترك (حاسوب + هاتف). لا يعتمد على DOM ولا Electron. */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.SyncCore = f(); })(this, function () {
  'use strict';
  var COLL = ['products', 'customers', 'sales', 'ledger', 'expenses', 'suppliers', 'supLedger', 'workers', 'capSessions'];
  var SETK = ['currency', 'allowNeg', 'tiers', 'sellZero', 'noQty', 'defTerm'];
  var utf8 = function (s) { s = unescape(encodeURIComponent(String(s))); var o = []; for (var i = 0; i < s.length; i++) o.push(s.charCodeAt(i)); return o; };
  var K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  function sha256b(bytes) {
    var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19], l = bytes.length, i, j, w = new Array(64), m = bytes.slice();
    m.push(0x80); while (m.length % 64 !== 56) m.push(0);
    var hi = Math.floor(l * 8 / 4294967296), lo = (l * 8) >>> 0;
    m.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
    var rr = function (x, n) { return (x >>> n) | (x << (32 - n)); };
    for (i = 0; i < m.length; i += 64) {
      for (j = 0; j < 16; j++) w[j] = (m[i + j * 4] << 24) | (m[i + j * 4 + 1] << 16) | (m[i + j * 4 + 2] << 8) | m[i + j * 4 + 3];
      for (j = 16; j < 64; j++) { var s0 = rr(w[j - 15], 7) ^ rr(w[j - 15], 18) ^ (w[j - 15] >>> 3), s1 = rr(w[j - 2], 17) ^ rr(w[j - 2], 19) ^ (w[j - 2] >>> 10); w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0; }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (j = 0; j < 64; j++) {
        var t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[j] + w[j]) | 0, t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H = [(H[0] + a) | 0, (H[1] + b) | 0, (H[2] + c) | 0, (H[3] + d) | 0, (H[4] + e) | 0, (H[5] + f) | 0, (H[6] + g) | 0, (H[7] + h) | 0];
    }
    var o = []; H.forEach(function (x) { o.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255); }); return o;
  }
  var hex = function (b) { return b.map(function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); };
  var unhex = function (s) { var o = []; for (var i = 0; i < s.length; i += 2) o.push(parseInt(s.substr(i, 2), 16)); return o; };
  var sha256 = function (s) { return hex(sha256b(utf8(s))); };
  function hmac(keyHex, msg) {
    var k = unhex(keyHex); while (k.length < 64) k.push(0);
    return hex(sha256b(k.map(function (x) { return x ^ 0x5c; }).concat(sha256b(k.map(function (x) { return x ^ 0x36; }).concat(utf8(msg))))));
  }
  /* نفس تطبيع كود التفعيل في LicenseManager.kt: O→0 وI،L→1 وإزالة الفواصل */
  var normCode = function (c) { return String(c || '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^A-Z0-9]/g, ''); };
  var keyOf = function (code) { return sha256('tasyir-sync|' + normCode(code)); };
  var proofOf = function (K_, token, ts) { return hmac(K_, token + '.' + ts); };

  function fp(o) {
    var s = JSON.stringify(o, function (k, v) { return k === '_u' ? undefined : v; }), h1 = 5381, h2 = 52711, i, c;
    for (i = 0; i < s.length; i++) { c = s.charCodeAt(i); h1 = ((h1 << 5) + h1 + c) | 0; h2 = ((h2 * 33) ^ c) | 0; }
    return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36) + s.length;
  }
  var rid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  var meta = function (db) { return db._sync || (db._sync = { h: {}, tomb: {}, setU: 0, setH: '' }); };
  function setObj(db) { var s = db.settings || {}, v = { shop: db.shop || '', shopInfo: s.shop || {} }; SETK.forEach(function (k) { if (s[k] !== undefined) v[k] = s[k]; }); return v; }

  function stamp(db, now) {
    var m = meta(db);
    COLL.forEach(function (c) {
      var arr = db[c]; if (!Array.isArray(arr)) return;
      var h = m.h[c] = m.h[c] || {}, seen = {};
      arr.forEach(function (r) {
        if (!r || typeof r !== 'object') return;
        if (!r.id) r.id = rid();
        seen[r.id] = 1; var x = fp(r);
        if (h[r.id] !== x) { r._u = now; h[r.id] = x; }
      });
      Object.keys(h).forEach(function (id) { if (!seen[id]) { (m.tomb[c] = m.tomb[c] || {})[id] = now; delete h[id]; } });
    });
    var sh = fp(setObj(db)); if (m.setH !== sh) { m.setH = sh; m.setU = now; }
  }
  function collect(db, since, skip) {
    var m = meta(db), ch = { c: {}, tomb: {}, set: null, seq: db.seq || 0 };
    COLL.forEach(function (c) {
      var o = (db[c] || []).filter(function (r) { return r && (r._u || 0) >= since && !(skip && skip[c + ':' + r.id]); });
      if (o.length) ch.c[c] = o;
      var t = {}, any = 0; Object.keys(m.tomb[c] || {}).forEach(function (id) { if (m.tomb[c][id] >= since) { t[id] = m.tomb[c][id]; any = 1; } });
      if (any) ch.tomb[c] = t;
    });
    if (m.setU >= since) ch.set = { u: m.setU, v: setObj(db) };
    return ch;
  }
  var nz = function (s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); };
  function dedupe(db, ch) {
    var map = { products: {}, customers: {} }, has = function (a, id) { return (a || []).some(function (x) { return x.id === id; }); }, bc = {}, ck = {};
    (db.products || []).forEach(function (p) { if (p.bc) bc[p.bc] = p.id; });
    ((ch.c || {}).products || []).forEach(function (r) { var l = r.bc && bc[r.bc]; if (l && l !== r.id && !has(db.products, r.id)) map.products[r.id] = l; });
    (db.customers || []).forEach(function (c) { ck[nz(c.name) + '|' + nz(c.phone)] = c.id; });
    ((ch.c || {}).customers || []).forEach(function (r) { var l = ck[nz(r.name) + '|' + nz(r.phone)]; if (l && l !== r.id && !has(db.customers, r.id)) map.customers[r.id] = l; });
    return map;
  }
  function remapRec(c, r, map) {
    var P = map.products, C = map.customers;
    if ((c === 'products' && P[r.id])) r.id = P[r.id];
    if ((c === 'customers' && C[r.id])) r.id = C[r.id];
    if (c === 'sales') { if (r.cust && C[r.cust]) r.cust = C[r.cust]; (r.lines || []).forEach(function (l) { if (P[l.pid]) l.pid = P[l.pid]; }); }
    if (c === 'ledger' && r.c && C[r.c]) r.c = C[r.c];
    if (c === 'capSessions') (r.lines || []).forEach(function (l) { if (P[l.pid]) l.pid = P[l.pid]; });
    return r;
  }
  function renameIds(db, map) {
    if (!map) return; var m = meta(db), P = map.products || {}, C = map.customers || {};
    (db.products || []).forEach(function (p) { if (P[p.id]) p.id = P[p.id]; });
    (db.customers || []).forEach(function (c) { if (C[c.id]) c.id = C[c.id]; });
    (db.sales || []).forEach(function (s) { if (s.cust && C[s.cust]) s.cust = C[s.cust]; (s.lines || []).forEach(function (l) { if (P[l.pid]) l.pid = P[l.pid]; }); });
    (db.ledger || []).forEach(function (l) { if (l.c && C[l.c]) l.c = C[l.c]; });
    (db.capSessions || []).forEach(function (s) { (s.lines || []).forEach(function (l) { if (P[l.pid]) l.pid = P[l.pid]; }); });
    (db.capDraft || []).forEach(function (l) { if (P[l.pid]) l.pid = P[l.pid]; });
    m.h = {}; COLL.forEach(function (c) { m.h[c] = {}; (db[c] || []).forEach(function (r) { if (r.id) m.h[c][r.id] = fp(r); }); });
  }
  function apply(db, ch, now, opt) {
    var m = meta(db), applied = {}, map = { products: {}, customers: {} };
    if (!ch) return { applied: applied, idmap: map };
    if (opt && opt.dedupe) map = dedupe(db, ch);
    COLL.forEach(function (c) {
      var arr = db[c] = Array.isArray(db[c]) ? db[c] : [], h = m.h[c] = m.h[c] || {}, tb = m.tomb[c] = m.tomb[c] || {}, rt = (ch.tomb || {})[c] || {};
      Object.keys(rt).forEach(function (id) {
        if (rt[id] > (tb[id] || 0)) tb[id] = rt[id];
        var i = arr.findIndex(function (x) { return x.id === id; });
        if (i >= 0 && (arr[i]._u || 0) <= rt[id]) { arr.splice(i, 1); delete h[id]; }
      });
      ((ch.c || {})[c] || []).forEach(function (r0) {
        var r = remapRec(c, JSON.parse(JSON.stringify(r0)), map);
        if (tb[r.id] && tb[r.id] >= (r._u || 0)) return;
        var i = arr.findIndex(function (x) { return x.id === r.id; });
        if (i < 0) arr.push(r); else if ((r._u || 0) > (arr[i]._u || 0)) arr[i] = r; else return;
        h[r.id] = fp(r); applied[c + ':' + r.id] = 1;
      });
    });
    if (ch.set && ch.set.u > m.setU) {
      var v = ch.set.v || {}; db.settings = db.settings || {};
      if (v.shop !== undefined) db.shop = v.shop;
      if (v.shopInfo) db.settings.shop = Object.assign({}, db.settings.shop || {}, v.shopInfo);
      SETK.forEach(function (k) { if (v[k] !== undefined) db.settings[k] = v[k]; });
      m.setU = ch.set.u; m.setH = fp(setObj(db));
    }
    if (ch.seq > (db.seq || 0)) db.seq = ch.seq;
    return { applied: applied, idmap: map };
  }
  function hubHandle(db, body, now) {
    stamp(db, now);
    var r = apply(db, body.ch, now, { dedupe: true });
    return { ok: 1, srv: now, idmap: r.idmap, ch: collect(db, body.since || 0, r.applied) };
  }
  async function clientSync(db, cfg, post, now) {
    if (cfg.adopt) { COLL.forEach(function (c) { db[c] = []; }); db._sync = null; cfg.srv = 0; cfg.push = 0; cfg.adopt = false; }
    stamp(db, now);
    var res = await post({ ts: now, proof: proofOf(cfg.K, cfg.token, now), since: cfg.srv || 0, ch: collect(db, cfg.push || 0) });
    if (!res || res.err) throw new Error((res && res.err) || 'no response');
    renameIds(db, res.idmap); apply(db, res.ch, now, { dedupe: false });
    cfg.srv = res.srv; cfg.push = now; return res;
  }
  return { COLL: COLL, sha256: sha256, hmac: hmac, keyOf: keyOf, proofOf: proofOf, normCode: normCode, stamp: stamp, collect: collect, apply: apply, hubHandle: hubHandle, clientSync: clientSync };
});
