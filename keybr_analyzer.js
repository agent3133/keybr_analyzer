// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const FMAP = {
  q:'LP',a:'LP',z:'LP', w:'LR',s:'LR',x:'LR', e:'LM',d:'LM',c:'LM',
  r:'LI',f:'LI',v:'LI',t:'LI',g:'LI',b:'LI',
  y:'RI                                 ',h:'RI',n:'RI',u:'RI',j:'RI',m:'RI',
  i:'RM',k:'RM', o:'RR',l:'RR', p:'RP', ' ':'TH'
};
const FNAME = { LP:'L. Pinky', LR:'L. Ring', LM:'L. Middle', LI:'L. Index', TH:'Thumb', RI:'R. Index', RM:'R. Middle', RR:'R. Ring', RP:'R. Pinky' };
const FORD  = ['LP','LR','LM','LI','TH','RI','RM','RR','RP'];
const LS_KEY = 'keybr_history';
const ANALYZE_CONFIG = Object.freeze({
  SPACE_CODEPOINT: 32,
  SLOWEST_KEYS_LIMIT: 8,
  ERROR_KEYS_LIMIT: 8,
  FOCUS_KEYS_LIMIT: 6,
  FOCUS_ERROR_WEIGHT: 2.5,
  BAR_MIN_HEIGHT: 160,
  BAR_ROW_HEIGHT: 38,
  BAR_HEIGHT_PADDING: 60,
  TREND_MIN_SESSIONS: 2,
  TREND_POINT_RADIUS: 2,
  TREND_ACC_MIN: 80,
  TREND_ACC_MAX: 100,
});
const PROGRESS_CONFIG = Object.freeze({
  NAV_EPSILON: 0.001,
  NAV_MAX_VALUE: 100,
  MAIN_POINT_RADIUS: 4,
  MAIN_POINT_HOVER_RADIUS: 6,
  REG_SCATTER_POINT_RADIUS: 2,
  REG_SCATTER_HOVER_RADIUS: 4,
  LAST_ACTIVE_DAYS: 10,
  REG_EXTRA_RATIO: 0.25,
  REG_MIN_EXTRA_TESTS: 10,
  IMPROVEMENT_BLOCK_TESTS: 10,
  FIT_STRONG_R2: 0.5,
  FIT_MODERATE_R2: 0.2,
  ALIGN_EPSILON: 0.5,
});
const CHART_STYLE = Object.freeze({
  AXIS_TICK_FONT_SIZE: 11,
  AXIS_TITLE_FONT_SIZE: 10,
  BAR_Y_TICK_FONT_SIZE: 12,
  MAIN_LINE_TENSION: 0.35,
  TREND_LINE_TENSION: 0.3,
  REG_LINE_WIDTH: 2,
  DASH_80: Object.freeze([5, 3]),
  DASH_95: Object.freeze([2, 2]),
  REG_EXTRAP_DASH: Object.freeze([5, 4]),
  COLORS: Object.freeze({
    wpm: '#378ADD',
    acc: '#639922',
    danger: '#E24B4A',
    avgWPM: '#378ADD',
    p80WPM: '#1D9E75',
    p95WPM: '#7F77DD',
    bestWPM: '#BA7517',
  }),
  DAY_COLORS: Object.freeze([
    '#378ADD', '#1D9E75', '#7F77DD', '#BA7517', '#E24B4A',
    '#D4537E', '#639922', '#0F6E56', '#533AB7', '#993C1D',
  ]),
});

if (window.ChartZoom && !Chart.registry.plugins.get('zoom')) {
  Chart.register(window.ChartZoom);
}

const EL = Object.freeze({
  zCards: document.getElementById('z-cards'),
  zKbd: document.getElementById('z-kbd'),
  zSw: document.getElementById('z-sw'),
  zEw: document.getElementById('z-ew'),
  zTw: document.getElementById('z-tw'),
  zTleg: document.getElementById('z-tleg'),
  zTc: document.getElementById('z-tc'),
  zTrendNav: document.getElementById('z-trend-nav'),
  zFg: document.getElementById('z-fg'),
  zWk: document.getElementById('z-wk'),
  pRegNav: document.getElementById('p-reg-nav'),
  pMainNav: document.getElementById('p-main-nav'),
  pEmpty: document.getElementById('p-empty'),
  pDash: document.getElementById('p-dash'),
  pSubtitle: document.getElementById('p-subtitle'),
  pCards: document.getElementById('p-cards'),
  pLegend: document.getElementById('p-legend'),
  pMain: document.getElementById('p-main'),
  pCounts: document.getElementById('p-counts'),
  pRegCards: document.getElementById('p-reg-cards'),
  pRegSubtitle: document.getElementById('p-reg-subtitle'),
  pReg: document.getElementById('p-reg'),
  zFileBtn: document.getElementById('z-file-btn'),
  zFile: document.getElementById('z-file'),
  zDemo: document.getElementById('z-demo'),
  zRaw: document.getElementById('z-raw'),
  zGo: document.getElementById('z-go'),
  zMsg: document.getElementById('z-msg'),
  zIn: document.getElementById('z-in'),
  zDash: document.getElementById('z-dash'),
  zRs: document.getElementById('z-rs'),
  pClear: document.getElementById('p-clear'),
});

const regNavSyncPlugin = {
  id: 'reg-nav-sync',
  afterUpdate(chart) {
    if (!chart?.canvas?.id) return;
    if (chart.canvas.id === 'z-tc' && chart.$navBounds) {
      syncTrendNav(chart, chart.$navBounds.min, chart.$navBounds.max);
      return;
    }
    if (chart.canvas.id === 'p-reg' && chart.$navBounds) {
      syncRegNav(chart, chart.$navBounds.min, chart.$navBounds.max);
      return;
    }
    if (chart.canvas.id === 'p-main' && chart.$navBounds) {
      syncMainNav(chart, chart.$navBounds.min, chart.$navBounds.max);
      syncCountViewportFromMain();
    }
  }
};
if (!Chart.registry.plugins.get('reg-nav-sync')) {
  Chart.register(regNavSyncPlugin);
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function cp2ch(cp)     { return cp === ANALYZE_CONFIG.SPACE_CODEPOINT ? ' ' : String.fromCodePoint(cp); }
function lerp(a, b, t) { return a + (b - a) * t; }
function isDark()      { return window.matchMedia('(prefers-color-scheme: dark)').matches; }

function heatRGB(t, mn, mx) {
  if (mn === mx) return [100, 185, 60];
  const r = Math.max(0, Math.min(1, (t - mn) / (mx - mn)));
  if (r < 0.5) {
    const s = r * 2;
    return [Math.round(lerp(75,240,s)), Math.round(lerp(185,200,s)), Math.round(lerp(55,50,s))];
  }
  const s = (r - 0.5) * 2;
  return [Math.round(lerp(240,215,s)), Math.round(lerp(200,45,s)), Math.round(lerp(50,30,s))];
}
function heatCSS(t, mn, mx) { const [r,g,b] = heatRGB(t,mn,mx); return `rgb(${r},${g},${b})`; }

// WPM: characters typed divided by 5 (= 1 "word"), divided by elapsed minutes
function sessionWPM(s) { if (!s?.length || !s?.time) return 0; return (s.length / 5) / (s.time / 60000); }

// Accuracy: fraction of characters that were correct
function sessionAcc(s) { if (!s?.length) return 0; return (s.length - (s.errors || 0)) / s.length * 100; }

// p-th percentile (p = 0..100) via linear interpolation
function percentile(arr, p) {
  if (!arr || !arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// "2026-04-04T..." → "2026-04-04"
function sessionDate(s) { return s.timeStamp.slice(0, 10); }

// "2026-04-04" → "Apr 4"
function fmtDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month:'short', day:'numeric' });
}

