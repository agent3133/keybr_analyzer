// ─────────────────────────────────────────────────────────────────────────────
// KEYBR SYNC BOOKMARKLET
//
// This function runs on keybr.com, not on the analyzer page. index.html turns
// it into a `javascript:` bookmark via Function.prototype.toString, so it must
// be fully self-contained: no references to anything outside its own body,
// and only /* */ comments inside it (some browsers strip newlines from
// bookmarks, which would break // comments).
//
// Where keybr keeps typing data (see github.com/aradzie/keybr.com):
//   • Signed-in users: GET /_/sync/data returns a binary "KEYB" v2 stream.
//   • Anonymous users: IndexedDB database "history", object store "history".
// Both are converted to the same JSON shape as keybr's "Download data" export
// and handed to the analyzer window with postMessage.
// ─────────────────────────────────────────────────────────────────────────────

function keybrSyncBookmarklet(analyzerUrl) {
  var analyzerOrigin = new URL(analyzerUrl).origin;

  if (!/(^|\.)keybr\.com$/.test(location.hostname)) {
    alert('Open keybr.com first, then click this bookmark again.');
    return;
  }

  /* Open the window right away, while we still have the click's user gesture */
  var win = window.open(analyzerUrl + '#keybr-sync', 'keybr_analyzer');
  if (!win) {
    alert('The analyzer window was blocked. Allow pop-ups for keybr.com and try again.');
    return;
  }

  var toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:320px;' +
    'padding:10px 14px;border-radius:8px;background:#1e1e1c;color:#f0eeea;' +
    'font:13px/1.4 system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.3);';
  document.body.appendChild(toast);
  function say(text, done) {
    toast.textContent = text;
    if (done) setTimeout(function () { toast.remove(); }, 5000);
  }
  say('keybr Analyzer: reading your typing data…');

  /* Binary format: 8-byte header, then per session
     u8 layout, u8 textType, u32 seconds, vlq time, vlq length, vlq errors,
     vlq sampleCount, then per sample vlq codePoint/hitCount/missCount/timeToType.
     Integers are big-endian; VLQ is 7 bits per byte, most significant first. */
  function parseStats(buf) {
    var view = new DataView(buf), pos = 0;
    function u8() { return view.getUint8(pos++); }
    function u32() { var x = view.getUint32(pos, false); pos += 4; return x; }
    function vlq() {
      var x = 0;
      for (var i = 0; i < 5; i++) {
        var b = u8();
        x = x * 128 + (b & 127);
        if (!(b & 128)) return x;
      }
      throw new Error('Invalid number in keybr data');
    }
    if (buf.byteLength === 0) return [];
    if (u32() !== 0x4b455942 || u32() !== 2) throw new Error('Unrecognized keybr data format');
    var sessions = [];
    while (pos < buf.byteLength) {
      u8(); u8(); /* layout and text type ids, not used by the analyzer */
      var ts = u32() * 1000;
      var time = vlq(), length = vlq(), errors = vlq(), n = vlq();
      var histogram = [];
      for (var i = 0; i < n; i++) {
        histogram.push({ codePoint: vlq(), hitCount: vlq(), missCount: vlq(), timeToType: vlq() });
      }
      sessions.push({ timeStamp: new Date(ts).toISOString(), length: length, time: time, errors: errors, histogram: histogram });
    }
    return sessions;
  }

  /* Anonymous users: records look like {l, m, ts, n, t, e, h: {codePoint: {h, m, t}}} */
  function readLocal() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open('history');
      /* If this fires, the database did not exist: abort so we don't create it */
      req.onupgradeneeded = function () { req.transaction.abort(); };
      req.onerror = function () { resolve([]); };
      req.onsuccess = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('history')) { db.close(); resolve([]); return; }
        var all = db.transaction('history', 'readonly').objectStore('history').getAll();
        all.onerror = function () { db.close(); reject(all.error); };
        all.onsuccess = function () {
          db.close();
          resolve(all.result.map(function (r) {
            var histogram = Object.keys(r.h || {}).map(function (cp) {
              return { codePoint: +cp, hitCount: r.h[cp].h, missCount: r.h[cp].m, timeToType: r.h[cp].t };
            });
            return { timeStamp: new Date(r.ts).toISOString(), length: r.n, time: r.t, errors: r.e, histogram: histogram };
          }));
        };
      };
    });
  }

  function load() {
    return fetch('/_/sync/data', { credentials: 'same-origin' }).then(function (res) {
      var type = res.headers.get('content-type') || '';
      if (res.ok && type.indexOf('application/octet-stream') === 0) {
        return res.arrayBuffer().then(function (buf) { return { sessions: parseStats(buf), source: 'account' }; });
      }
      /* Not signed in: fall back to the data keybr keeps in this browser */
      return readLocal().then(function (sessions) { return { sessions: sessions, source: 'browser' }; });
    });
  }

  var payload = null, ready = false, delivered = false;
  function trySend() {
    if (!ready || !payload || delivered) return;
    win.postMessage({ type: 'keybr-analyzer:data', source: payload.source, sessions: payload.sessions }, analyzerOrigin);
  }
  function onMessage(e) {
    if (e.source !== win || e.origin !== analyzerOrigin || !e.data) return;
    if (e.data.type === 'keybr-analyzer:ready') { ready = true; trySend(); }
    if (e.data.type === 'keybr-analyzer:received') {
      delivered = true;
      window.removeEventListener('message', onMessage);
      say('keybr Analyzer: sent ' + payload.sessions.length + ' sessions.', true);
    }
  }
  window.addEventListener('message', onMessage);
  setTimeout(function () {
    if (delivered) return;
    window.removeEventListener('message', onMessage);
    say('keybr Analyzer: the analyzer window did not respond. Close it and try again.', true);
  }, 60000);

  load().then(function (result) {
    if (!result.sessions.length) {
      say('keybr Analyzer: no typing data found. Sign in to keybr.com or complete a lesson first.', true);
      win.close();
      return;
    }
    payload = result;
    say('keybr Analyzer: sending ' + result.sessions.length + ' sessions…');
    trySend();
  }).catch(function (err) {
    say('keybr Analyzer: could not read your data (' + err.message + ').', true);
    win.close();
  });
}
