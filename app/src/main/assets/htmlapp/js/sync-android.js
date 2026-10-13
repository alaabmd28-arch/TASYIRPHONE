/* Tasyir — مزامنة تطبيق أندرويد مع برنامج الحاسوب (الشبكة المحلية). لا يغيّر أي سلوك آخر.
   الربط: مسح QR الحاسوب بماسح التطبيق نفسه + كود التفعيل ذاته على الجهازين. النقل عبر Android.syncPost. */
(function () {
  'use strict';
  var SC = window.SyncCore;
  if (!SC || !window.Android || typeof Android.syncPost !== 'function') return;
  var $i = function (i) { return document.getElementById(i); };
  var jp = function (s, d) { try { return JSON.parse(s); } catch (e) { return d; } };
  var Lx = function (a, f, e) { return L(a, f, e); };
  var busyUI = function () { var o = $i('ov'); return (o && o.innerHTML.trim()) || (document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)); };
  var refresh = function () { try { if (!busyUI()) R(); } catch (e) { /* لا شيء */ } };

  var CK = 'tasyir_sync', cfg = jp(localStorage.getItem(CK), null), state = { ts: 0, err: '', run: 0 };
  var save = function () { try { localStorage.setItem(CK, JSON.stringify(cfg)); } catch (e) { /* لا شيء */ } };

  /* ---------- النقل عبر الجسر الأصلي ---------- */
  var pend = {}, seq = 0;
  window.__syncRes = function (id, status, text) { var p = pend[id]; if (!p) return; delete pend[id]; p(status, text); };
  function post(b) {
    return new Promise(function (ok, no) {
      var id = ++seq, t = setTimeout(function () { delete pend[id]; no(new Error('timeout')); }, 70000);
      pend[id] = function (status, text) {
        clearTimeout(t);
        var j = jp(text, {});
        if (status >= 200 && status < 300) ok(j); else no(new Error(status ? (j.err || 'HTTP ' + status) : 'network'));
      };
      try { Android.syncPost(id, cfg.base + '/sync', JSON.stringify(b)); } catch (e) { delete pend[id]; clearTimeout(t); no(e); }
    });
  }
  var MSG = function (e) {
    return /mismatch/.test(e) ? Lx('كود التفعيل غير مطابق لكود الحاسوب', 'Code différent de celui du PC', 'Activation code does not match the computer')
      : /network|timeout/i.test(e) ? Lx('الحاسوب غير متاح: تأكد من الواي فاي وأن البرنامج مفتوح', 'PC injoignable : vérifiez le Wi-Fi', 'Computer unreachable: check Wi-Fi and that the app is open')
        : /too many/.test(e) ? Lx('محاولات كثيرة، انتظر دقيقة', 'Trop d\'essais, attendez', 'Too many attempts, wait a minute') : e;
  };

  async function run(manual) {
    if (!cfg || !cfg.K || state.run) return;
    state.run = 1;
    try {
      await SC.clientSync(db, cfg, post, Date.now());
      save(); saveNow(); state.ts = Date.now(); state.err = '';
      if (manual) toast('[ok] ' + Lx('تمت المزامنة', 'Synchronisé', 'Synced'));
      refresh();
    } catch (e) { state.err = MSG(String(e && e.message || e)); if (manual) toast('[warn] ' + state.err); }
    finally { state.run = 0; if (tab === 'set' && sub === 'sync') refresh(); }
  }
  var timer = 0, prevSaved = window.onSaved;
  window.onSaved = function () { try { prevSaved && prevSaved(); } catch (e) { /* لا شيء */ } if (!cfg || state.run) return; clearTimeout(timer); timer = setTimeout(run, 2500); };
  setInterval(function () { if (!document.hidden) run(); }, 20000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) run(); });
  addEventListener('online', function () { run(); });

  /* ---------- الربط ---------- */
  var URLRE = /^http:\/\/(\d{1,3}(?:\.\d{1,3}){3}):(\d{2,5})\/m\?t=([0-9a-f]{32})$/;
  function parseUrl(u) { var m = URLRE.exec(String(u || '').trim()); return m ? { base: 'http://' + m[1] + ':' + m[2], token: m[3] } : null; }

  window.TDsync = {
    scan: function () {
      window._nscb = function (c) {
        var p = parseUrl(c);
        if (!p) return [0, Lx('هذا ليس QR الحاسوب', 'Ce n\'est pas le QR du PC', 'Not the computer QR')];
        var f = $i('syu'); if (f) f.value = c.trim();
        return [1, Lx('تم التقاط الرابط', 'Lien capté', 'Link captured')];
      };
      Android.scan(false);
    },
    link: function () {
      var p = parseUrl(($i('syu') || {}).value), code = ($i('syc') || {}).value || '', mode = (document.querySelector('input[name=sym]:checked') || {}).value || 'merge';
      var err = function (m) { var e = $i('sye'); if (e) e.textContent = m; };
      if (!p) return err(Lx('امسح QR الحاسوب أو الصق الرابط', 'Scannez le QR du PC ou collez le lien', 'Scan the computer QR or paste the link'));
      if (SC.normCode(code).length !== 24) return err(Lx('كود التفعيل 24 خانة', 'Le code fait 24 caractères', 'Activation code is 24 characters'));
      if (!Android.licenseOwns(code)) return err(Lx('هذا ليس كود التفعيل المفعَّل على هذا الهاتف', 'Ce n\'est pas le code activé sur ce téléphone', 'This is not the activation code activated on this phone'));
      cfg = { base: p.base, token: p.token, K: SC.keyOf(code), srv: 0, push: 0, adopt: mode === 'adopt' }; save();
      state.err = ''; ov.innerHTML = '';
      run(true).then(function () { if (state.err) { var m = state.err; cfg = null; try { localStorage.removeItem(CK); } catch (e) { /* لا شيء */ } sheet('<h3>' + ic('alert') + '</h3><div class="red">' + esc(m) + '</div><button class="b s" style="width:100%;margin-top:10px" onclick="ov.innerHTML=\'\'">' + t('ok') + '</button>'); } });
    },
    now: function () { run(true); },
    unlink: function () { if (!confirm(t('cf'))) return; cfg = null; try { localStorage.removeItem(CK); } catch (e) { /* لا شيء */ } sub = ''; R(); },
    open: function () {
      var has = db.products.length > 0;
      sheet('<h3>' + ic('scan') + ' ' + Lx('ربط بالحاسوب', 'Lier au PC', 'Link to computer') + '</h3>' +
        '<div class="k" style="margin-bottom:6px">' + Lx('على الحاسوب: الإعدادات ← ربط الهاتف، ثم امسح الـQR هنا.', 'Sur le PC : Réglages → Lier le téléphone, puis scannez le QR ici.', 'On the computer: Settings → Link phone, then scan the QR here.') + '</div>' +
        '<div class="bar"><input id="syu" autocomplete="off" style="direction:ltr" placeholder="http://192.168.x.x:47321/m?t=..."><button class="b" onclick="TDsync.scan()">' + ic('scan') + '</button></div>' +
        '<label class="k">' + Lx('كود التفعيل (نفسه على الحاسوب)', 'Code d\'activation (le même que sur le PC)', 'Activation code (same as on the computer)') + '</label><input id="syc" autocomplete="off" style="direction:ltr">' +
        '<label class="row" style="gap:8px"><input type="radio" name="sym" value="merge" ' + (has ? 'checked' : '') + '><span>' + Lx('دمج بيانات الهاتف مع الحاسوب', 'Fusionner avec les données du PC', 'Merge phone data with the computer') + '</span></label>' +
        '<label class="row" style="gap:8px"><input type="radio" name="sym" value="adopt" ' + (has ? '' : 'checked') + '><span>' + Lx('أخذ بيانات الحاسوب (يمسح بيانات الهاتف الحالية)', 'Prendre les données du PC (efface celles d\'ici)', 'Take the computer\'s data (erases this phone\'s data)') + '</span></label>' +
        '<div class="red" id="sye" style="min-height:20px"></div>' +
        '<div class="bar"><button class="b" onclick="TDsync.link()">' + ic('check') + ' ' + Lx('ربط', 'Lier', 'Link') + '</button><button class="b s" onclick="ov.innerHTML=\'\'">' + t('cancel') + '</button></div>');
    }
  };

  var TT = Lx('المزامنة مع الحاسوب', 'Synchronisation PC', 'Computer sync');
  var _hdr = hdr; hdr = function () { _hdr(); if (sub === 'sync') { var e = $i('ttl'); if (e) e.textContent = TT; } };
  SUBV.sync = function () {
    return '<div class="card"><b>' + (cfg ? '<span style="color:#16a34a">●</span> ' + Lx('مرتبط بالحاسوب', 'Lié au PC', 'Linked to computer') : Lx('غير مرتبط', 'Non lié', 'Not linked')) + '</b>' +
      (cfg ? '<div class="k" style="margin:6px 0">' + (state.err ? '<span class="red">' + esc(state.err) + '</span>' : state.ts ? Lx('آخر مزامنة: ', 'Dernière synchro : ', 'Last sync: ') + new Date(state.ts).toLocaleTimeString(LC()) : '…') + '</div>' +
        '<div class="bar"><button class="b" onclick="TDsync.now()">' + ic('refresh') + ' ' + Lx('زامن الآن', 'Synchroniser', 'Sync now') + '</button><button class="b r" onclick="TDsync.unlink()">' + Lx('فصل', 'Délier', 'Unlink') + '</button></div>'
        : '<div class="bar" style="margin-top:8px"><button class="b" onclick="TDsync.open()">' + ic('scan') + ' ' + Lx('ربط بالحاسوب', 'Lier au PC', 'Link to computer') + '</button></div>') + '</div>';
  };
  var _vs = VIEWS.set; VIEWS.set = function () {
    var h = _vs(); if (sub) return h;
    return '<div class="sg">' + SR(ic('refresh'), TT, '', cfg ? '<span style="color:#16a34a">●</span>' : '', "sub='sync';R()") + '</div>' + h;
  };
  if (cfg) setTimeout(run, 1500);
})();