function makeRng(seed = 42) {
  let s = seed >>> 0;
  return function rand() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function generateDemoSessions(days = 45, startWpm = 34, endWpm = 56) {
  const rand = makeRng(42);
  const chars = ' etaoinshrdlucmfwygpbvkxqjz';
  const weights = [18,13,9,8,8,7,7,6,6,6,4,4,3,3,2,2,2,2,2,1,1,1,1,0.4,0.2,0.2,0.2];
  const wsum = weights.reduce((a,b)=>a+b,0);
  const cum = [];
  let acc = 0;
  for (const w of weights) { acc += w / wsum; cum.push(acc); }

  const pickChar = () => {
    const r = rand();
    for (let i = 0; i < cum.length; i++) if (r <= cum[i]) return chars[i];
    return 'e';
  };

  const keyDifficulty = {
    ' ':0.75, a:0.9, s:0.85, d:0.88, f:0.85, g:1.05, h:1.0, j:0.88, k:0.9, l:0.92,
    q:1.4, w:1.05, e:0.92, r:0.95, t:0.98, y:1.1, u:0.95, i:0.92, o:1.0, p:1.2,
    z:1.45, x:1.25, c:1.0, v:1.05, b:1.15, n:0.88, m:0.95
  };

  const gaussian = (mean = 0, std = 1) => {
    const u1 = Math.max(1e-8, rand());
    const u2 = rand();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z0 * std;
  };

  const start = new Date();
  start.setUTCHours(0,0,0,0);
  start.setUTCDate(start.getUTCDate() - days);
  const sessions = [];

  for (let day = 0; day <= days; day++) {
    if (rand() > 0.68) continue;
    const perDay = 2 + Math.floor(rand() * 4);
    for (let n = 0; n < perDay; n++) {
      const t = sessions.length / 120;
      const targetWpm = startWpm + (endWpm - startWpm) * Math.max(0, Math.min(1, t));
      const wpm = Math.max(15, gaussian(targetWpm, targetWpm * 0.07));
      const length = 150 + Math.floor(rand() * 201);
      const msPerChar = 60000 / (wpm * 5);
      const time = Math.round(length * msPerChar);
      const errRate = Math.max(0, Math.min(0.2, gaussian(0.05, 0.02)));
      const errors = Math.round(length * errRate);

      const hist = {};
      for (let i = 0; i < length; i++) {
        const ch = pickChar();
        if (!hist[ch]) hist[ch] = { hitCount:0, missCount:0, weightedMs:0 };
        const diff = keyDifficulty[ch] || 1;
        const ttype = Math.max(50, gaussian(msPerChar * diff, msPerChar * 0.09));
        const missRate = Math.max(0, Math.min(0.3, gaussian(0.04, 0.02) * diff));
        hist[ch].hitCount += 1;
        hist[ch].missCount += rand() < missRate ? 1 : 0;
        hist[ch].weightedMs += ttype;
      }

      const histogram = Object.entries(hist).map(([ch, v]) => ({
        codePoint: ch.codePointAt(0),
        hitCount: v.hitCount,
        missCount: v.missCount,
        timeToType: +(v.weightedMs / v.hitCount).toFixed(1),
      }));

      const ts = new Date(start);
      ts.setUTCDate(start.getUTCDate() + day);
      ts.setUTCHours(8 + Math.floor(rand() * 15), Math.floor(rand() * 60), Math.floor(rand() * 60), Math.floor(rand() * 1000));

      sessions.push({
        timeStamp: ts.toISOString().replace(/\.\d{3}Z$/, m => m),
        length,
        time,
        errors,
        histogram,
      });
    }
  }

  sessions.sort((a,b) => a.timeStamp < b.timeStamp ? -1 : 1);
  return sessions;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL STORAGE  (persists across browser sessions)
// ─────────────────────────────────────────────────────────────────────────────

function loadHistory() {
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : []; }
  catch(e) { return []; }
}
function saveHistory(sessions) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(sessions)); return true; }
  catch(e) { return false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYZE TAB
// ─────────────────────────────────────────────────────────────────────────────

const aC = { slow:null, err:null, trend:null };
function dA(k) { if (aC[k]) { try { aC[k].destroy(); } catch(e){} aC[k]=null; } }

function analyzePalette() {
  const dark = isDark();
  return {
    tc: dark ? 'rgba(255,255,255,0.58)' : 'rgba(0,0,0,0.52)',
    gc: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    noBg: dark ? '#3a3a3a' : '#e5e3dc',
    noFg: dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)',
  };
}

function buildCharacterStats(sessions) {
  if (!sessions || !sessions.length) return [];
  const hmap = {};
  for (const s of sessions) {
    if (!s?.histogram?.length) continue;
    for (const h of s.histogram) {
      if (!hmap[h.codePoint]) hmap[h.codePoint] = { hits:0, misses:0, wt:0 };
      hmap[h.codePoint].hits += h.hitCount;
      hmap[h.codePoint].misses += h.missCount;
      hmap[h.codePoint].wt += h.timeToType * h.hitCount;
    }
  }
  return Object.entries(hmap).map(([cp, v]) => ({
    cp: +cp,
    ch: cp2ch(+cp),
    hits: v.hits,
    misses: v.misses,
    avg: v.hits > 0 ? v.wt / v.hits : 0,
    er: v.misses / (v.hits + v.misses) * 100,
  }));
}

function renderAnalyzeCards(sessions, wpms, accs) {
  if (!sessions?.length || !wpms?.length || !accs?.length) {
    EL.zCards.innerHTML = '';
    return;
  }
  const avgW = wpms.reduce((a,b)=>a+b,0) / wpms.length;
  const avgA = accs.reduce((a,b)=>a+b,0) / accs.length;
  const bestW = Math.max(...wpms);
  const totalC = sessions.reduce((a,s)=>a+s.length,0);
  const cardsEl = EL.zCards;
  cardsEl.innerHTML = '';
  [
    { l:'Avg WPM',     v:avgW.toFixed(1),        s:'words per minute' },
    { l:'Accuracy',    v:avgA.toFixed(1)+'%',    s:'correct presses' },
    { l:'Best WPM',    v:bestW.toFixed(1),        s:`session ${wpms.indexOf(bestW)+1}` },
    { l:'Total chars', v:totalC.toLocaleString(), s:`across ${sessions.length} session${sessions.length>1?'s':''}` },
  ].forEach(c => {
    const d = document.createElement('div');
    d.className = 'card';
    d.innerHTML = `<div class="card-label">${c.l}</div><div class="card-value">${c.v}</div><div class="card-sub">${c.s}</div>`;
    cardsEl.appendChild(d);
  });
}

const KEYBOARD_WIDTH_MULTIPLIERS = Object.freeze({
  ctrl: 1.27,
  shift: 1.27,
  win: 1.27,
  alt: 1.27,
  altgr: 1.27,
  menu: 1.27,
  tab: 1.5,
  caps: 1.78,
  space: 6.55,
});

// Normalized keyboard layout schema:
// key: character lookup key for stats (or null for meta-only keys)
// label: text shown on keycap
// span: relative base width units (default 2)
// meta: structural key without heatmap data
// flex: key can absorb extra row width
// widthKey/widthMul: optional width override source
const KEYBOARD_LAYOUT = [
  [
    { key:'`' },
    { key:'1' }, { key:'2' }, { key:'3' }, { key:'4' }, { key:'5' }, { key:'6' },
    { key:'7' }, { key:'8' }, { key:'9' }, { key:'0' }, { key:'-' }, { key:'=' },
    { label:'Backspace', span:4, meta:true, flex:true },
  ],
  [
    { label:'Tab', span:3, meta:true },
    { key:'q' }, { key:'w' }, { key:'e' }, { key:'r' }, { key:'t' }, { key:'y' },
    { key:'u' }, { key:'i' }, { key:'o' }, { key:'p' }, { key:'[' }, { key:']' },
    { label:'Enter', span:3, meta:true, flex:true },
  ],
  [
    { label:'Caps', span:4, meta:true },
    { key:'a' }, { key:'s' }, { key:'d' }, { key:'f' }, { key:'g' }, { key:'h' },
    { key:'j' }, { key:'k' }, { key:'l' }, { key:';' }, { key:"'" },
    { key:'#' },
    { label:'Enter', span:2, meta:true, flex:true, widthMul:1.25 },
  ],
  [
    { label:'Shift', span:5, meta:true },
    { key:'<' },
    { key:'z' }, { key:'x' }, { key:'c' }, { key:'v' }, { key:'b' }, { key:'n' },
    { key:'m' }, { key:',' }, { key:'.' }, { key:'/' },
    { label:'Shift', span:3, meta:true, flex:true },
  ],
  [
    { label:'Ctrl', span:4, meta:true },
    { label:'Win', span:3, meta:true }, { label:'Alt', span:3, meta:true },
    { key:' ', label:'SPACE', span:7, space:true, widthKey:'space' },
    { label:'AltGr', span:3, meta:true }, { label:'Win', span:2, meta:true },
    { label:'Menu', span:3, meta:true }, { label:'Ctrl', span:3, meta:true, flex:true },
  ],
];

function getKeyboardKeyModel(spec) {
  const key = spec.key ?? null;
  const span = spec.span ?? 2;
  const widthKey = spec.widthKey ?? (spec.label ? spec.label.toLowerCase() : null);
  let widthMul = spec.widthMul ?? (span / 2);
  if (widthKey && KEYBOARD_WIDTH_MULTIPLIERS[widthKey] != null) {
    widthMul = KEYBOARD_WIDTH_MULTIPLIERS[widthKey];
  }
  return {
    key,
    label: spec.label || (key === ' ' ? 'SPACE' : (key ? key.toUpperCase() : '')),
    widthMul,
    isMeta: !!spec.meta,
    isSpace: !!spec.space || key === ' ',
    isFlexible: !!spec.flex,
  };
}

function renderKeyboardHeatmap(chars, noBg, noFg) {
  if (!chars?.length) return { mn: 0, mx: 1 };
  const times = chars.map(c=>c.avg).filter(t=>t>0);
  const mn = times.length ? Math.min(...times) : 0;
  const mx = times.length ? Math.max(...times) : 1;
  const byKey = {};
  chars.forEach(c => byKey[c.ch] = c);

  const kbd = EL.zKbd;
  kbd.innerHTML = '';
  KEYBOARD_LAYOUT.forEach((row) => {
    const rDiv = document.createElement('div');
    rDiv.className = 'kbd-row';
    row.forEach(spec => {
      const item = getKeyboardKeyModel(spec);
      const kd = document.createElement('div');
      kd.style.setProperty('--key-w', String(item.widthMul));

      const k = item.key;
      const cd = byKey[k];
      kd.className = 'key';
      if (item.isSpace) kd.classList.add('space-key');
      if (item.isMeta) kd.classList.add('meta');
      if (item.isFlexible) kd.classList.add('flex-fill');

      let bg, fg='rgba(255,255,255,0.95)', timeTxt='—', accTxt='—';
      if (item.isMeta) {
        bg = noBg;
        fg = noFg;
      } else if (cd && cd.avg > 0) {
        bg = heatCSS(cd.avg, mn, mx);
        timeTxt = Math.round(cd.avg)+'ms';
        accTxt = (100 - cd.er).toFixed(0)+'%';
      } else {
        bg = noBg;
        fg = noFg;
      }

      kd.style.background = bg;
      kd.innerHTML = `<span class="key-label" style="color:${fg};">${item.label}</span><span class="key-time" style="color:${fg};">${timeTxt}</span><span class="key-acc" style="color:${fg};">${accTxt}</span>`;
      rDiv.appendChild(kd);
    });
    kbd.appendChild(rDiv);
  });

  const legDiv = document.createElement('div');
  legDiv.className='kbd-legend';
  legDiv.innerHTML='Fast <span class="legend-grad"></span> Slow &nbsp;&nbsp; ⚠ = has errors';
  kbd.appendChild(legDiv);
  return { mn, mx };
}

function renderSlowestKeys(chars, mn, mx, gc, tc) {
  if (!chars?.length) {
    EL.zSw.innerHTML = '<p style="font-size:13px;padding:1rem 0;color:var(--text2)">No data to display.</p>';
    return;
  }
  const sl = [...chars].filter(c=>c.avg>0).sort((a,b)=>b.avg-a.avg).slice(0, ANALYZE_CONFIG.SLOWEST_KEYS_LIMIT);
  if (!sl.length) {
    EL.zSw.innerHTML = '<p style="font-size:13px;padding:1rem 0;color:var(--text2)">No slowest keys recorded.</p>';
    return;
  }
  dA('slow');
  const sw = EL.zSw;
  sw.innerHTML = '';
  const slowCanvas = document.createElement('canvas');
  slowCanvas.id = 'z-sc';
  sw.appendChild(slowCanvas);
  sw.style.cssText = `position:relative;height:${Math.max(ANALYZE_CONFIG.BAR_MIN_HEIGHT, sl.length * ANALYZE_CONFIG.BAR_ROW_HEIGHT + ANALYZE_CONFIG.BAR_HEIGHT_PADDING)}px;`;
  aC.slow = new Chart(slowCanvas, {
    type:'bar',
    data:{ labels:sl.map(c=>c.ch===' '?'SPC':c.ch.toUpperCase()), datasets:[{ data:sl.map(c=>Math.round(c.avg)), backgroundColor:sl.map(c=>heatCSS(c.avg,mn,mx)), borderRadius:4, borderWidth:0 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{callbacks:{label:x=>`${x.parsed.x} ms`}} }, scales:{ x:{grid:{color:gc},ticks:{color:tc,font:{size:CHART_STYLE.AXIS_TICK_FONT_SIZE}},title:{display:true,text:'ms',color:tc,font:{size:CHART_STYLE.AXIS_TITLE_FONT_SIZE}}}, y:{grid:{display:false},ticks:{color:tc,font:{size:CHART_STYLE.BAR_Y_TICK_FONT_SIZE,weight:'500'}}} } }
  });
}

function renderErrorRate(chars, gc, tc) {
  if (!chars?.length) {
    EL.zEw.innerHTML = '<p style="font-size:13px;padding:1rem 0;color:var(--text2)">No data to display.</p>';
    return;
  }
  const ec = [...chars].filter(c=>c.er>0).sort((a,b)=>b.er-a.er).slice(0, ANALYZE_CONFIG.ERROR_KEYS_LIMIT);
  dA('err');
  const ew = EL.zEw;
  if (!ec.length) {
    ew.innerHTML='<p style="font-size:13px;padding:1rem 0;color:var(--text2)">No errors — 100% accuracy!</p>';
    ew.style.cssText='';
    return;
  }
  ew.innerHTML = '';
  const errCanvas = document.createElement('canvas');
  errCanvas.id = 'z-ec';
  ew.appendChild(errCanvas);
  ew.style.cssText = `position:relative;height:${Math.max(ANALYZE_CONFIG.BAR_MIN_HEIGHT, ec.length * ANALYZE_CONFIG.BAR_ROW_HEIGHT + ANALYZE_CONFIG.BAR_HEIGHT_PADDING)}px;`;
  aC.err = new Chart(errCanvas, {
    type:'bar',
    data:{ labels:ec.map(c=>c.ch===' '?'SPC':c.ch.toUpperCase()), datasets:[{ data:ec.map(c=>+c.er.toFixed(1)), backgroundColor:'rgba(226,75,74,0.78)', borderRadius:4, borderWidth:0 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{callbacks:{label:x=>`${x.parsed.x}% miss rate`}} }, scales:{ x:{grid:{color:gc},ticks:{color:tc,font:{size:CHART_STYLE.AXIS_TICK_FONT_SIZE}},title:{display:true,text:'%',color:tc,font:{size:CHART_STYLE.AXIS_TITLE_FONT_SIZE}}}, y:{grid:{display:false},ticks:{color:tc,font:{size:CHART_STYLE.BAR_Y_TICK_FONT_SIZE,weight:'500'}}} } }
  });
}

function renderAnalyzeTrend(sessions, wpms, accs, gc, tc) {
  const tw = EL.zTw;
  if (sessions.length < ANALYZE_CONFIG.TREND_MIN_SESSIONS) {
    tw.style.display='none';
    const nav = EL.zTrendNav;
    nav.disabled = true;
    nav.value = '0';
    return;
  }

  tw.style.display = 'block';
  dA('trend');
  const xTrendMinOrig = 0;
  const xTrendMaxOrig = Math.max(0, sessions.length - 1);
  EL.zTleg.innerHTML=`<span><span class="tleg-dot" style="background:${CHART_STYLE.COLORS.wpm};"></span>WPM</span><span><span class="tleg-dot" style="background:${CHART_STYLE.COLORS.acc};"></span>Accuracy %</span>`;
  aC.trend = new Chart(EL.zTc, {
    type:'line',
    data:{ labels:sessions.map((_,i)=>`#${i+1}`), datasets:[
      { label:'WPM',   data:wpms.map(w=>+w.toFixed(1)), borderColor:CHART_STYLE.COLORS.wpm, backgroundColor:'rgba(55,138,221,0.08)', pointBackgroundColor:CHART_STYLE.COLORS.wpm, tension:CHART_STYLE.TREND_LINE_TENSION, fill:true,  pointRadius:ANALYZE_CONFIG.TREND_POINT_RADIUS, yAxisID:'y'  },
      { label:'Acc %', data:accs.map(a=>+a.toFixed(1)), borderColor:CHART_STYLE.COLORS.acc, backgroundColor:'transparent',            pointBackgroundColor:CHART_STYLE.COLORS.acc, tension:CHART_STYLE.TREND_LINE_TENSION, fill:false, pointRadius:ANALYZE_CONFIG.TREND_POINT_RADIUS, yAxisID:'y2' }
    ]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false},tooltip:{mode:'index',intersect:false},zoom:{pan:{enabled:true,mode:'x'},zoom:{wheel:{enabled:true},pinch:{enabled:true},mode:'x'},limits:{x:{min:xTrendMinOrig,max:xTrendMaxOrig}}}}, scales:{ x:{grid:{color:gc},ticks:{color:tc,font:{size:CHART_STYLE.AXIS_TICK_FONT_SIZE}},min:xTrendMinOrig,max:xTrendMaxOrig}, y:{grid:{color:gc},ticks:{color:tc,font:{size:CHART_STYLE.AXIS_TICK_FONT_SIZE}},title:{display:true,text:'WPM',color:tc,font:{size:CHART_STYLE.AXIS_TITLE_FONT_SIZE}}}, y2:{position:'right',grid:{display:false},ticks:{color:CHART_STYLE.COLORS.acc,font:{size:CHART_STYLE.AXIS_TICK_FONT_SIZE}},title:{display:true,text:'Acc %',color:CHART_STYLE.COLORS.acc,font:{size:CHART_STYLE.AXIS_TITLE_FONT_SIZE}},min:ANALYZE_CONFIG.TREND_ACC_MIN,max:ANALYZE_CONFIG.TREND_ACC_MAX} } }
  });
  aC.trend.$navBounds = { min: xTrendMinOrig, max: xTrendMaxOrig };
  syncTrendNav(aC.trend, xTrendMinOrig, xTrendMaxOrig);
}

function renderFingerAnalysis(chars) {
  if (!chars?.length) {
    EL.zFg.innerHTML = '';
    return;
  }
  const fd = {};
  for (const c of chars) {
    if (!c?.ch) continue;
    const fi = FMAP[c.ch] || '?';
    if (!fd[fi]) fd[fi]={wt:0,cnt:0,hits:0,misses:0};
    if (c.avg > 0) {
      fd[fi].wt += c.avg * c.hits;
      fd[fi].cnt += c.hits;
    }
    fd[fi].hits += c.hits;
    fd[fi].misses += c.misses;
  }
  const favgs = FORD.filter(f=>fd[f]).map(f=>fd[f].cnt>0?fd[f].wt/fd[f].cnt:0).filter(v=>v>0);
  const fmn = favgs.length ? Math.min(...favgs) : 0;
  const fmx = favgs.length ? Math.max(...favgs) : 1;
  const fgEl = EL.zFg;
  fgEl.innerHTML='';
  FORD.forEach(f => {
    if (!fd[f]) return;
    const avg = fd[f].cnt>0 ? fd[f].wt/fd[f].cnt : 0;
    const [r,g,b] = avg>0 ? heatRGB(avg,fmn,fmx) : [155,150,142];
    const d = document.createElement('div');
    d.className='finger-card';
    d.style.background=`rgb(${r},${g},${b})`;
    d.innerHTML=`<div class="finger-name">${FNAME[f]}</div><div class="finger-val">${avg>0?Math.round(avg)+'ms':'—'}</div><div class="finger-hits">${fd[f].hits} hits</div>`;
    fgEl.appendChild(d);
  });
}

function renderFocusKeys(chars, mn) {
  if (!chars?.length) {
    EL.zWk.innerHTML = '';
    return;
  }
  const baseline = mn > 0 ? mn : 1;
  const scored = [...chars]
    .filter(c=>c.avg>0||c.er>0)
    .map(c=>({...c, score:(c.avg/baseline)+(c.er*ANALYZE_CONFIG.FOCUS_ERROR_WEIGHT)}))
    .sort((a,b)=>b.score-a.score)
    .slice(0, ANALYZE_CONFIG.FOCUS_KEYS_LIMIT);
  if (!scored.length) {
    EL.zWk.innerHTML = '';
    return;
  }
  const wkEl = EL.zWk;
  wkEl.innerHTML='';
  const wg = document.createElement('div');
  wg.className='focus-grid';
  scored.forEach(w => {
    const chip = document.createElement('div');
    chip.className='focus-chip';
    chip.innerHTML=`<span class="focus-key">${w.ch===' '?'SPC':w.ch.toUpperCase()}</span><span class="focus-sub">${Math.round(w.avg)}ms · ${w.er.toFixed(1)}% errors</span>`;
    wg.appendChild(chip);
  });
  wkEl.appendChild(wg);
  const note = document.createElement('p');
  note.className='focus-note';
  note.textContent='Ranked by combined slowness and error rate. Drilling these will give you the biggest speed gains.';
  wkEl.appendChild(note);
}

function analyze(sessions) {
  if (!sessions?.length) return;
  const palette = analyzePalette();
  const chars = buildCharacterStats(sessions);
  if (!chars.length) return;
  const wpms = sessions.map(sessionWPM);
  const accs = sessions.map(sessionAcc);

  renderAnalyzeCards(sessions, wpms, accs);
  const { mn, mx } = renderKeyboardHeatmap(chars, palette.noBg, palette.noFg);
  renderSlowestKeys(chars, mn, mx, palette.gc, palette.tc);
  renderErrorRate(chars, palette.gc, palette.tc);
  renderAnalyzeTrend(sessions, wpms, accs, palette.gc, palette.tc);
  renderFingerAnalysis(chars);
  renderFocusKeys(chars, mn);
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS TAB
// ─────────────────────────────────────────────────────────────────────────────

// Ordinary least squares: given paired arrays xs and ys, returns { slope, intercept, r2 }
function linReg(xs, ys) {
  if (!xs?.length || !ys?.length || xs.length !== ys.length) return { slope: 0, intercept: 0, r2: 0 };
  const n = xs.length;
  const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n;
  let ssXX=0, ssXY=0, ssYY=0;
  for (let i=0;i<n;i++) {
    ssXX += (xs[i]-mx)**2;
    ssXY += (xs[i]-mx)*(ys[i]-my);
    ssYY += (ys[i]-my)**2;
  }
  const slope     = ssXX ? ssXY/ssXX : 0;
  const intercept = my - slope*mx;
  const r2        = ssYY ? (ssXY**2)/(ssXX*ssYY) : 0;
  return { slope, intercept, r2 };
}

const pC = { main:null, count:null, reg:null };
function dP(k) { if (pC[k]) { try { pC[k].destroy(); } catch(e){} pC[k]=null; } }

function syncChartNav(chart, nav, fullMin, fullMax) {
  if (!nav || !chart?.scales?.x) return;

  const x = chart.scales.x;
  const fullSpan = fullMax - fullMin;
  const viewSpan = x.max - x.min;
  const movableSpan = fullSpan - viewSpan;

  if (movableSpan <= PROGRESS_CONFIG.NAV_EPSILON) {
    nav.disabled = true;
    nav.value = '0';
    return;
  }

  const leftRatio = (x.min - fullMin) / movableSpan;
  nav.disabled = false;
  nav.value = String(Math.max(0, Math.min(PROGRESS_CONFIG.NAV_MAX_VALUE, Math.round(leftRatio * PROGRESS_CONFIG.NAV_MAX_VALUE))));
}

function syncRegNav(chart, fullMin, fullMax) {
  syncChartNav(chart, EL.pRegNav, fullMin, fullMax);
}

function syncTrendNav(chart, fullMin, fullMax) {
  syncChartNav(chart, EL.zTrendNav, fullMin, fullMax);
}

function syncMainNav(chart, fullMin, fullMax) {
  syncChartNav(chart, EL.pMainNav, fullMin, fullMax);
}

function panChartFromNav(chart, value) {
  if (!chart || !chart.$navBounds || !chart.scales?.x) return;
  const fullMin = chart.$navBounds.min;
  const fullMax = chart.$navBounds.max;
  const x = chart.scales.x;
  const viewSpan = x.max - x.min;
  const movableSpan = (fullMax - fullMin) - viewSpan;
  if (movableSpan <= PROGRESS_CONFIG.NAV_EPSILON) return;

  const ratio = Number(value) / PROGRESS_CONFIG.NAV_MAX_VALUE;
  const newMin = fullMin + movableSpan * ratio;
  chart.options.scales.x.min = newMin;
  chart.options.scales.x.max = newMin + viewSpan;
  chart.update('none');
}

function bindChartNav(navEl, chartGetter) {
  navEl.addEventListener('input', e => {
    panChartFromNav(chartGetter(), e.target.value);
  });
}

function syncCountViewportFromMain() {
  if (!pC.main || !pC.count || !pC.main.scales?.x) return;
  const min = pC.main.scales.x.min;
  const max = pC.main.scales.x.max;
  pC.count.options.scales.x.min = min;
  pC.count.options.scales.x.max = max;
  pC.count.update('none');
}

// Group sessions by day, then compute the four WPM metrics per day
function buildDailyStats(sessions) {
  if (!sessions?.length) return [];
  const buckets = {};
  for (const s of sessions) {
    if (!s?.timeStamp) continue;
    const d = sessionDate(s);
    if (!buckets[d]) buckets[d] = [];
    buckets[d].push(s);
  }
  return Object.keys(buckets).sort().map(day => {
    const ss   = buckets[day];
    const wpms = ss.map(sessionWPM);
    const accs = ss.map(sessionAcc);
    return {
      label:  fmtDate(day),
      count:  ss.length,
      avgWPM: wpms.reduce((a,b)=>a+b,0) / wpms.length,
      p80WPM: percentile(wpms, 80),   // 80th percentile: better than 80% of that day's tests
      p95WPM: percentile(wpms, 95),   // 95th percentile: near-peak performance
      bestWPM:Math.max(...wpms),       // single best run of the day
      avgAcc: accs.reduce((a,b)=>a+b,0) / accs.length,
    };
  });
}

function renderProgress() {
  const history = loadHistory();
  const emptyEl = EL.pEmpty;
  const dashEl  = EL.pDash;

  if (!history.length) {
    emptyEl.style.display='block'; dashEl.style.display='none'; return;
  }
  emptyEl.style.display='none'; dashEl.style.display='block';

  const daily   = buildDailyStats(history);
  const dark    = isDark();
  const tc      = dark ? 'rgba(255,255,255,0.58)' : 'rgba(0,0,0,0.52)';
  const gc      = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const barBg   = dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.14)';

  // Summary cards
  const allWPMs = history.map(sessionWPM);
  const allAccs = history.map(sessionAcc);
  EL.pSubtitle.textContent =
    `${history.length} session${history.length!==1?'s':''} across ${daily.length} day${daily.length!==1?'s':''}`;

  const pCards = EL.pCards;
  pCards.innerHTML='';
  [
    { l:'All-time best',  v:Math.max(...allWPMs).toFixed(1)+' WPM', s:'single session peak' },
    { l:'Overall avg',    v:(allWPMs.reduce((a,b)=>a+b,0)/allWPMs.length).toFixed(1)+' WPM', s:'all sessions' },
    { l:'Avg accuracy',   v:(allAccs.reduce((a,b)=>a+b,0)/allAccs.length).toFixed(1)+'%', s:'all sessions' },
    { l:'Total sessions', v:history.length.toLocaleString(), s:`${daily.length} days tracked` },
  ].forEach(c => {
    const d=document.createElement('div'); d.className='card';
    d.innerHTML=`<div class="card-label">${c.l}</div><div class="card-value">${c.v}</div><div class="card-sub">${c.s}</div>`;
    pCards.appendChild(d);
  });

  // Legend
  const COLORS = {
    avgWPM: CHART_STYLE.COLORS.avgWPM,
    p80WPM: CHART_STYLE.COLORS.p80WPM,
    p95WPM: CHART_STYLE.COLORS.p95WPM,
    bestWPM: CHART_STYLE.COLORS.bestWPM,
  };
  EL.pLegend.innerHTML = [
    { key:'avgWPM',  label:'Avg WPM',      dashes:'' },
    { key:'p80WPM',  label:'80th pct WPM', dashes:'5,3' },
    { key:'p95WPM',  label:'95th pct WPM', dashes:'2,2' },
    { key:'bestWPM', label:'Best WPM',     dashes:'' },
  ].map(l => {
    const style = l.dashes
      ? `background:repeating-linear-gradient(to right,${COLORS[l.key]} 0,${COLORS[l.key]} 4px,transparent 4px,transparent 7px);`
      : `background:${COLORS[l.key]};`;
    return `<span><span class="leg-line" style="${style}"></span>${l.label}</span>`;
  }).join('');

  const labels = daily.map(d => d.label);
  const xMainMinOrig = 0;
  const xMainMaxOrig = Math.max(0, labels.length - 1);

  // ── Main line chart (WPM metrics, x-tick labels hidden) ───────────────────
  dP('main');
  pC.main = new Chart(EL.pMain, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label:'Avg WPM',   data:daily.map(d=>+d.avgWPM.toFixed(1)),  borderColor:COLORS.avgWPM,  backgroundColor:'rgba(55,138,221,0.07)', pointBackgroundColor:COLORS.avgWPM,  tension:CHART_STYLE.MAIN_LINE_TENSION, fill:true,  pointRadius:PROGRESS_CONFIG.MAIN_POINT_RADIUS, pointHoverRadius:PROGRESS_CONFIG.MAIN_POINT_HOVER_RADIUS },
        { label:'80th pct',  data:daily.map(d=>+d.p80WPM.toFixed(1)),  borderColor:COLORS.p80WPM,  backgroundColor:'transparent',           pointBackgroundColor:COLORS.p80WPM,  tension:CHART_STYLE.MAIN_LINE_TENSION, fill:false, pointRadius:PROGRESS_CONFIG.MAIN_POINT_RADIUS, pointHoverRadius:PROGRESS_CONFIG.MAIN_POINT_HOVER_RADIUS, borderDash:CHART_STYLE.DASH_80 },
        { label:'95th pct',  data:daily.map(d=>+d.p95WPM.toFixed(1)),  borderColor:COLORS.p95WPM,  backgroundColor:'transparent',           pointBackgroundColor:COLORS.p95WPM,  tension:CHART_STYLE.MAIN_LINE_TENSION, fill:false, pointRadius:PROGRESS_CONFIG.MAIN_POINT_RADIUS, pointHoverRadius:PROGRESS_CONFIG.MAIN_POINT_HOVER_RADIUS, borderDash:CHART_STYLE.DASH_95 },
        { label:'Best WPM',  data:daily.map(d=>+d.bestWPM.toFixed(1)), borderColor:COLORS.bestWPM, backgroundColor:'transparent',           pointBackgroundColor:COLORS.bestWPM, tension:CHART_STYLE.MAIN_LINE_TENSION, fill:false, pointRadius:PROGRESS_CONFIG.MAIN_POINT_RADIUS, pointHoverRadius:PROGRESS_CONFIG.MAIN_POINT_HOVER_RADIUS },
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{mode:'index',intersect:false}, zoom:{pan:{enabled:true,mode:'x'},zoom:{wheel:{enabled:true},pinch:{enabled:true},mode:'x'},limits:{x:{min:xMainMinOrig,max:xMainMaxOrig}}} },
      scales:{
        x:{
          grid:{ color:gc },
          ticks:{ display:false },          // ← dates appear only on the bottom chart
          border:{ display:false },
        },
        y:{
          grid:{ color:gc },
          ticks:{ color:tc, font:{size:CHART_STYLE.AXIS_TICK_FONT_SIZE} },
          title:{ display:true, text:'WPM', color:tc, font:{size:CHART_STYLE.AXIS_TITLE_FONT_SIZE} },
        }
      },
      layout:{ padding:{ bottom:0 } }
    }
  });
  pC.main.$navBounds = { min: xMainMinOrig, max: xMainMaxOrig };
  syncMainNav(pC.main, xMainMinOrig, xMainMaxOrig);

  // ── Count subplot (bar chart, shows x-tick date labels) ───────────────────
  dP('count');
  pC.count = new Chart(EL.pCounts, {
    type: 'bar',
    data: {
      labels,
      datasets:[{
        label:'Tests',
        data: daily.map(d => d.count),
        backgroundColor: barBg,
        borderRadius:3, borderWidth:0
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:x=>`${x.parsed.y} test${x.parsed.y!==1?'s':''}`}} },
      scales:{
        x:{
          grid:{ color:gc, offset:false },
          offset:false,
          ticks:{ color:tc, font:{size:CHART_STYLE.AXIS_TICK_FONT_SIZE}, maxRotation:45, autoSkip:true, maxTicksLimit:14 },
          border:{ display:false },
        },
        y:{
          grid:{ color:gc },
          ticks:{ color:tc, font:{size:CHART_STYLE.AXIS_TITLE_FONT_SIZE}, stepSize:1 },
          title:{ display:true, text:'Tests', color:tc, font:{size:CHART_STYLE.AXIS_TITLE_FONT_SIZE} },
          min:0
        }
      },
      layout:{ padding:{ top:0 } }
    }
  });
  syncCountViewportFromMain();

  // ── Progress estimation: linear regression over last 10 active days ─────────
  //
  // We treat each individual session as one data point.
  // x = sequential test number (1, 2, 3 … N) within the window
  // y = WPM of that session
  // This lets us ask: "for every extra test I do, how many WPM do I gain?"
  dP('reg');

  // Sort all sessions chronologically and take the last 10 distinct days
  const sorted10 = [...history].sort((a,b) => a.timeStamp < b.timeStamp ? -1 : 1);
  const last10days = [...new Set(sorted10.map(sessionDate))].slice(-PROGRESS_CONFIG.LAST_ACTIVE_DAYS);
  const last10set  = new Set(last10days);
  const window10   = sorted10.filter(s => last10set.has(sessionDate(s)));

  // Build (x, y) pairs — x is 1-indexed test number within the window
  const xs = window10.map((_, i) => i + 1);
  const ys = window10.map(sessionWPM);
  const { slope, intercept, r2 } = linReg(xs, ys);

  // Extrapolate 25% more tests into the future
  const nTests     = xs.length;
  const extraTests = Math.max(PROGRESS_CONFIG.REG_MIN_EXTRA_TESTS, Math.round(nTests * PROGRESS_CONFIG.REG_EXTRA_RATIO));
  const xEnd       = nTests + extraTests;
  const xMinOrig   = 0;
  const xMaxOrig   = xEnd;

  // Two-point regression line (+ short extrapolation shown as dashed)
  const regLine    = [ { x:1,      y: intercept + slope*1      },
                       { x:nTests, y: intercept + slope*nTests  } ];
  const extrapLine = [ { x:nTests, y: intercept + slope*nTests  },
                       { x:xEnd,   y: intercept + slope*xEnd    } ];

  // Scatter points, coloured by day so you can see day clusters
  const dayColors = CHART_STYLE.DAY_COLORS;
  const dayIndex  = {};
  last10days.forEach((d, i) => dayIndex[d] = i);
  const pointColors = window10.map(s => dayColors[dayIndex[sessionDate(s)] % dayColors.length]);

  // Regression summary cards
  const currentWPM  = intercept + slope * nTests;
  const projWPM     = intercept + slope * xEnd;
  const wpmPer10    = slope * PROGRESS_CONFIG.IMPROVEMENT_BLOCK_TESTS;

  const rcEl = EL.pRegCards;
  rcEl.innerHTML = '';
  [
    { l:'Improvement rate', v:(wpmPer10>=0?'+':'')+wpmPer10.toFixed(2)+' WPM', s:'per 10 tests' },
    { l:'Current level',    v:currentWPM.toFixed(1)+' WPM',   s:'regression at last test' },
    { l:`In ${extraTests} more tests`, v:projWPM.toFixed(1)+' WPM', s:'projected by trend' },
    { l:'Fit quality (R²)', v:r2.toFixed(3), s: r2>=PROGRESS_CONFIG.FIT_STRONG_R2 ? 'strong trend' : r2>=PROGRESS_CONFIG.FIT_MODERATE_R2 ? 'moderate trend' : 'noisy / flat' },
  ].forEach(c => {
    const d=document.createElement('div'); d.className='card';
    d.innerHTML=`<div class="card-label">${c.l}</div><div class="card-value">${c.v}</div><div class="card-sub">${c.s}</div>`;
    rcEl.appendChild(d);
  });

  // Subtitle
  EL.pRegSubtitle.textContent =
    `${nTests} sessions across ${last10days.length} day${last10days.length!==1?'s':''} · each dot is one test`;

  const regColor = CHART_STYLE.COLORS.danger;
  pC.reg = new Chart(EL.pReg, {
    type: 'scatter',
    data: {
      datasets: [
        {
          // Individual session WPM dots, coloured by day
          label: 'Session WPM',
          data: xs.map((x, i) => ({ x, y: +ys[i].toFixed(1) })),
          pointBackgroundColor: pointColors,
          pointBorderColor:     pointColors,
          pointRadius: PROGRESS_CONFIG.REG_SCATTER_POINT_RADIUS, pointHoverRadius: PROGRESS_CONFIG.REG_SCATTER_HOVER_RADIUS,
          showLine: false,
        },
        {
          // Fitted regression line (solid)
          label: 'Trend',
          data: regLine,
          borderColor: regColor, backgroundColor: 'transparent',
          pointRadius: 0, showLine: true,
          borderWidth: CHART_STYLE.REG_LINE_WIDTH, tension: 0,
        },
        {
          // Extrapolated portion (dashed)
          label: 'Projected',
          data: extrapLine,
          borderColor: regColor, backgroundColor: 'transparent',
          pointRadius: 0, showLine: true,
          borderWidth: CHART_STYLE.REG_LINE_WIDTH, borderDash: CHART_STYLE.REG_EXTRAP_DASH, tension: 0,
        },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              if (ctx.datasetIndex === 0) return `Test #${ctx.parsed.x}: ${ctx.parsed.y.toFixed(1)} WPM`;
              if (ctx.datasetIndex === 1) return `Trend: ${ctx.parsed.y.toFixed(1)} WPM`;
              return `Projected: ${ctx.parsed.y.toFixed(1)} WPM`;
            }
          }
        },
        zoom: {
          pan: { enabled: true, mode: 'x' },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: 'x'
          },
          limits: {
            x: { min: xMinOrig, max: xMaxOrig }
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          grid: { color: gc },
          ticks: { color: tc, font: { size: CHART_STYLE.AXIS_TICK_FONT_SIZE }, stepSize: 1 },
          title: { display: true, text: 'test number (within window)', color: tc, font: { size: CHART_STYLE.AXIS_TITLE_FONT_SIZE } },
          min: xMinOrig,
          max: xMaxOrig,
        },
        y: {
          grid: { color: gc },
          ticks: { color: tc, font: { size: CHART_STYLE.AXIS_TICK_FONT_SIZE } },
          title: { display: true, text: 'WPM', color: tc, font: { size: CHART_STYLE.AXIS_TITLE_FONT_SIZE } },
        }
      }
    }
  });
  pC.reg.$navBounds = { min: xMinOrig, max: xMaxOrig };
  syncRegNav(pC.reg, xMinOrig, xMaxOrig);

  // ── Align both subplot plot-area edges so vertical grids fully match ───────
  //
  // Differences in axis/tick label widths can shift chartArea.left and
  // chartArea.right independently across the two subplots. We normalize both
  // edges by adding layout padding where needed.
  //
  //   1. Waiting two animation frames (double RAF) so both canvases have been
  //      fully painted and Chart.js has measured chartArea.left.
  //   2. Matching both left and right plot boundaries.
  //   3. Calling update('none') with no animation.
  //
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const c1 = pC.main, c2 = pC.count;
    if (!c1 || !c2) return;

    const l1 = c1.chartArea.left,  r1 = c1.chartArea.right;
    const l2 = c2.chartArea.left,  r2 = c2.chartArea.right;
    const targetLeft  = Math.max(l1, l2);
    const targetRight = Math.min(r1, r2);

    const p1 = c1.options.layout.padding || {};
    const p2 = c2.options.layout.padding || {};

    const addL1 = Math.max(0, targetLeft - l1);
    const addL2 = Math.max(0, targetLeft - l2);
    const addR1 = Math.max(0, r1 - targetRight);
    const addR2 = Math.max(0, r2 - targetRight);

    const changed1 = addL1 > PROGRESS_CONFIG.ALIGN_EPSILON || addR1 > PROGRESS_CONFIG.ALIGN_EPSILON;
    const changed2 = addL2 > PROGRESS_CONFIG.ALIGN_EPSILON || addR2 > PROGRESS_CONFIG.ALIGN_EPSILON;
    if (!changed1 && !changed2) return;

    c1.options.layout.padding = {
      top: p1.top || 0,
      right: (p1.right || 0) + addR1,
      bottom: p1.bottom || 0,
      left: (p1.left || 0) + addL1,
    };
    c2.options.layout.padding = {
      top: p2.top || 0,
      right: (p2.right || 0) + addR2,
      bottom: p2.bottom || 0,
      left: (p2.left || 0) + addL2,
    };

    c1.update('none');
    c2.update('none');
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT LISTENERS
// ─────────────────────────────────────────────────────────────────────────────

EL.zFileBtn.addEventListener('click', () => {
  EL.zFile.click();
});

EL.zFile.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    EL.zRaw.value = ev.target.result;
    // Mirror the Analyze button behavior after loading file contents.
    EL.zGo.click();
  };
  reader.readAsText(file);
  // Reset so the same file can be re-selected later if needed
  e.target.value = '';
});

EL.zDemo.addEventListener('click', async () => {
  const msg = EL.zMsg;
  msg.textContent = '';

  // Always have a ready fallback so the button never appears "dead".
  let demoSessions = generateDemoSessions();
  let loadedFromFile = false;

  try {
    const response = await Promise.race([
      fetch('demo_keybr_history.json', { cache: 'no-store' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500)),
    ]);

    if (response?.ok) {
      const fromFile = await response.json();
      if (Array.isArray(fromFile) && fromFile[0]?.histogram) {
        demoSessions = fromFile;
        loadedFromFile = true;
      }
    }
  } catch (e) {
    // Keep using generated fallback data.
  }

  EL.zRaw.value = JSON.stringify(demoSessions, null, 2);
  EL.zGo.click();
  if (!loadedFromFile) {
    msg.textContent = 'Loaded built-in demo data.';
  }
});

EL.zGo.addEventListener('click', () => {
  const raw = EL.zRaw.value.trim();
  const msg = EL.zMsg;
  if (!raw) { msg.textContent='Paste some JSON first.'; return; }
  let sessions;
  try {
    const p = JSON.parse(raw);
    sessions = Array.isArray(p) ? p : [p];
    if (!sessions[0]?.histogram) throw new Error('missing histogram field');
  } catch(e) { msg.textContent='Invalid JSON: '+e.message; return; }
  msg.textContent='';
  EL.zIn.style.display='none';
  EL.zDash.style.display='block';
  analyze(sessions);

  // Auto-save to history, deduplicating by timeStamp
  const existing = loadHistory();
  const existingTS = new Set(existing.map(s => s.timeStamp));
  const newOnes = sessions.filter(s => !existingTS.has(s.timeStamp));
  if (newOnes.length) saveHistory([...existing, ...newOnes]);
});

EL.zRs.addEventListener('click', () => {
  EL.zIn.style.display='block';
  EL.zDash.style.display='none';
  EL.zRaw.value='';
  EL.zMsg.textContent='';
});

EL.pClear.addEventListener('click', () => {
  if (!confirm('Clear all saved history? This cannot be undone.')) return;
  localStorage.removeItem(LS_KEY);
  renderProgress();
});

bindChartNav(EL.pMainNav, () => pC.main);
bindChartNav(EL.pRegNav, () => pC.reg);
bindChartNav(EL.zTrendNav, () => aC.trend);

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'progress') renderProgress();
  });
});
