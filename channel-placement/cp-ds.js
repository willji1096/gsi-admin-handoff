(function () {
'use strict';



const METRICS = [
  { key: 'svi', label: 'SVI', desc: '채널번호 가치', full: 'Slot Value Index',    tip: '채널 번호(위치)가 가진 가치를 나타내는 지표입니다.', seed: [0, 60, 330], liftFactor: .009,  lineupLift: .9 },
  { key: 'cpi', label: 'CPI', desc: '콘텐츠 파워',   full: 'Content Power Index',  tip: '채널의 콘텐츠와 브랜드의 경쟁력을 나타내는 지표입니다.', seed: [3, 57, 370], liftFactor: .0045, lineupLift: .45 },
  { key: 'zpi', label: 'ZPI', desc: '재핑 파워',     full: 'Zapping Power Index',  tip: '채널 이동(재핑)에 따른 유입 정도를 나타내는 지표입니다.', seed: [6, 55, 390], liftFactor: .0118, lineupLift: 1.18 }
];
const COMPOSITE = { key: 'composite', label: '종합지수', desc: '평균', full: '종합지수', tip: 'SVI, CPI, ZPI를 평균한 값입니다.' };

const abbr = m => `<span class="abbr" data-tip="${esc(m.full)} · ${esc(m.tip)}">${m.label}</span>`;
const ALL_METRICS = [...METRICS, COMPOSITE];
const TABLE_METRICS = [COMPOSITE, ...METRICS];

const GENRE_COLORS = {
  '데이터홈쇼핑': 'var(--sec-purple)', '라이브홈쇼핑': 'var(--graph-03)', '지상파': 'var(--graph-04)', '종합편성': 'var(--graph-09)',
  '드라마/오락/음악': 'var(--graph-01)', '영화/시리즈': 'var(--graph-02)', '뉴스/경제': 'var(--graph-13)', '스포츠/레저': 'var(--graph-05)',
  '공공/공익/정보': 'var(--graph-10)', '다큐/교양': 'var(--graph-07)', '애니/유아/교육': 'var(--graph-06)', '종교/오픈': 'var(--graph-08)',
  '성인': 'var(--graph-15)', '오디오': 'var(--graph-12)'
};


const GRADES = [[85, 'S'], [78, 'A+'], [70, 'A-'], [0, 'B']];
const gradeOf = v => (GRADES.find(g => v >= g[0]) || GRADES[GRADES.length - 1])[1];

const PAGE_SIZE = 49;
let channelPageRange = null;

const MAX_SWAPS = 10;
const MAX_NEW = 10;

const MAX_PP = 10;
const ppCount = () => ppScenarios.length;
const swapCount = () => swapScenarios.length;

let ops = [];

let ppScenarios = [];
const STORE = { history: 'cpHistory' };
const URL_STATE = new URLSearchParams(location.search).get('state') || '';
const valueView = 'compare';   


const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const ord = n => n >= 997 ? n - 997 : n + 3;                 
const hash = s => [...s].reduce((a, c) => ((a * 31 + c.charCodeAt(0)) >>> 0), 7);
const val = (s, min, span) => +(min + (s % span) / 10).toFixed(1);
const f1 = n => (+n).toFixed(1);
const signed = n => `${n > 0 ? '+' : ''}${f1(n)}%`;
const genreColor = g => GENRE_COLORS[g] || 'var(--gray-300)';
const composite = c => +((c.svi + c.cpi + c.zpi) / 3).toFixed(2);
function recalculateRunComposite(run) {
  if (!run) return run;
  const recalculate = channels => channels.map(c => ({ ...c, composite: composite(c) }));
  return { ...run, work: recalculate(run.work), baseline: run.baseline ? recalculate(run.baseline) : run.baseline };
}
const fmtTime = t => new Date(t).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
const fmtDate = d => d ? d.replace(/-/g, '.') : '';

const ro = w => {
  const c = String(w).charCodeAt(String(w).length - 1);
  if (c < 0xAC00 || c > 0xD7A3) return '로';
  const j = (c - 0xAC00) % 28;
  return j === 0 || j === 8 ? '로' : '으로';
};


const ICONS = {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  'chev-left': '<path d="m15 18-6-6 6-6"/>',
  'chev-right': '<path d="m9 18 6-6-6-6"/>',
  reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  swap: '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  loader: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  chart: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  pulse: '<line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  cpu: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>'
};
const ic = (name, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
function mountIcons(root = document) {
  $$('i[data-ic]', root).forEach(el => {
    const svg = document.createElement('span');
    svg.innerHTML = ic(el.dataset.ic, el.className || 'i');
    const s = svg.firstChild;
    if (el.id) s.id = el.id;
    el.replaceWith(s);
  });
}

const AUDIENCE_COLS = [['viewUV', '시청UV (만)'], ['dwellHours', '체류시간 (시간)']];
const countFormat = new Intl.NumberFormat('ko-KR');
const formatCount = n => Number.isFinite(n) ? countFormat.format(Math.round(n)) : '—';
function sampleAudience(name, no) {
  const h = hash(name + '-audience-' + no), viewers = 15000 + h % 485000;
  return { viewers, watchSeconds: viewers * (180 + h % 3420) };
}
// 기존 예시 시청자수를 UV로 환산한다. 실제 UV가 연동되면 viewUV(만)를 우선 사용한다.
function audienceOf(c) {
  const fallback = sampleAudience(c.name, c.originalNo ?? c.no);
  const viewers = Number.isFinite(c.viewers) ? c.viewers : fallback.viewers;
  const watchSeconds = Number.isFinite(c.watchSeconds) ? c.watchSeconds : fallback.watchSeconds;
  const viewUV = Number.isFinite(c.viewUV) ? c.viewUV : viewers / 10000;
  const dwellHours = Number.isFinite(c.dwellHours) ? c.dwellHours : (viewUV > 0 ? watchSeconds / (viewUV * 10000) / 3600 : 0);
  return { viewers, watchSeconds, viewUV, dwellHours };
}
const audienceDecimalFormat = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function formatAudience(key, value) {
  return Number.isFinite(value) ? (key === 'viewUV' || key === 'dwellHours' ? audienceDecimalFormat.format(value) : formatCount(value)) : '—';
}
function audienceCells(c) {
  const values = audienceOf(c);
  return AUDIENCE_COLS.map(([key]) => `<td class="audience-cell">${formatAudience(key, values[key])}</td>`).join('');
}
function resultValue(p, key, mode = valueView) {
  if (mode === 'asis' && !p.hasBefore) return null;
  const c = mode === 'asis' ? p.src : mode === 'scenario' ? p.c : p.after;
  return AUDIENCE_COLS.some(([k]) => k === key) ? audienceOf(c)[key] : c[key];
}
function resultValueText(p, key) {
  const format = n => resultNumber(n);
  return valueView === 'compare'
    ? `${format(resultValue(p, key, 'asis'))} → ${format(resultValue(p, key, 'tobe'))}`
    : format(resultValue(p, key));
}
function audienceComparison(p) {
  return AUDIENCE_COLS.map(([key]) => `<td class="audience-cell">${resultValueText(p, key)}</td>`).join('');
}
function tileAudience(c, opts) {
  const before = opts.beforeAudience || audienceOf(c), after = opts.after;
  const mode = after ? (valueView === 'scenario' ? 'tobe' : valueView) : 'asis';
  return `<div class="tile__audience ${after && mode === 'compare' ? 'is-compare' : ''}">${[['viewUV','시청UV','만'],['dwellHours','체류시간','시간']].map(([key,label,unit]) => {
    const b = opts.isNew ? '—' : formatAudience(key, before[key]);
    const a = after ? formatAudience(key, after[key]) : '';
    const value = mode === 'compare' ? `${b} → ${a}` : mode === 'asis' ? b : a;
    return `<div class="tile__stat"><span>${label} (${unit})</span><b>${value}</b></div>`;
  }).join('')}</div>`;
}

const base = window.CP_CHANNELS.map(([g, name, no], i) => {
  const h = hash(name + no), c = { id: 'ch-' + i, g, name, no, originalNo: no, ...sampleAudience(name, no) };
  // seed[0]=0 이면 시프트 없이 원값(부호 없는 32bit) — `h >> 0` 은 부호 있는 정수로 바뀌어 KT 초안과 값이 달라진다
  METRICS.forEach(m => { c[m.key] = val(m.seed[0] ? h >> m.seed[0] : h, m.seed[1], m.seed[2]); });
  c.composite = composite(c);
  Object.assign(c, audienceOf(c));
  return c;
}).sort((a, b) => ord(a.no) - ord(b.no));
const GENRES = [...new Set(base.map(c => c.g))];
const byId = (id, list = base) => list.find(x => x.id === id);
const avg = (k, list = base) => list.reduce((s, c) => s + c[k], 0) / list.length;
const DEFAULT_SELECTED = base.find(c => c.no === 8).id;


let work = base.map(x => ({ ...x }));
let changes = [], swapScenarios = [];
let selectedId = DEFAULT_SELECTED, swapTargetId = null, selectionPhase = 'counterpart', autoApplyPending = false, mode = 'swap';
let hasResults = false, resultRun = null, failOnce = URL_STATE === 'fail';

let resultsStale = false;
const pages = { current: 1, scenario: 1, results: 1 };
const views = { current: 'grid', scenario: 'grid', results: 'table' };
const sorts = { current: { key: 'order', dir: 'asc' }, scenario: { key: 'order', dir: 'asc' }, results: { key: 'order', dir: 'asc' } };
let trend = { days: 7, metric: 'viewUV', channelId: null };
let trendRunKey = null;
let history = [];
try { history = URL_STATE === 'empty' ? [] : JSON.parse(localStorage.getItem(STORE.history) || '[]'); } catch (e) { history = []; }

history = history.filter(h => h.status === '완료' || h.status === '성공' || h.status === '실패')
                 .map(h => (h.status === '완료' ? { ...h, status: '성공' } : h))
                 
                 .map(h => ({ ...h, details: Array.isArray(h.details) ? h.details : [],
                                    scenario: Array.isArray(h.scenario) ? h.scenario : [],
                                    type: '실행', summary: h.summary || '' }))
                 .map(h => ({ ...h, summary: historySummary(h.details, h.baseDate), run: recalculateRunComposite(h.run) }));

// Stable sample IDs prevent duplicate entries when the file is reopened.
if (URL_STATE !== 'empty') {
  const sampleDay = new Date();
  sampleDay.setDate(sampleDay.getDate() - 1);
  const sampleDate = `${sampleDay.getFullYear()}-${String(sampleDay.getMonth() + 1).padStart(2, '0')}-${String(sampleDay.getDate()).padStart(2, '0')}`;
  const samplePairs = [[8, 10], [5, 7], [15, 18]];
  const samples = samplePairs.map(([aNo, bNo], i) => {
    const a = base.find(c => c.no === aNo), b = base.find(c => c.no === bNo);
    return {
      id: -270901 - i,
      time: new Date(Date.now() - (i + 1) * 15 * 60000).toISOString(),
      baseDate: sampleDate,
      type: '실행',
      summary: `2개 채널 변경 · 기준일 ${fmtDate(sampleDate)}`,
      status: '실패',
      details: [
        { no: a.no, name: b.name, genre: b.g, before: a.name, after: b.name, changeType: 'swap' },
        { no: b.no, name: a.name, genre: a.g, before: b.name, after: a.name, changeType: 'swap' }
      ],
      scenario: [{ kind: 'swap', aId: a.id, bId: b.id }],
      run: null
    };
  }).filter(sample => !history.some(h => h.id === sample.id));
  if (samples.length) {
    history = [...samples, ...history];
    try { localStorage.setItem(STORE.history, JSON.stringify(history)); } catch (e) { }
  }
}


// Mixed scenario sample: PP replacement, swap and new channel.
if (URL_STATE !== 'empty' && !history.some(h => h.id === -270904)) {
  const sample = {"id":-270904,"time":"2026-09-27T06:43:35.117Z","baseDate":"2026-09-26","type":"실행","summary":"4개 채널 변경 · 기준일 2026.09.26","status":"성공","isSample":true,"scenario":[{"kind":"pp","slotId":"ch-3","srcId":"ch-21"},{"kind":"swap","aId":"ch-8","bId":"ch-10"},{"kind":"new","id":"sample-mixed-new","name":"시네마플러스","g":"영화/시리즈","pos":111,"similarId":"ch-33"}],"run":{"baseline":[{"id":"ch-311","g":"드라마/오락/음악","name":"지니 TV 가이드","no":997,"originalNo":997,"viewers":251440,"watchSeconds":598427200,"svi":79,"cpi":54.5,"zpi":18.1,"composite":50.53,"viewUV":25.144,"dwellHours":0.6611111111111112},{"id":"ch-312","g":"드라마/오락/음악","name":"E채널","no":998,"originalNo":998,"viewers":314930,"watchSeconds":771578500,"svi":90.8,"cpi":79.9,"zpi":86.3,"composite":85.67,"viewUV":31.493,"dwellHours":0.6805555555555556},{"id":"ch-313","g":"드라마/오락/음악","name":"ENA PLAY","no":999,"originalNo":999,"viewers":249370,"watchSeconds":690754900,"svi":73.8,"cpi":57.4,"zpi":59.4,"composite":63.53,"viewUV":24.937,"dwellHours":0.7694444444444445},{"id":"ch-0","g":"데이터홈쇼핑","name":"GS MY SHOP","no":0,"originalNo":0,"viewers":278623,"watchSeconds":535792029,"svi":71.3,"cpi":85,"zpi":85.1,"composite":80.47,"viewUV":27.8623,"dwellHours":0.5341666666666667},{"id":"ch-1","g":"드라마/오락/음악","name":"ENA","no":1,"originalNo":1,"viewers":79420,"watchSeconds":76243200,"svi":68.8,"cpi":74.6,"zpi":72.2,"composite":71.87,"viewUV":7.942,"dwellHours":0.26666666666666666},{"id":"ch-2","g":"라이브홈쇼핑","name":"NS홈쇼핑","no":2,"originalNo":2,"viewers":372557,"watchSeconds":445950729,"svi":79.1,"cpi":77,"zpi":75.5,"composite":77.2,"viewUV":37.2557,"dwellHours":0.3325},{"id":"ch-3","g":"드라마/오락/음악","name":"tvN","no":3,"originalNo":3,"viewers":227482,"watchSeconds":82348484,"svi":91,"cpi":80.3,"zpi":58.6,"composite":76.63,"viewUV":22.7482,"dwellHours":0.10055555555555555},{"id":"ch-4","g":"라이브홈쇼핑","name":"롯데홈쇼핑","no":4,"originalNo":4,"viewers":282051,"watchSeconds":601050681,"svi":78.9,"cpi":59.9,"zpi":77.7,"composite":72.17,"viewUV":28.2051,"dwellHours":0.5919444444444445},{"id":"ch-5","g":"지상파","name":"SBS","no":5,"originalNo":5,"viewers":423700,"watchSeconds":1474476000,"svi":89.2,"cpi":81.9,"zpi":82.7,"composite":84.6,"viewUV":42.37,"dwellHours":0.9666666666666667},{"id":"ch-6","g":"라이브홈쇼핑","name":"CJ ONSTYLE","no":6,"originalNo":6,"viewers":93154,"watchSeconds":312438516,"svi":67.8,"cpi":84.4,"zpi":56.4,"composite":69.53,"viewUV":9.3154,"dwellHours":0.9316666666666666},{"id":"ch-7","g":"지상파","name":"KBS2","no":7,"originalNo":7,"viewers":485446,"watchSeconds":119419716,"svi":90.6,"cpi":88.3,"zpi":56.7,"composite":78.53,"viewUV":48.5446,"dwellHours":0.06833333333333333},{"id":"ch-8","g":"라이브홈쇼핑","name":"GS SHOP","no":8,"originalNo":8,"viewers":343665,"watchSeconds":503469225,"svi":71.1,"cpi":74.2,"zpi":92.5,"composite":79.27,"viewUV":34.3665,"dwellHours":0.40694444444444444},{"id":"ch-9","g":"지상파","name":"KBS1","no":9,"originalNo":9,"viewers":220025,"watchSeconds":735983625,"svi":87.7,"cpi":87.9,"zpi":56.7,"composite":77.43,"viewUV":22.0025,"dwellHours":0.9291666666666667},{"id":"ch-10","g":"라이브홈쇼핑","name":"현대홈쇼핑","no":10,"originalNo":10,"viewers":463533,"watchSeconds":627160149,"svi":85.3,"cpi":35.7,"zpi":28.8,"composite":49.93,"viewUV":46.3533,"dwellHours":0.37583333333333335},{"id":"ch-11","g":"지상파","name":"MBC","no":11,"originalNo":11,"viewers":239995,"watchSeconds":560388325,"svi":70.5,"cpi":80.6,"zpi":71.7,"composite":74.27,"viewUV":23.9995,"dwellHours":0.6486111111111111},{"id":"ch-12","g":"데이터홈쇼핑","name":"KT알파 쇼핑","no":12,"originalNo":12,"viewers":348170,"watchSeconds":971394300,"svi":85.2,"cpi":54,"zpi":27.7,"composite":55.63,"viewUV":34.817,"dwellHours":0.775},{"id":"ch-13","g":"지상파","name":"EBS","no":13,"originalNo":13,"viewers":386597,"watchSeconds":818425849,"svi":77.5,"cpi":87.8,"zpi":56.7,"composite":74,"viewUV":38.6597,"dwellHours":0.5880555555555556},{"id":"ch-14","g":"라이브홈쇼핑","name":"홈&쇼핑","no":14,"originalNo":14,"viewers":386129,"watchSeconds":968797661,"svi":72.9,"cpi":79.3,"zpi":90.5,"composite":80.9,"viewUV":38.6129,"dwellHours":0.6969444444444444},{"id":"ch-15","g":"종합편성","name":"JTBC","no":15,"originalNo":15,"viewers":332570,"watchSeconds":455620900,"svi":80.4,"cpi":45.4,"zpi":45.6,"composite":57.13,"viewUV":33.257,"dwellHours":0.38055555555555554},{"id":"ch-16","g":"종합편성","name":"MBN","no":16,"originalNo":16,"viewers":289219,"watchSeconds":190595321,"svi":72.1,"cpi":64.8,"zpi":88.2,"composite":75.03,"viewUV":28.9219,"dwellHours":0.18305555555555555},{"id":"ch-17","g":"데이터홈쇼핑","name":"SK 스토아","no":17,"originalNo":17,"viewers":269369,"watchSeconds":934441061,"svi":60.5,"cpi":42.3,"zpi":17.6,"composite":40.13,"viewUV":26.9369,"dwellHours":0.9636111111111111},{"id":"ch-18","g":"종합편성","name":"채널A","no":18,"originalNo":18,"viewers":195201,"watchSeconds":550662021,"svi":75.1,"cpi":45,"zpi":45.8,"composite":55.3,"viewUV":19.5201,"dwellHours":0.7836111111111111},{"id":"ch-19","g":"종합편성","name":"TV조선","no":19,"originalNo":19,"viewers":34237,"watchSeconds":86174529,"svi":92.3,"cpi":60.4,"zpi":69,"composite":73.9,"viewUV":3.4237,"dwellHours":0.6991666666666667},{"id":"ch-20","g":"데이터홈쇼핑","name":"신세계쇼핑","no":20,"originalNo":20,"viewers":51204,"watchSeconds":10445616,"svi":69.6,"cpi":86.7,"zpi":91.3,"composite":82.53,"viewUV":5.1204,"dwellHours":0.056666666666666664},{"id":"ch-21","g":"드라마/오락/음악","name":"tvN STORY","no":21,"originalNo":21,"viewers":308845,"watchSeconds":643941825,"svi":71.7,"cpi":90.7,"zpi":90.3,"composite":84.23,"viewUV":30.8845,"dwellHours":0.5791666666666667},{"id":"ch-22","g":"라이브홈쇼핑","name":"공영쇼핑","no":22,"originalNo":22,"viewers":75644,"watchSeconds":42663216,"svi":75,"cpi":33.3,"zpi":31.9,"composite":46.73,"viewUV":7.5644,"dwellHours":0.15666666666666668},{"id":"ch-23","g":"뉴스/경제","name":"연합뉴스TV","no":23,"originalNo":23,"viewers":194479,"watchSeconds":680482021,"svi":84.7,"cpi":69.8,"zpi":91.4,"composite":81.97,"viewUV":19.4479,"dwellHours":0.9719444444444445},{"id":"ch-24","g":"뉴스/경제","name":"YTN","no":24,"originalNo":24,"viewers":311114,"watchSeconds":1087032316,"svi":60,"cpi":71.3,"zpi":68.1,"composite":66.47,"viewUV":31.1114,"dwellHours":0.9705555555555555},{"id":"ch-25","g":"뉴스/경제","name":"SBS Biz","no":25,"originalNo":25,"viewers":106847,"watchSeconds":265728489,"svi":75.9,"cpi":27,"zpi":38.6,"composite":47.17,"viewUV":10.6847,"dwellHours":0.6908333333333333},{"id":"ch-26","g":"지상파","name":"OBS","no":26,"originalNo":26,"viewers":450537,"watchSeconds":449185389,"svi":63.9,"cpi":88.3,"zpi":56.7,"composite":69.63,"viewUV":45.0537,"dwellHours":0.27694444444444444},{"id":"ch-27","g":"드라마/오락/음악","name":"Mnet","no":27,"originalNo":27,"viewers":465592,"watchSeconds":536361984,"svi":71,"cpi":53.5,"zpi":32.6,"composite":52.37,"viewUV":46.5592,"dwellHours":0.32000000000000006},{"id":"ch-28","g":"데이터홈쇼핑","name":"현대홈쇼핑+샵","no":28,"originalNo":28,"viewers":417222,"watchSeconds":1269189324,"svi":85.2,"cpi":52.3,"zpi":53.1,"composite":63.53,"viewUV":41.7222,"dwellHours":0.845},{"id":"ch-29","g":"드라마/오락/음악","name":"MBC 에브리원","no":29,"originalNo":29,"viewers":203332,"watchSeconds":579902864,"svi":75.6,"cpi":25,"zpi":48,"composite":49.53,"viewUV":20.3332,"dwellHours":0.792222222222222},{"id":"ch-30","g":"데이터홈쇼핑","name":"쇼핑엔티","no":30,"originalNo":30,"viewers":231473,"watchSeconds":530767589,"svi":77.5,"cpi":43.8,"zpi":50.2,"composite":57.17,"viewUV":23.1473,"dwellHours":0.6369444444444444},{"id":"ch-31","g":"드라마/오락/음악","name":"MBC 드라마넷","no":31,"originalNo":31,"viewers":325522,"watchSeconds":534507124,"svi":76.2,"cpi":33,"zpi":24,"composite":44.4,"viewUV":32.5522,"dwellHours":0.45611111111111113},{"id":"ch-32","g":"데이터홈쇼핑","name":"LOTTE OneTV","no":32,"originalNo":32,"viewers":283582,"watchSeconds":828626604,"svi":76.4,"cpi":81.4,"zpi":91.3,"composite":83.03,"viewUV":28.3582,"dwellHours":0.8116666666666666},{"id":"ch-33","g":"영화/시리즈","name":"OCN","no":33,"originalNo":33,"viewers":151975,"watchSeconds":470362625,"svi":90.3,"cpi":68,"zpi":56.8,"composite":71.7,"viewUV":15.1975,"dwellHours":0.8597222222222223},{"id":"ch-34","g":"데이터홈쇼핑","name":"W쇼핑","no":34,"originalNo":34,"viewers":431866,"watchSeconds":235798836,"svi":87.6,"cpi":77,"zpi":66.2,"composite":76.93,"viewUV":43.1866,"dwellHours":0.15166666666666667},{"id":"ch-35","g":"드라마/오락/음악","name":"KBS drama","no":35,"originalNo":35,"viewers":218186,"watchSeconds":180221636,"svi":91,"cpi":83.3,"zpi":87.5,"composite":87.27,"viewUV":21.8186,"dwellHours":0.22944444444444445},{"id":"ch-36","g":"데이터홈쇼핑","name":"NS Shop+","no":36,"originalNo":36,"viewers":81288,"watchSeconds":208747584,"svi":88.2,"cpi":58.6,"zpi":64.9,"composite":70.57,"viewUV":8.1288,"dwellHours":0.7133333333333334},{"id":"ch-37","g":"드라마/오락/음악","name":"SBS 플러스","no":37,"originalNo":37,"viewers":82809,"watchSeconds":37181241,"svi":76.9,"cpi":23.6,"zpi":22.7,"composite":41.07,"viewUV":8.2809,"dwellHours":0.1247222222222222},{"id":"ch-38","g":"데이터홈쇼핑","name":"CJ ONSTYLE+","no":38,"originalNo":38,"viewers":317900,"watchSeconds":947342000,"svi":81,"cpi":21.8,"zpi":26.4,"composite":43.07,"viewUV":31.79,"dwellHours":0.8277777777777777},{"id":"ch-39","g":"드라마/오락/음악","name":"JTBC2","no":39,"originalNo":39,"viewers":79178,"watchSeconds":36263524,"svi":63.6,"cpi":24.8,"zpi":41.1,"composite":43.17,"viewUV":7.9178,"dwellHours":0.1272222222222222},{"id":"ch-40","g":"드라마/오락/음악","name":"tvN SHOW","no":40,"originalNo":40,"viewers":182184,"watchSeconds":496269216,"svi":60.6,"cpi":39.2,"zpi":19,"composite":39.6,"viewUV":18.2184,"dwellHours":0.7566666666666667},{"id":"ch-41","g":"드라마/오락/음악","name":"KBS joy","no":41,"originalNo":41,"viewers":196050,"watchSeconds":656767500,"svi":79.2,"cpi":92.2,"zpi":55.1,"composite":75.5,"viewUV":19.605,"dwellHours":0.9305555555555556},{"id":"ch-42","g":"드라마/오락/음악","name":"ENA DRAMA","no":42,"originalNo":42,"viewers":321370,"watchSeconds":530260500,"svi":80.8,"cpi":89.4,"zpi":80.6,"composite":83.6,"viewUV":32.137,"dwellHours":0.4583333333333333},{"id":"ch-43","g":"드라마/오락/음악","name":"SBS funE","no":43,"originalNo":43,"viewers":385828,"watchSeconds":111118464,"svi":65.6,"cpi":59.7,"zpi":73.4,"composite":66.23,"viewUV":38.5828,"dwellHours":0.08},{"id":"ch-44","g":"드라마/오락/음악","name":"채널S","no":44,"originalNo":44,"viewers":398460,"watchSeconds":1211318400,"svi":64.8,"cpi":40.4,"zpi":34,"composite":46.4,"viewUV":39.846,"dwellHours":0.8444444444444446},{"id":"ch-45","g":"드라마/오락/음악","name":"tvN DRAMA","no":45,"originalNo":45,"viewers":345145,"watchSeconds":540151925,"svi":74.1,"cpi":68.7,"zpi":73.2,"composite":72,"viewUV":34.5145,"dwellHours":0.43472222222222223},{"id":"ch-46","g":"드라마/오락/음악","name":"드라마큐브","no":46,"originalNo":46,"viewers":97251,"watchSeconds":129441081,"svi":86.5,"cpi":39.9,"zpi":22.9,"composite":49.77,"viewUV":9.7251,"dwellHours":0.36972222222222223},{"id":"ch-47","g":"드라마/오락/음악","name":"Dramax","no":47,"originalNo":47,"viewers":105111,"watchSeconds":360635841,"svi":92.5,"cpi":28.7,"zpi":22.3,"composite":47.83,"viewUV":10.5111,"dwellHours":0.9530555555555554},{"id":"ch-48","g":"영화/시리즈","name":"OCN Movies","no":48,"originalNo":48,"viewers":199200,"watchSeconds":541824000,"svi":86,"cpi":38,"zpi":45.6,"composite":56.53,"viewUV":19.92,"dwellHours":0.7555555555555554},{"id":"ch-49","g":"영화/시리즈","name":"시네마천국","no":49,"originalNo":49,"viewers":27731,"watchSeconds":92926581,"svi":67.5,"cpi":25.9,"zpi":29.8,"composite":41.07,"viewUV":2.7731,"dwellHours":0.9308333333333333},{"id":"ch-50","g":"종교/오픈","name":"더라이프","no":50,"originalNo":50,"viewers":67302,"watchSeconds":114548004,"svi":81.8,"cpi":53.5,"zpi":23.4,"composite":52.9,"viewUV":6.7302,"dwellHours":0.4727777777777778},{"id":"ch-51","g":"스포츠/레저","name":"SPOTV","no":51,"originalNo":51,"viewers":259965,"watchSeconds":853985025,"svi":90.9,"cpi":52.9,"zpi":41.1,"composite":61.63,"viewUV":25.9965,"dwellHours":0.9125},{"id":"ch-52","g":"스포츠/레저","name":"SPOTV2","no":52,"originalNo":52,"viewers":329910,"watchSeconds":385994700,"svi":67.4,"cpi":26.2,"zpi":54.9,"composite":49.5,"viewUV":32.991,"dwellHours":0.325},{"id":"ch-53","g":"스포츠/레저","name":"IB SPORTS","no":53,"originalNo":53,"viewers":61161,"watchSeconds":151740441,"svi":87.9,"cpi":51.1,"zpi":37.6,"composite":58.87,"viewUV":6.1161,"dwellHours":0.6891666666666667},{"id":"ch-54","g":"스포츠/레저","name":"tvN SPORTS","no":54,"originalNo":54,"viewers":279917,"watchSeconds":335060649,"svi":67.3,"cpi":76.9,"zpi":62.9,"composite":69.03,"viewUV":27.9917,"dwellHours":0.3325},{"id":"ch-55","g":"스포츠/레저","name":"GOLF&PBA","no":55,"originalNo":55,"viewers":486566,"watchSeconds":1141483836,"svi":78.4,"cpi":73.4,"zpi":69.6,"composite":73.8,"viewUV":48.6566,"dwellHours":0.6516666666666666},{"id":"ch-56","g":"스포츠/레저","name":"JTBC Golf","no":56,"originalNo":56,"viewers":36197,"watchSeconds":82420569,"svi":82.9,"cpi":34.4,"zpi":23.1,"composite":46.8,"viewUV":3.6197,"dwellHours":0.6325},{"id":"ch-57","g":"스포츠/레저","name":"SBS 골프","no":57,"originalNo":57,"viewers":448477,"watchSeconds":1469659129,"svi":87.9,"cpi":92.6,"zpi":85.2,"composite":88.57,"viewUV":44.8477,"dwellHours":0.9102777777777776},{"id":"ch-58","g":"스포츠/레저","name":"SBS Sports","no":58,"originalNo":58,"viewers":71057,"watchSeconds":227169229,"svi":68.1,"cpi":48,"zpi":29.5,"composite":48.53,"viewUV":7.1057,"dwellHours":0.8880555555555556},{"id":"ch-59","g":"스포츠/레저","name":"KBS N Sports","no":59,"originalNo":59,"viewers":288388,"watchSeconds":163804384,"svi":91.4,"cpi":24.6,"zpi":17.4,"composite":44.47,"viewUV":28.8388,"dwellHours":0.15777777777777777},{"id":"ch-60","g":"스포츠/레저","name":"MBC SPORTS+","no":60,"originalNo":60,"viewers":230969,"watchSeconds":311577181,"svi":83.1,"cpi":50.5,"zpi":29.3,"composite":54.3,"viewUV":23.0969,"dwellHours":0.3747222222222222},{"id":"ch-61","g":"스포츠/레저","name":"JTBC SPORTS","no":61,"originalNo":61,"viewers":207380,"watchSeconds":456236000,"svi":66.6,"cpi":86.7,"zpi":58.7,"composite":70.67,"viewUV":20.738,"dwellHours":0.6111111111111112},{"id":"ch-62","g":"스포츠/레저","name":"SBS Golf2","no":62,"originalNo":62,"viewers":65797,"watchSeconds":45860509,"svi":81.3,"cpi":37.7,"zpi":43.2,"composite":54.07,"viewUV":6.5797,"dwellHours":0.19361111111111112},{"id":"ch-63","g":"스포츠/레저","name":"SPOTV GOLF PLUS","no":63,"originalNo":63,"viewers":409310,"watchSeconds":1272954100,"svi":85.8,"cpi":88.2,"zpi":60.6,"composite":78.2,"viewUV":40.931,"dwellHours":0.8638888888888889},{"id":"ch-64","g":"공공/공익/정보","name":"KTV","no":64,"originalNo":64,"viewers":28336,"watchSeconds":45790976,"svi":92.8,"cpi":57.8,"zpi":80.3,"composite":76.97,"viewUV":2.8336,"dwellHours":0.4488888888888889},{"id":"ch-65","g":"공공/공익/정보","name":"국회방송","no":65,"originalNo":65,"viewers":222169,"watchSeconds":632959481,"svi":91.9,"cpi":44.1,"zpi":19.1,"composite":51.7,"viewUV":22.2169,"dwellHours":0.7913888888888889},{"id":"ch-66","g":"드라마/오락/음악","name":"SBS LIFE","no":66,"originalNo":66,"viewers":208267,"watchSeconds":134748749,"svi":64.1,"cpi":65.3,"zpi":82.2,"composite":70.53,"viewUV":20.8267,"dwellHours":0.17972222222222223},{"id":"ch-67","g":"드라마/오락/음악","name":"GTV","no":67,"originalNo":67,"viewers":410695,"watchSeconds":1073967425,"svi":86.7,"cpi":57.8,"zpi":80.3,"composite":74.93,"viewUV":41.0695,"dwellHours":0.7263888888888889},{"id":"ch-68","g":"드라마/오락/음악","name":"CNTV","no":68,"originalNo":68,"viewers":470210,"watchSeconds":136360900,"svi":62.6,"cpi":56.8,"zpi":53.9,"composite":57.77,"viewUV":47.021,"dwellHours":0.08055555555555556},{"id":"ch-69","g":"드라마/오락/음악","name":"티브이조선2","no":69,"originalNo":69,"viewers":352096,"watchSeconds":688699776,"svi":62,"cpi":80.2,"zpi":79.7,"composite":73.97,"viewUV":35.2096,"dwellHours":0.5433333333333333},{"id":"ch-70","g":"스포츠/레저","name":"ENA SPORTS","no":70,"originalNo":70,"viewers":220747,"watchSeconds":584317309,"svi":72.7,"cpi":72,"zpi":61,"composite":68.57,"viewUV":22.0747,"dwellHours":0.7352777777777778},{"id":"ch-71","g":"드라마/오락/음악","name":"FUN TV","no":71,"originalNo":71,"viewers":124888,"watchSeconds":388151904,"svi":79,"cpi":43,"zpi":36,"composite":52.67,"viewUV":12.4888,"dwellHours":0.8633333333333333},{"id":"ch-72","g":"드라마/오락/음악","name":"ENA STORY","no":72,"originalNo":72,"viewers":285229,"watchSeconds":664298341,"svi":61.3,"cpi":76.4,"zpi":59,"composite":65.57,"viewUV":28.5229,"dwellHours":0.6469444444444444},{"id":"ch-73","g":"영화/시리즈","name":"Asia N","no":73,"originalNo":73,"viewers":159975,"watchSeconds":472726125,"svi":81.5,"cpi":37.7,"zpi":40.5,"composite":53.23,"viewUV":15.9975,"dwellHours":0.8208333333333333},{"id":"ch-74","g":"드라마/오락/음악","name":"하이라이트TV","no":74,"originalNo":74,"viewers":238288,"watchSeconds":607157824,"svi":70.8,"cpi":47.1,"zpi":49.1,"composite":55.67,"viewUV":23.8288,"dwellHours":0.7077777777777777},{"id":"ch-75","g":"드라마/오락/음악","name":"JTBC4","no":75,"originalNo":75,"viewers":415580,"watchSeconds":1213493600,"svi":69.8,"cpi":50.4,"zpi":44.3,"composite":54.83,"viewUV":41.558,"dwellHours":0.8111111111111111},{"id":"ch-76","g":"영화/시리즈","name":"OCN Movies2","no":76,"originalNo":76,"viewers":374045,"watchSeconds":705074825,"svi":72.1,"cpi":67,"zpi":76,"composite":71.7,"viewUV":37.4045,"dwellHours":0.5236111111111111},{"id":"ch-77","g":"드라마/오락/음악","name":"Hqplus","no":77,"originalNo":77,"viewers":265646,"watchSeconds":787906036,"svi":78.4,"cpi":71.9,"zpi":68.3,"composite":72.87,"viewUV":26.5646,"dwellHours":0.8238888888888889},{"id":"ch-78","g":"드라마/오락/음악","name":"Lifetime","no":78,"originalNo":78,"viewers":404541,"watchSeconds":1278754101,"svi":85.3,"cpi":75.4,"zpi":93.9,"composite":84.87,"viewUV":40.4541,"dwellHours":0.8780555555555557},{"id":"ch-79","g":"드라마/오락/음악","name":"Edge TV","no":79,"originalNo":79,"viewers":333940,"watchSeconds":200364000,"svi":83.8,"cpi":83.6,"zpi":86.4,"composite":84.6,"viewUV":33.394,"dwellHours":0.16666666666666666},{"id":"ch-80","g":"드라마/오락/음악","name":"MBC ON","no":80,"originalNo":80,"viewers":478812,"watchSeconds":1490062944,"svi":81.8,"cpi":67.6,"zpi":72,"composite":73.8,"viewUV":47.8812,"dwellHours":0.8644444444444445},{"id":"ch-81","g":"공공/공익/정보","name":"OBS W","no":81,"originalNo":81,"viewers":74109,"watchSeconds":231887061,"svi":92.3,"cpi":53.7,"zpi":33.9,"composite":59.97,"viewUV":7.4109,"dwellHours":0.8691666666666666},{"id":"ch-82","g":"드라마/오락/음악","name":"동아TV","no":82,"originalNo":82,"viewers":413298,"watchSeconds":172758564,"svi":67,"cpi":63.3,"zpi":87.9,"composite":72.73,"viewUV":41.3298,"dwellHours":0.11611111111111111},{"id":"ch-83","g":"드라마/오락/음악","name":"KBS Story","no":83,"originalNo":83,"viewers":227057,"watchSeconds":685030969,"svi":73.5,"cpi":48.8,"zpi":20.3,"composite":47.53,"viewUV":22.7057,"dwellHours":0.8380555555555556},{"id":"ch-84","g":"드라마/오락/음악","name":"SmileTV Plus","no":84,"originalNo":84,"viewers":232063,"watchSeconds":339508169,"svi":81.1,"cpi":90.6,"zpi":69.5,"composite":80.4,"viewUV":23.2063,"dwellHours":0.4063888888888889},{"id":"ch-85","g":"드라마/오락/음악","name":"코미디TV","no":85,"originalNo":85,"viewers":477820,"watchSeconds":172015200,"svi":61,"cpi":87.5,"zpi":85.8,"composite":78.1,"viewUV":47.782,"dwellHours":0.10000000000000002},{"id":"ch-86","g":"스포츠/레저","name":"OLIFE","no":86,"originalNo":86,"viewers":173998,"watchSeconds":72731164,"svi":79.8,"cpi":43,"zpi":21.2,"composite":48,"viewUV":17.3998,"dwellHours":0.11611111111111111},{"id":"ch-87","g":"드라마/오락/음악","name":"K STAR","no":87,"originalNo":87,"viewers":141417,"watchSeconds":90082629,"svi":68.7,"cpi":39.7,"zpi":31.7,"composite":46.7,"viewUV":14.1417,"dwellHours":0.17694444444444443},{"id":"ch-88","g":"드라마/오락/음악","name":"ONCE","no":88,"originalNo":88,"viewers":403300,"watchSeconds":1435748000,"svi":63.6,"cpi":39.5,"zpi":17.8,"composite":40.3,"viewUV":40.33,"dwellHours":0.9888888888888889},{"id":"ch-89","g":"드라마/오락/음악","name":"디원","no":89,"originalNo":89,"viewers":26496,"watchSeconds":6782976,"svi":80.2,"cpi":87.6,"zpi":87.7,"composite":85.17,"viewUV":2.6496,"dwellHours":0.07111111111111111},{"id":"ch-90","g":"영화/시리즈","name":"AsiaM","no":90,"originalNo":90,"viewers":430911,"watchSeconds":711434061,"svi":79.7,"cpi":65.8,"zpi":63.2,"composite":69.57,"viewUV":43.0911,"dwellHours":0.45861111111111114},{"id":"ch-91","g":"영화/시리즈","name":"월드 클래식 무비","no":91,"originalNo":91,"viewers":312540,"watchSeconds":218778000,"svi":73.6,"cpi":58.2,"zpi":65.1,"composite":65.63,"viewUV":31.254,"dwellHours":0.19444444444444445},{"id":"ch-92","g":"드라마/오락/음악","name":"아이넷TV","no":92,"originalNo":92,"viewers":178559,"watchSeconds":164095721,"svi":60.1,"cpi":73.1,"zpi":73.8,"composite":69,"viewUV":17.8559,"dwellHours":0.2552777777777778},{"id":"ch-93","g":"드라마/오락/음악","name":"채널이엠","no":93,"originalNo":93,"viewers":476613,"watchSeconds":1683873729,"svi":79.1,"cpi":69.5,"zpi":70.4,"composite":73,"viewUV":47.6613,"dwellHours":0.9813888888888889},{"id":"ch-94","g":"드라마/오락/음악","name":"CMCTV","no":94,"originalNo":94,"viewers":186427,"watchSeconds":385344609,"svi":75.3,"cpi":77.7,"zpi":57.7,"composite":70.23,"viewUV":18.6427,"dwellHours":0.5741666666666667},{"id":"ch-95","g":"지상파","name":"EBS2","no":95,"originalNo":95,"viewers":186707,"watchSeconds":184279809,"svi":81.9,"cpi":30.7,"zpi":31.5,"composite":48.03,"viewUV":18.6707,"dwellHours":0.27416666666666667},{"id":"ch-96","g":"드라마/오락/음악","name":"엔터TV","no":96,"originalNo":96,"viewers":407270,"watchSeconds":1388790700,"svi":75.4,"cpi":40.2,"zpi":29.9,"composite":48.5,"viewUV":40.727,"dwellHours":0.9472222222222223},{"id":"ch-97","g":"공공/공익/정보","name":"다문화티브이","no":97,"originalNo":97,"viewers":19177,"watchSeconds":28324429,"svi":75.3,"cpi":34.9,"zpi":32.9,"composite":47.7,"viewUV":1.9177,"dwellHours":0.4102777777777778},{"id":"ch-98","g":"드라마/오락/음악","name":"채널A 플러스","no":98,"originalNo":98,"viewers":132509,"watchSeconds":189355361,"svi":71.9,"cpi":63.6,"zpi":85.3,"composite":73.6,"viewUV":13.2509,"dwellHours":0.39694444444444443},{"id":"ch-99","g":"드라마/오락/음악","name":"MBN플러스","no":99,"originalNo":99,"viewers":352302,"watchSeconds":1043518524,"svi":83,"cpi":50.4,"zpi":45.6,"composite":59.67,"viewUV":35.2302,"dwellHours":0.8227777777777776},{"id":"ch-100","g":"공공/공익/정보","name":"NBS","no":100,"originalNo":100,"viewers":249725,"watchSeconds":116122125,"svi":90.3,"cpi":55.7,"zpi":30,"composite":58.67,"viewUV":24.9725,"dwellHours":0.12916666666666668},{"id":"ch-101","g":"종교/오픈","name":"KFN","no":101,"originalNo":101,"viewers":490730,"watchSeconds":417120500,"svi":84,"cpi":42.6,"zpi":31.2,"composite":52.6,"viewUV":49.073,"dwellHours":0.2361111111111111},{"id":"ch-102","g":"영화/시리즈","name":"채널차이나","no":102,"originalNo":102,"viewers":19286,"watchSeconds":33287636,"svi":82.4,"cpi":57.9,"zpi":77.9,"composite":72.73,"viewUV":1.9286,"dwellHours":0.47944444444444445},{"id":"ch-103","g":"영화/시리즈","name":"엠플렉스","no":103,"originalNo":103,"viewers":355202,"watchSeconds":625865924,"svi":75.6,"cpi":87,"zpi":86.5,"composite":83.03,"viewUV":35.5202,"dwellHours":0.48944444444444446},{"id":"ch-104","g":"영화/시리즈","name":"THE MOVIE","no":104,"originalNo":104,"viewers":273703,"watchSeconds":696026729,"svi":69.1,"cpi":57.1,"zpi":85.1,"composite":70.43,"viewUV":27.3703,"dwellHours":0.7063888888888888},{"id":"ch-105","g":"영화/시리즈","name":"CINETREE","no":105,"originalNo":105,"viewers":111552,"watchSeconds":77193984,"svi":64.4,"cpi":27.8,"zpi":34.9,"composite":42.37,"viewUV":11.1552,"dwellHours":0.1922222222222222},{"id":"ch-106","g":"영화/시리즈","name":"스크린","no":106,"originalNo":106,"viewers":318490,"watchSeconds":710232700,"svi":66.8,"cpi":77.4,"zpi":65.9,"composite":70.03,"viewUV":31.849,"dwellHours":0.6194444444444445},{"id":"ch-107","g":"영화/시리즈","name":"채널나우","no":107,"originalNo":107,"viewers":433657,"watchSeconds":1455786549,"svi":70.9,"cpi":54.1,"zpi":53.2,"composite":59.4,"viewUV":43.3657,"dwellHours":0.9325000000000001},{"id":"ch-108","g":"영화/시리즈","name":"채널J","no":108,"originalNo":108,"viewers":103566,"watchSeconds":149756436,"svi":82,"cpi":23.4,"zpi":39.8,"composite":48.4,"viewUV":10.3566,"dwellHours":0.40166666666666667},{"id":"ch-109","g":"영화/시리즈","name":"에이플드라마","no":109,"originalNo":109,"viewers":108391,"watchSeconds":187624821,"svi":66.9,"cpi":73.2,"zpi":81,"composite":73.7,"viewUV":10.8391,"dwellHours":0.48083333333333333},{"id":"ch-110","g":"영화/시리즈","name":"중화TV","no":110,"originalNo":110,"viewers":138376,"watchSeconds":49261856,"svi":90.8,"cpi":22.6,"zpi":38.9,"composite":50.77,"viewUV":13.8376,"dwellHours":0.09888888888888889},{"id":"ch-111","g":"영화/시리즈","name":"CH.U","no":112,"originalNo":112,"viewers":451483,"watchSeconds":145829009,"svi":83.1,"cpi":74.3,"zpi":87,"composite":81.47,"viewUV":45.1483,"dwellHours":0.08972222222222222},{"id":"ch-112","g":"영화/시리즈","name":"NXT","no":113,"originalNo":113,"viewers":47564,"watchSeconds":90561856,"svi":72,"cpi":21.8,"zpi":37.7,"composite":43.83,"viewUV":4.7564,"dwellHours":0.5288888888888889},{"id":"ch-113","g":"영화/시리즈","name":"텔레노벨라","no":114,"originalNo":114,"viewers":218047,"watchSeconds":485590669,"svi":62.1,"cpi":47.4,"zpi":34.8,"composite":48.1,"viewUV":21.8047,"dwellHours":0.6186111111111111},{"id":"ch-114","g":"영화/시리즈","name":"채널W","no":116,"originalNo":116,"viewers":176062,"watchSeconds":84861884,"svi":71.2,"cpi":54.8,"zpi":20.9,"composite":48.97,"viewUV":17.6062,"dwellHours":0.1338888888888889},{"id":"ch-115","g":"영화/시리즈","name":"TVasiaPlus","no":117,"originalNo":117,"viewers":433334,"watchSeconds":1349402076,"svi":60.4,"cpi":41.7,"zpi":48.4,"composite":50.17,"viewUV":43.3334,"dwellHours":0.865},{"id":"ch-116","g":"영화/시리즈","name":"씨네프","no":118,"originalNo":118,"viewers":162019,"watchSeconds":524779541,"svi":91.5,"cpi":80.6,"zpi":86.3,"composite":86.13,"viewUV":16.2019,"dwellHours":0.8997222222222223},{"id":"ch-117","g":"스포츠/레저","name":"Eurosport","no":119,"originalNo":119,"viewers":198069,"watchSeconds":465264081,"svi":79.3,"cpi":63.9,"zpi":70.4,"composite":71.2,"viewUV":19.8069,"dwellHours":0.6525},{"id":"ch-118","g":"스포츠/레저","name":"FTV","no":120,"originalNo":120,"viewers":333818,"watchSeconds":159565004,"svi":85.8,"cpi":23.7,"zpi":52.4,"composite":53.97,"viewUV":33.3818,"dwellHours":0.13277777777777777},{"id":"ch-119","g":"스포츠/레저","name":"한국낚시방송","no":121,"originalNo":121,"viewers":201002,"watchSeconds":342105404,"svi":68.6,"cpi":46.3,"zpi":35.7,"composite":50.2,"viewUV":20.1002,"dwellHours":0.4727777777777778},{"id":"ch-120","g":"스포츠/레저","name":"바둑TV","no":122,"originalNo":122,"viewers":472575,"watchSeconds":309536625,"svi":70.9,"cpi":46.5,"zpi":31.5,"composite":49.63,"viewUV":47.2575,"dwellHours":0.18194444444444444},{"id":"ch-121","g":"스포츠/레저","name":"K바둑","no":123,"originalNo":123,"viewers":356525,"watchSeconds":771876625,"svi":65.9,"cpi":33.4,"zpi":37.6,"composite":45.63,"viewUV":35.6525,"dwellHours":0.6013888888888888},{"id":"ch-122","g":"스포츠/레저","name":"브레인TV","no":126,"originalNo":126,"viewers":197258,"watchSeconds":398066644,"svi":60.4,"cpi":39.9,"zpi":32.9,"composite":44.4,"viewUV":19.7258,"dwellHours":0.5605555555555556},{"id":"ch-123","g":"스포츠/레저","name":"Billiards TV","no":127,"originalNo":127,"viewers":186899,"watchSeconds":343707261,"svi":75.1,"cpi":90.3,"zpi":91.4,"composite":85.6,"viewUV":18.6899,"dwellHours":0.5108333333333333},{"id":"ch-124","g":"스포츠/레저","name":"마운틴 TV","no":128,"originalNo":128,"viewers":304754,"watchSeconds":376066436,"svi":61.6,"cpi":55.8,"zpi":51.4,"composite":56.27,"viewUV":30.4754,"dwellHours":0.3427777777777778},{"id":"ch-125","g":"스포츠/레저","name":"SOOP","no":129,"originalNo":129,"viewers":318520,"watchSeconds":694373600,"svi":87.2,"cpi":41.4,"zpi":33.1,"composite":53.9,"viewUV":31.852,"dwellHours":0.6055555555555555},{"id":"ch-126","g":"드라마/오락/음악","name":"CH.WIDE","no":130,"originalNo":130,"viewers":265789,"watchSeconds":693443501,"svi":61.1,"cpi":46.3,"zpi":53.5,"composite":53.63,"viewUV":26.5789,"dwellHours":0.7247222222222223},{"id":"ch-127","g":"스포츠/레저","name":"STN","no":131,"originalNo":131,"viewers":183549,"watchSeconds":273304461,"svi":69.9,"cpi":84.1,"zpi":70.7,"composite":74.9,"viewUV":18.3549,"dwellHours":0.4136111111111111},{"id":"ch-128","g":"스포츠/레저","name":"생활체육 TV","no":132,"originalNo":132,"viewers":32869,"watchSeconds":29220541,"svi":89.5,"cpi":74.8,"zpi":70.6,"composite":78.3,"viewUV":3.2869,"dwellHours":0.24694444444444444},{"id":"ch-129","g":"스포츠/레저","name":"스크린골프존","no":133,"originalNo":133,"viewers":58958,"watchSeconds":57660924,"svi":62.4,"cpi":59.9,"zpi":56.4,"composite":59.57,"viewUV":5.8958,"dwellHours":0.2716666666666666},{"id":"ch-130","g":"스포츠/레저","name":"StoryTV","no":134,"originalNo":134,"viewers":355190,"watchSeconds":635790100,"svi":75.8,"cpi":36,"zpi":47.2,"composite":53,"viewUV":35.519,"dwellHours":0.49722222222222223},{"id":"ch-131","g":"드라마/오락/음악","name":"SPOTV PLUS","no":135,"originalNo":135,"viewers":465538,"watchSeconds":1209467724,"svi":60,"cpi":42.6,"zpi":53.7,"composite":52.1,"viewUV":46.5538,"dwellHours":0.7216666666666667},{"id":"ch-132","g":"드라마/오락/음악","name":"THE M","no":136,"originalNo":136,"viewers":480177,"watchSeconds":987724089,"svi":66.7,"cpi":83.9,"zpi":56.7,"composite":69.1,"viewUV":48.0177,"dwellHours":0.5713888888888888},{"id":"ch-133","g":"드라마/오락/음악","name":"MBC M","no":137,"originalNo":137,"viewers":21821,"watchSeconds":31880481,"svi":66.9,"cpi":82.6,"zpi":91.2,"composite":80.23,"viewUV":2.1821,"dwellHours":0.4058333333333333},{"id":"ch-134","g":"드라마/오락/음악","name":"뉴트로TV","no":138,"originalNo":138,"viewers":121143,"watchSeconds":281415189,"svi":61.9,"cpi":86.2,"zpi":55.4,"composite":67.83,"viewUV":12.1143,"dwellHours":0.6452777777777777},{"id":"ch-135","g":"드라마/오락/음악","name":"ORFEO","no":139,"originalNo":139,"viewers":395389,"watchSeconds":936676541,"svi":86.5,"cpi":30.6,"zpi":21.8,"composite":46.3,"viewUV":39.5389,"dwellHours":0.6580555555555555},{"id":"ch-136","g":"드라마/오락/음악","name":"한경arteTV","no":140,"originalNo":140,"viewers":365493,"watchSeconds":1188948729,"svi":76.9,"cpi":45.4,"zpi":35.5,"composite":52.6,"viewUV":36.5493,"dwellHours":0.9036111111111111},{"id":"ch-137","g":"드라마/오락/음악","name":"History","no":141,"originalNo":141,"viewers":413461,"watchSeconds":1009258301,"svi":91.9,"cpi":33.4,"zpi":18.3,"composite":47.87,"viewUV":41.3461,"dwellHours":0.6780555555555555},{"id":"ch-138","g":"드라마/오락/음악","name":"GMTV","no":142,"originalNo":142,"viewers":312452,"watchSeconds":547415904,"svi":62.6,"cpi":74.2,"zpi":61.6,"composite":66.13,"viewUV":31.2452,"dwellHours":0.4866666666666667},{"id":"ch-139","g":"드라마/오락/음악","name":"가요TV","no":143,"originalNo":143,"viewers":16799,"watchSeconds":39964821,"svi":78.5,"cpi":78.4,"zpi":60.6,"composite":72.5,"viewUV":1.6799,"dwellHours":0.6608333333333334},{"id":"ch-140","g":"드라마/오락/음악","name":"실버아이TV","no":144,"originalNo":144,"viewers":55828,"watchSeconds":26127504,"svi":64,"cpi":72.5,"zpi":69.6,"composite":68.7,"viewUV":5.5828,"dwellHours":0.13},{"id":"ch-141","g":"드라마/오락/음악","name":"이벤트 TV","no":145,"originalNo":145,"viewers":66085,"watchSeconds":46589925,"svi":63.5,"cpi":79.8,"zpi":56.9,"composite":66.73,"viewUV":6.6085,"dwellHours":0.19583333333333333},{"id":"ch-142","g":"드라마/오락/음악","name":"WeLike","no":146,"originalNo":146,"viewers":198043,"watchSeconds":376875829,"svi":77.3,"cpi":66.2,"zpi":61.4,"composite":68.3,"viewUV":19.8043,"dwellHours":0.5286111111111111},{"id":"ch-143","g":"드라마/오락/음악","name":"붐TV","no":147,"originalNo":147,"viewers":284781,"watchSeconds":752106621,"svi":83.7,"cpi":37.5,"zpi":47.5,"composite":56.23,"viewUV":28.4781,"dwellHours":0.7336111111111111},{"id":"ch-144","g":"드라마/오락/음악","name":"아이넷라이프","no":148,"originalNo":148,"viewers":397005,"watchSeconds":1058018325,"svi":86.3,"cpi":53.7,"zpi":33.2,"composite":57.73,"viewUV":39.7005,"dwellHours":0.7402777777777778},{"id":"ch-145","g":"공공/공익/정보","name":"EDGE ON","no":149,"originalNo":149,"viewers":169207,"watchSeconds":238074249,"svi":78.1,"cpi":50.9,"zpi":18.7,"composite":49.23,"viewUV":16.9207,"dwellHours":0.3908333333333333},{"id":"ch-146","g":"드라마/오락/음악","name":"UXN","no":150,"originalNo":150,"viewers":435196,"watchSeconds":825131616,"svi":82.6,"cpi":85.7,"zpi":70.9,"composite":79.73,"viewUV":43.5196,"dwellHours":0.5266666666666667},{"id":"ch-147","g":"영화/시리즈","name":"Asia UHD","no":151,"originalNo":151,"viewers":116775,"watchSeconds":419806125,"svi":80.1,"cpi":92.1,"zpi":83.7,"composite":85.3,"viewUV":11.6775,"dwellHours":0.9986111111111111},{"id":"ch-148","g":"다큐/교양","name":"SkyUHD","no":152,"originalNo":152,"viewers":96579,"watchSeconds":158292981,"svi":83.1,"cpi":45.6,"zpi":27.5,"composite":52.07,"viewUV":9.6579,"dwellHours":0.4552777777777778},{"id":"ch-149","g":"드라마/오락/음악","name":"UMAX","no":153,"originalNo":153,"viewers":268509,"watchSeconds":738131241,"svi":86.3,"cpi":47.7,"zpi":18.5,"composite":50.83,"viewUV":26.8509,"dwellHours":0.7636111111111111},{"id":"ch-150","g":"드라마/오락/음악","name":"UHDDreamTV","no":154,"originalNo":154,"viewers":333745,"watchSeconds":1196475825,"svi":80.7,"cpi":31.2,"zpi":27.7,"composite":46.53,"viewUV":33.3745,"dwellHours":0.9958333333333333},{"id":"ch-151","g":"드라마/오락/음악","name":"에스비에스필UHD","no":155,"originalNo":155,"viewers":477227,"watchSeconds":1501833369,"svi":72.9,"cpi":60.4,"zpi":68.5,"composite":67.27,"viewUV":47.7227,"dwellHours":0.8741666666666665},{"id":"ch-152","g":"다큐/교양","name":"엑스원","no":156,"originalNo":156,"viewers":42672,"watchSeconds":80735424,"svi":78.8,"cpi":72.3,"zpi":71.7,"composite":74.27,"viewUV":4.2672,"dwellHours":0.5255555555555556},{"id":"ch-153","g":"공공/공익/정보","name":"MGTV","no":157,"originalNo":157,"viewers":338844,"watchSeconds":1024664256,"svi":70.6,"cpi":90.2,"zpi":70,"composite":76.93,"viewUV":33.8844,"dwellHours":0.84},{"id":"ch-154","g":"다큐/교양","name":"KBS LIFE","no":158,"originalNo":158,"viewers":357049,"watchSeconds":388826361,"svi":66.5,"cpi":81.5,"zpi":67.5,"composite":71.83,"viewUV":35.7049,"dwellHours":0.3025},{"id":"ch-155","g":"공공/공익/정보","name":"YTN2","no":159,"originalNo":159,"viewers":336371,"watchSeconds":474619481,"svi":74.9,"cpi":27.7,"zpi":49.7,"composite":50.77,"viewUV":33.6371,"dwellHours":0.3919444444444445},{"id":"ch-156","g":"공공/공익/정보","name":"OUN","no":160,"originalNo":160,"viewers":157158,"watchSeconds":43689924,"svi":77.4,"cpi":46.7,"zpi":31.7,"composite":51.93,"viewUV":15.7158,"dwellHours":0.07722222222222222},{"id":"ch-157","g":"다큐/교양","name":"Real TV","no":161,"originalNo":161,"viewers":224643,"watchSeconds":804895869,"svi":82.9,"cpi":38.7,"zpi":30.7,"composite":50.77,"viewUV":22.4643,"dwellHours":0.9952777777777777},{"id":"ch-158","g":"다큐/교양","name":"Now 제주TV","no":162,"originalNo":162,"viewers":67302,"watchSeconds":168389604,"svi":85.8,"cpi":78.7,"zpi":84,"composite":82.83,"viewUV":6.7302,"dwellHours":0.695},{"id":"ch-159","g":"다큐/교양","name":"9colors","no":163,"originalNo":163,"viewers":362120,"watchSeconds":1223965600,"svi":75.2,"cpi":49.9,"zpi":30.3,"composite":51.8,"viewUV":36.212,"dwellHours":0.9388888888888888},{"id":"ch-160","g":"다큐/교양","name":"MBCNET","no":164,"originalNo":164,"viewers":74853,"watchSeconds":131217309,"svi":65.9,"cpi":93.1,"zpi":70.8,"composite":76.6,"viewUV":7.4853,"dwellHours":0.48694444444444446},{"id":"ch-161","g":"공공/공익/정보","name":"채널i","no":165,"originalNo":165,"viewers":275558,"watchSeconds":93138604,"svi":85.4,"cpi":25.7,"zpi":40,"composite":50.37,"viewUV":27.5558,"dwellHours":0.09388888888888888},{"id":"ch-162","g":"공공/공익/정보","name":"아리랑TV","no":166,"originalNo":166,"viewers":51993,"watchSeconds":24592689,"svi":82.7,"cpi":58.9,"zpi":63.3,"composite":68.3,"viewUV":5.1993,"dwellHours":0.1313888888888889},{"id":"ch-163","g":"스포츠/레저","name":"MAXPORTS","no":167,"originalNo":167,"viewers":47569,"watchSeconds":71781621,"svi":83.5,"cpi":86.5,"zpi":84.9,"composite":84.97,"viewUV":4.7569,"dwellHours":0.4191666666666667},{"id":"ch-164","g":"종교/오픈","name":"TVCHOSUN3","no":168,"originalNo":168,"viewers":207431,"watchSeconds":251198941,"svi":91.1,"cpi":69.1,"zpi":61,"composite":73.73,"viewUV":20.7431,"dwellHours":0.33638888888888896},{"id":"ch-165","g":"공공/공익/정보","name":"쿠키건강TV","no":169,"originalNo":169,"viewers":76258,"watchSeconds":33401004,"svi":85.4,"cpi":41.4,"zpi":48.8,"composite":58.53,"viewUV":7.6258,"dwellHours":0.12166666666666667},{"id":"ch-166","g":"종교/오픈","name":"ONT","no":170,"originalNo":170,"viewers":154664,"watchSeconds":501730016,"svi":74.4,"cpi":24.3,"zpi":38,"composite":45.57,"viewUV":15.4664,"dwellHours":0.9011111111111111},{"id":"ch-167","g":"공공/공익/정보","name":"메디컬TV","no":171,"originalNo":171,"viewers":247040,"watchSeconds":429849600,"svi":71.6,"cpi":34.2,"zpi":34.1,"composite":46.63,"viewUV":24.704,"dwellHours":0.48333333333333334},{"id":"ch-168","g":"종교/오픈","name":"연합뉴스TV JOB","no":172,"originalNo":172,"viewers":409393,"watchSeconds":856859549,"svi":65.3,"cpi":35.9,"zpi":19.9,"composite":40.37,"viewUV":40.9393,"dwellHours":0.5813888888888888},{"id":"ch-169","g":"종교/오픈","name":"BALL TV","no":173,"originalNo":173,"viewers":366853,"watchSeconds":819182749,"svi":65.7,"cpi":86.2,"zpi":56.7,"composite":69.53,"viewUV":36.6853,"dwellHours":0.6202777777777778},{"id":"ch-170","g":"다큐/교양","name":"사이언스TV","no":175,"originalNo":175,"viewers":36246,"watchSeconds":61110756,"svi":88.6,"cpi":91.8,"zpi":92.4,"composite":90.93,"viewUV":3.6246,"dwellHours":0.4683333333333333},{"id":"ch-171","g":"다큐/교양","name":"채널뷰","no":176,"originalNo":176,"viewers":261671,"watchSeconds":217448601,"svi":90.9,"cpi":92.2,"zpi":72.7,"composite":85.27,"viewUV":26.1671,"dwellHours":0.23083333333333333},{"id":"ch-172","g":"애니/유아/교육","name":"대교 뉴이프Plus","no":179,"originalNo":179,"viewers":282122,"watchSeconds":796148284,"svi":73.6,"cpi":80.5,"zpi":68.1,"composite":74.07,"viewUV":28.2122,"dwellHours":0.7838888888888889},{"id":"ch-173","g":"뉴스/경제","name":"한국경제 TV","no":180,"originalNo":180,"viewers":463658,"watchSeconds":611101244,"svi":90,"cpi":76.3,"zpi":58,"composite":74.77,"viewUV":46.3658,"dwellHours":0.3661111111111111},{"id":"ch-174","g":"뉴스/경제","name":"MTN 머니투데이방송","no":181,"originalNo":181,"viewers":238022,"watchSeconds":233737604,"svi":92.8,"cpi":40,"zpi":30.8,"composite":54.53,"viewUV":23.8022,"dwellHours":0.2727777777777778},{"id":"ch-175","g":"뉴스/경제","name":"매일경제TV","no":182,"originalNo":182,"viewers":479623,"watchSeconds":1382753109,"svi":90.1,"cpi":48.9,"zpi":40.1,"composite":59.7,"viewUV":47.9623,"dwellHours":0.8008333333333333},{"id":"ch-176","g":"뉴스/경제","name":"이데일리TV","no":183,"originalNo":183,"viewers":58579,"watchSeconds":69064641,"svi":79.5,"cpi":69.6,"zpi":92.3,"composite":80.47,"viewUV":5.8579,"dwellHours":0.3275},{"id":"ch-177","g":"뉴스/경제","name":"서울경제TV SEN","no":184,"originalNo":184,"viewers":29297,"watchSeconds":104209429,"svi":87.7,"cpi":81.9,"zpi":84.8,"composite":84.8,"viewUV":2.9297,"dwellHours":0.9880555555555556},{"id":"ch-178","g":"뉴스/경제","name":"TomatoTV","no":185,"originalNo":185,"viewers":191343,"watchSeconds":272281089,"svi":67.7,"cpi":81.3,"zpi":61.5,"composite":70.17,"viewUV":19.1343,"dwellHours":0.3952777777777778},{"id":"ch-179","g":"뉴스/경제","name":"팍스경제TV","no":186,"originalNo":186,"viewers":114020,"watchSeconds":364864000,"svi":70,"cpi":90,"zpi":90.1,"composite":83.37,"viewUV":11.402,"dwellHours":0.8888888888888891},{"id":"ch-180","g":"뉴스/경제","name":"연합뉴스경제TV","no":187,"originalNo":187,"viewers":169307,"watchSeconds":458314049,"svi":84.9,"cpi":61.9,"zpi":61.2,"composite":69.33,"viewUV":16.9307,"dwellHours":0.7519444444444443},{"id":"ch-181","g":"뉴스/경제","name":"토마토리빙","no":188,"originalNo":188,"viewers":43815,"watchSeconds":48853725,"svi":68.7,"cpi":48.6,"zpi":24,"composite":47.1,"viewUV":4.3815,"dwellHours":0.30972222222222223},{"id":"ch-182","g":"스포츠/레저","name":"SPOTV PRIME","no":190,"originalNo":190,"viewers":181120,"watchSeconds":184742400,"svi":70.6,"cpi":53.7,"zpi":16.8,"composite":47.03,"viewUV":18.112,"dwellHours":0.2833333333333334},{"id":"ch-183","g":"스포츠/레저","name":"SPOTV PRIME2","no":191,"originalNo":191,"viewers":55127,"watchSeconds":96306869,"svi":92.3,"cpi":31.8,"zpi":38.6,"composite":54.23,"viewUV":5.5127,"dwellHours":0.48527777777777775},{"id":"ch-184","g":"스포츠/레저","name":"SPOTV PRIME+","no":192,"originalNo":192,"viewers":113207,"watchSeconds":91358049,"svi":61.7,"cpi":52.1,"zpi":24.7,"composite":46.17,"viewUV":11.3207,"dwellHours":0.22416666666666665},{"id":"ch-185","g":"영화/시리즈","name":"캐치온 1","no":193,"originalNo":193,"viewers":311661,"watchSeconds":636100101,"svi":79.1,"cpi":73,"zpi":65,"composite":72.37,"viewUV":31.1661,"dwellHours":0.5669444444444445},{"id":"ch-186","g":"영화/시리즈","name":"캐치온 2","no":194,"originalNo":194,"viewers":415333,"watchSeconds":1176638389,"svi":88.3,"cpi":75.4,"zpi":72.5,"composite":78.73,"viewUV":41.5333,"dwellHours":0.7869444444444446},{"id":"ch-187","g":"공공/공익/정보","name":"복지TV","no":199,"originalNo":199,"viewers":196697,"watchSeconds":82022649,"svi":78.7,"cpi":46.7,"zpi":17.3,"composite":47.57,"viewUV":19.6697,"dwellHours":0.11583333333333333},{"id":"ch-188","g":"스포츠/레저","name":"해피독티비","no":201,"originalNo":201,"viewers":84917,"watchSeconds":122025729,"svi":80.9,"cpi":79.1,"zpi":72,"composite":77.33,"viewUV":8.4917,"dwellHours":0.39916666666666667},{"id":"ch-189","g":"스포츠/레저","name":"DOGTV","no":202,"originalNo":202,"viewers":81849,"watchSeconds":256105521,"svi":77.1,"cpi":87.7,"zpi":56.3,"composite":73.7,"viewUV":8.1849,"dwellHours":0.8691666666666665},{"id":"ch-190","g":"성인","name":"VIKI","no":204,"originalNo":204,"viewers":307114,"watchSeconds":532535676,"svi":68.6,"cpi":69.5,"zpi":63.9,"composite":67.33,"viewUV":30.7114,"dwellHours":0.4816666666666667},{"id":"ch-191","g":"성인","name":"미드나잇 채널","no":205,"originalNo":205,"viewers":261593,"watchSeconds":589369029,"svi":89.7,"cpi":63.4,"zpi":75,"composite":76.03,"viewUV":26.1593,"dwellHours":0.6258333333333332},{"id":"ch-192","g":"성인","name":"플레이보이TV","no":206,"originalNo":206,"viewers":217241,"watchSeconds":608492041,"svi":79.5,"cpi":90,"zpi":87.5,"composite":85.67,"viewUV":21.7241,"dwellHours":0.7780555555555555},{"id":"ch-193","g":"성인","name":"허니TV","no":207,"originalNo":207,"viewers":243780,"watchSeconds":507062400,"svi":84.8,"cpi":33.4,"zpi":30.4,"composite":49.53,"viewUV":24.378,"dwellHours":0.5777777777777777},{"id":"ch-194","g":"성인","name":"핑크하우스","no":208,"originalNo":208,"viewers":481196,"watchSeconds":1412791456,"svi":65.6,"cpi":48,"zpi":50.3,"composite":54.63,"viewUV":48.1196,"dwellHours":0.8155555555555556},{"id":"ch-195","g":"성인","name":"DesireTV","no":209,"originalNo":209,"viewers":366620,"watchSeconds":1129189600,"svi":75.6,"cpi":25.5,"zpi":20,"composite":40.37,"viewUV":36.662,"dwellHours":0.8555555555555555},{"id":"ch-196","g":"성인","name":"비너스TV","no":210,"originalNo":210,"viewers":139442,"watchSeconds":460437484,"svi":61.6,"cpi":20.8,"zpi":54.4,"composite":45.6,"viewUV":13.9442,"dwellHours":0.9172222222222223},{"id":"ch-197","g":"공공/공익/정보","name":"법률방송","no":213,"originalNo":213,"viewers":201854,"watchSeconds":144123756,"svi":74.6,"cpi":32.1,"zpi":50.5,"composite":52.4,"viewUV":20.1854,"dwellHours":0.19833333333333333},{"id":"ch-198","g":"공공/공익/정보","name":"TBS TV","no":214,"originalNo":214,"viewers":32597,"watchSeconds":55317109,"svi":80.1,"cpi":77,"zpi":58.8,"composite":71.97,"viewUV":3.2597,"dwellHours":0.4713888888888889},{"id":"ch-199","g":"공공/공익/정보","name":"헬스메디TV","no":215,"originalNo":215,"viewers":220609,"watchSeconds":615278501,"svi":60.3,"cpi":62.6,"zpi":87.5,"composite":70.13,"viewUV":22.0609,"dwellHours":0.7747222222222222},{"id":"ch-200","g":"공공/공익/정보","name":"육아방송","no":217,"originalNo":217,"viewers":426226,"watchSeconds":326489116,"svi":63.6,"cpi":23.8,"zpi":42.9,"composite":43.43,"viewUV":42.6226,"dwellHours":0.2127777777777778},{"id":"ch-201","g":"공공/공익/정보","name":"k-net","no":221,"originalNo":221,"viewers":180057,"watchSeconds":608052489,"svi":81.5,"cpi":29.3,"zpi":40.5,"composite":50.43,"viewUV":18.0057,"dwellHours":0.9380555555555555},{"id":"ch-202","g":"공공/공익/정보","name":"시니어 TV","no":222,"originalNo":222,"viewers":455813,"watchSeconds":1282201969,"svi":83.5,"cpi":76.8,"zpi":66.4,"composite":75.57,"viewUV":45.5813,"dwellHours":0.7813888888888889},{"id":"ch-203","g":"공공/공익/정보","name":"소상공인시장tv","no":223,"originalNo":223,"viewers":412989,"watchSeconds":970111161,"svi":87.5,"cpi":23.1,"zpi":53,"composite":54.53,"viewUV":41.2989,"dwellHours":0.6524999999999999},{"id":"ch-204","g":"공공/공익/정보","name":"지방자치TV","no":224,"originalNo":224,"viewers":382990,"watchSeconds":448098300,"svi":72.6,"cpi":68.3,"zpi":88.2,"composite":76.37,"viewUV":38.299,"dwellHours":0.325},{"id":"ch-205","g":"공공/공익/정보","name":"디마티비","no":225,"originalNo":225,"viewers":431066,"watchSeconds":1140600636,"svi":92.2,"cpi":49,"zpi":43,"composite":61.4,"viewUV":43.1066,"dwellHours":0.735},{"id":"ch-206","g":"스포츠/레저","name":"폴라리스TV","no":226,"originalNo":226,"viewers":85241,"watchSeconds":76802141,"svi":69.5,"cpi":52.3,"zpi":21.4,"composite":47.73,"viewUV":8.5241,"dwellHours":0.25027777777777777},{"id":"ch-207","g":"종교/오픈","name":"가톨릭평화방송","no":231,"originalNo":231,"viewers":163027,"watchSeconds":578256769,"svi":82.1,"cpi":63.3,"zpi":81.9,"composite":75.77,"viewUV":16.3027,"dwellHours":0.9852777777777777},{"id":"ch-208","g":"종교/오픈","name":"BBS불교방송","no":232,"originalNo":232,"viewers":17617,"watchSeconds":8403309,"svi":83.9,"cpi":58.8,"zpi":82.6,"composite":75.1,"viewUV":1.7617,"dwellHours":0.1325},{"id":"ch-209","g":"종교/오픈","name":"BTN불교TV","no":233,"originalNo":233,"viewers":470391,"watchSeconds":400302741,"svi":70.3,"cpi":79,"zpi":61.6,"composite":70.3,"viewUV":47.0391,"dwellHours":0.2363888888888889},{"id":"ch-210","g":"종교/오픈","name":"GOODTV","no":234,"originalNo":234,"viewers":351009,"watchSeconds":262905741,"svi":82.9,"cpi":46.1,"zpi":21,"composite":50,"viewUV":35.1009,"dwellHours":0.20805555555555555},{"id":"ch-211","g":"종교/오픈","name":"C채널","no":235,"originalNo":235,"viewers":451368,"watchSeconds":1068839424,"svi":92,"cpi":66.7,"zpi":75.4,"composite":78.03,"viewUV":45.1368,"dwellHours":0.6577777777777778},{"id":"ch-212","g":"종교/오픈","name":"CTS 기독교TV","no":236,"originalNo":236,"viewers":232065,"watchSeconds":316768725,"svi":81.7,"cpi":83.9,"zpi":57.4,"composite":74.33,"viewUV":23.2065,"dwellHours":0.3791666666666667},{"id":"ch-213","g":"종교/오픈","name":"CGN","no":237,"originalNo":237,"viewers":459719,"watchSeconds":1231587201,"svi":75.3,"cpi":52.8,"zpi":32.4,"composite":53.5,"viewUV":45.9719,"dwellHours":0.7441666666666666},{"id":"ch-214","g":"종교/오픈","name":"CBS TV","no":238,"originalNo":238,"viewers":340286,"watchSeconds":172184716,"svi":74.6,"cpi":37.6,"zpi":43.9,"composite":52.03,"viewUV":34.0286,"dwellHours":0.14055555555555554},{"id":"ch-215","g":"종교/오픈","name":"원음방송","no":239,"originalNo":239,"viewers":190841,"watchSeconds":198665481,"svi":80.7,"cpi":31.7,"zpi":29.8,"composite":47.4,"viewUV":19.0841,"dwellHours":0.2891666666666667},{"id":"ch-216","g":"종교/오픈","name":"YCN유림방송","no":240,"originalNo":240,"viewers":41417,"watchSeconds":132410149,"svi":62.1,"cpi":30.5,"zpi":53.6,"composite":48.73,"viewUV":4.1417,"dwellHours":0.8880555555555556},{"id":"ch-217","g":"종교/오픈","name":"STB 상생방송","no":241,"originalNo":241,"viewers":175009,"watchSeconds":442597761,"svi":72.7,"cpi":72.4,"zpi":74.9,"composite":73.33,"viewUV":17.5009,"dwellHours":0.7025},{"id":"ch-218","g":"종교/오픈","name":"유교TV방송","no":242,"originalNo":242,"viewers":247107,"watchSeconds":224126049,"svi":77.3,"cpi":50.5,"zpi":25.1,"composite":50.97,"viewUV":24.7107,"dwellHours":0.25194444444444447},{"id":"ch-219","g":"종교/오픈","name":"국악방송","no":251,"originalNo":251,"viewers":272811,"watchSeconds":739590621,"svi":73.9,"cpi":60.4,"zpi":66.9,"composite":67.07,"viewUV":27.2811,"dwellHours":0.7530555555555556},{"id":"ch-220","g":"종교/오픈","name":"토마토클래식","no":253,"originalNo":253,"viewers":316676,"watchSeconds":676419936,"svi":80,"cpi":72.5,"zpi":85.3,"composite":79.27,"viewUV":31.6676,"dwellHours":0.5933333333333334},{"id":"ch-221","g":"종교/오픈","name":"WeeTV","no":254,"originalNo":254,"viewers":492619,"watchSeconds":846812061,"svi":78.3,"cpi":39.5,"zpi":27.6,"composite":48.47,"viewUV":49.2619,"dwellHours":0.4775},{"id":"ch-222","g":"종교/오픈","name":"슬로우TV","no":256,"originalNo":256,"viewers":286612,"watchSeconds":318712544,"svi":90,"cpi":75.5,"zpi":81.4,"composite":82.3,"viewUV":28.6612,"dwellHours":0.3088888888888889},{"id":"ch-223","g":"종교/오픈","name":"채널칭","no":258,"originalNo":258,"viewers":217559,"watchSeconds":752536581,"svi":81.1,"cpi":80.1,"zpi":73.1,"composite":78.1,"viewUV":21.7559,"dwellHours":0.9608333333333333},{"id":"ch-224","g":"종교/오픈","name":"채널S 플러스","no":259,"originalNo":259,"viewers":160038,"watchSeconds":409377204,"svi":77.4,"cpi":93.4,"zpi":93.4,"composite":88.07,"viewUV":16.0038,"dwellHours":0.7105555555555557},{"id":"ch-225","g":"종교/오픈","name":"ONN 닥터TV","no":262,"originalNo":262,"viewers":361405,"watchSeconds":1042653425,"svi":80.7,"cpi":58.7,"zpi":71.9,"composite":70.43,"viewUV":36.1405,"dwellHours":0.8013888888888888},{"id":"ch-226","g":"종교/오픈","name":"DealSite경제TV","no":263,"originalNo":263,"viewers":291944,"watchSeconds":655122336,"svi":63.6,"cpi":29.2,"zpi":38.5,"composite":43.77,"viewUV":29.1944,"dwellHours":0.6233333333333333},{"id":"ch-227","g":"종교/오픈","name":"디스토리","no":264,"originalNo":264,"viewers":54633,"watchSeconds":57528549,"svi":75.1,"cpi":42.5,"zpi":44.5,"composite":54.03,"viewUV":5.4633,"dwellHours":0.2925},{"id":"ch-228","g":"드라마/오락/음악","name":"E LIKE","no":265,"originalNo":265,"viewers":175140,"watchSeconds":350280000,"svi":84.4,"cpi":43.1,"zpi":47.3,"composite":58.27,"viewUV":17.514,"dwellHours":0.5555555555555556},{"id":"ch-229","g":"종교/오픈","name":"더라이프2","no":266,"originalNo":266,"viewers":439171,"watchSeconds":1427744921,"svi":77.3,"cpi":46.5,"zpi":41.6,"composite":55.13,"viewUV":43.9171,"dwellHours":0.9030555555555555},{"id":"ch-230","g":"종교/오픈","name":"RNA","no":267,"originalNo":267,"viewers":272353,"watchSeconds":439305389,"svi":80.9,"cpi":65.8,"zpi":91.2,"composite":79.3,"viewUV":27.2353,"dwellHours":0.44805555555555554},{"id":"ch-231","g":"영화/시리즈","name":"채널액션","no":268,"originalNo":268,"viewers":25910,"watchSeconds":9068500,"svi":81.4,"cpi":33.7,"zpi":32.7,"composite":49.27,"viewUV":2.591,"dwellHours":0.09722222222222221},{"id":"ch-232","g":"종교/오픈","name":"리빙TV","no":276,"originalNo":276,"viewers":466807,"watchSeconds":1272982689,"svi":92.1,"cpi":24.9,"zpi":17.7,"composite":44.9,"viewUV":46.6807,"dwellHours":0.7575},{"id":"ch-233","g":"종교/오픈","name":"사회안전방송","no":278,"originalNo":278,"viewers":195220,"watchSeconds":363109200,"svi":89.8,"cpi":54.9,"zpi":46.4,"composite":63.7,"viewUV":19.522,"dwellHours":0.5166666666666667},{"id":"ch-234","g":"영화/시리즈","name":"HITS","no":290,"originalNo":290,"viewers":63550,"watchSeconds":111212500,"svi":83.4,"cpi":91.4,"zpi":81,"composite":85.27,"viewUV":6.355,"dwellHours":0.48611111111111105},{"id":"ch-235","g":"다큐/교양","name":"Discovery Channel","no":291,"originalNo":291,"viewers":40866,"watchSeconds":98323596,"svi":67.8,"cpi":26.7,"zpi":19.8,"composite":38.1,"viewUV":4.0866,"dwellHours":0.6683333333333333},{"id":"ch-236","g":"다큐/교양","name":"BBC Earth","no":292,"originalNo":292,"viewers":238337,"watchSeconds":828697749,"svi":77.7,"cpi":61.4,"zpi":73.5,"composite":70.87,"viewUV":23.8337,"dwellHours":0.9658333333333333},{"id":"ch-237","g":"다큐/교양","name":"HGTV","no":293,"originalNo":293,"viewers":126032,"watchSeconds":445145024,"svi":77.8,"cpi":60.8,"zpi":64.6,"composite":67.73,"viewUV":12.6032,"dwellHours":0.9811111111111112},{"id":"ch-238","g":"다큐/교양","name":"Animal Planet","no":294,"originalNo":294,"viewers":115812,"watchSeconds":404415504,"svi":82,"cpi":31.3,"zpi":55,"composite":56.1,"viewUV":11.5812,"dwellHours":0.9699999999999999},{"id":"ch-239","g":"다큐/교양","name":"CCTV4","no":295,"originalNo":295,"viewers":72983,"watchSeconds":152023589,"svi":86.5,"cpi":43.2,"zpi":51.4,"composite":60.37,"viewUV":7.2983,"dwellHours":0.5786111111111111},{"id":"ch-240","g":"다큐/교양","name":"DSC Science","no":296,"originalNo":296,"viewers":262466,"watchSeconds":788972796,"svi":62.6,"cpi":68.5,"zpi":57.9,"composite":63,"viewUV":26.2466,"dwellHours":0.835},{"id":"ch-241","g":"뉴스/경제","name":"NHK WP","no":297,"originalNo":297,"viewers":286853,"watchSeconds":904447509,"svi":74.1,"cpi":37.8,"zpi":40.8,"composite":50.9,"viewUV":28.6853,"dwellHours":0.8758333333333334},{"id":"ch-242","g":"뉴스/경제","name":"ABC Australia","no":298,"originalNo":298,"viewers":85674,"watchSeconds":38895996,"svi":88,"cpi":41.6,"zpi":34.8,"composite":54.8,"viewUV":8.5674,"dwellHours":0.12611111111111112},{"id":"ch-243","g":"뉴스/경제","name":"CNN Int'l","no":299,"originalNo":299,"viewers":415734,"watchSeconds":454812996,"svi":80.8,"cpi":78.2,"zpi":72.1,"composite":77.03,"viewUV":41.5734,"dwellHours":0.3038888888888889},{"id":"ch-244","g":"뉴스/경제","name":"BBC News","no":300,"originalNo":300,"viewers":187304,"watchSeconds":322912096,"svi":91.2,"cpi":81.1,"zpi":60.6,"composite":77.63,"viewUV":18.7304,"dwellHours":0.47888888888888886},{"id":"ch-245","g":"뉴스/경제","name":"Euro News","no":301,"originalNo":301,"viewers":302441,"watchSeconds":544696241,"svi":91.7,"cpi":33.2,"zpi":32,"composite":52.3,"viewUV":30.2441,"dwellHours":0.5002777777777778},{"id":"ch-246","g":"뉴스/경제","name":"CGTN","no":302,"originalNo":302,"viewers":159524,"watchSeconds":517495856,"svi":71.2,"cpi":81.4,"zpi":76.1,"composite":76.23,"viewUV":15.9524,"dwellHours":0.9011111111111111},{"id":"ch-247","g":"뉴스/경제","name":"Fox News","no":303,"originalNo":303,"viewers":431111,"watchSeconds":754875361,"svi":90.1,"cpi":86.1,"zpi":58.5,"composite":78.23,"viewUV":43.1111,"dwellHours":0.48638888888888887},{"id":"ch-248","g":"뉴스/경제","name":"Bloomberg","no":304,"originalNo":304,"viewers":493239,"watchSeconds":334909281,"svi":61.3,"cpi":42.8,"zpi":34.6,"composite":46.23,"viewUV":49.3239,"dwellHours":0.18861111111111112},{"id":"ch-249","g":"뉴스/경제","name":"CNBC","no":305,"originalNo":305,"viewers":344081,"watchSeconds":537110441,"svi":75.3,"cpi":57.6,"zpi":71.4,"composite":68.1,"viewUV":34.4081,"dwellHours":0.4336111111111111},{"id":"ch-250","g":"뉴스/경제","name":"TV5 Monde","no":306,"originalNo":306,"viewers":229468,"watchSeconds":139516544,"svi":74.2,"cpi":69.4,"zpi":57.8,"composite":67.13,"viewUV":22.9468,"dwellHours":0.1688888888888889},{"id":"ch-251","g":"뉴스/경제","name":"DW-TV Asia+","no":307,"originalNo":307,"viewers":286776,"watchSeconds":119298816,"svi":79.8,"cpi":70.8,"zpi":68.1,"composite":72.9,"viewUV":28.6776,"dwellHours":0.11555555555555555},{"id":"ch-252","g":"오디오","name":"최신 인기가요","no":609,"originalNo":609,"viewers":209346,"watchSeconds":654415596,"svi":92.2,"cpi":92.7,"zpi":57.8,"composite":80.9,"viewUV":20.9346,"dwellHours":0.8683333333333333},{"id":"ch-253","g":"오디오","name":"Dog & Mom","no":610,"originalNo":610,"viewers":480499,"watchSeconds":1613996141,"svi":76.9,"cpi":44.7,"zpi":42.7,"composite":54.77,"viewUV":48.0499,"dwellHours":0.9330555555555555},{"id":"ch-254","g":"오디오","name":"최신발라드가요","no":611,"originalNo":611,"viewers":107997,"watchSeconds":153031749,"svi":74.3,"cpi":39.2,"zpi":48,"composite":53.83,"viewUV":10.7997,"dwellHours":0.39361111111111113},{"id":"ch-255","g":"오디오","name":"K-POP 아이돌","no":612,"originalNo":612,"viewers":88375,"watchSeconds":31373125,"svi":65.9,"cpi":64.2,"zpi":57.5,"composite":62.53,"viewUV":8.8375,"dwellHours":0.09861111111111111},{"id":"ch-256","g":"오디오","name":"최신가요 차트 HOT150","no":613,"originalNo":613,"viewers":70422,"watchSeconds":232533444,"svi":90.6,"cpi":62.3,"zpi":68.4,"composite":73.77,"viewUV":7.0422,"dwellHours":0.9172222222222223},{"id":"ch-257","g":"오디오","name":"트로트가요무대","no":614,"originalNo":614,"viewers":294328,"watchSeconds":902998304,"svi":74.6,"cpi":45.7,"zpi":29.4,"composite":49.9,"viewUV":29.4328,"dwellHours":0.8522222222222222},{"id":"ch-258","g":"오디오","name":"최신트로트히트","no":615,"originalNo":615,"viewers":88229,"watchSeconds":159606261,"svi":71.9,"cpi":30.4,"zpi":51.5,"composite":51.27,"viewUV":8.8229,"dwellHours":0.5025},{"id":"ch-259","g":"오디오","name":"듣기 편한 팝","no":616,"originalNo":616,"viewers":236874,"watchSeconds":619188636,"svi":60.6,"cpi":51.3,"zpi":28.1,"composite":46.67,"viewUV":23.6874,"dwellHours":0.7261111111111112},{"id":"ch-260","g":"오디오","name":"인기성인가요 HOT 300","no":617,"originalNo":617,"viewers":235286,"watchSeconds":617861036,"svi":90.6,"cpi":46.6,"zpi":26.2,"composite":54.47,"viewUV":23.5286,"dwellHours":0.7294444444444445},{"id":"ch-261","g":"오디오","name":"최신 히트 팝스","no":618,"originalNo":618,"viewers":472447,"watchSeconds":1411199189,"svi":67.5,"cpi":62.9,"zpi":80.2,"composite":70.2,"viewUV":47.2447,"dwellHours":0.8297222222222222},{"id":"ch-262","g":"오디오","name":"한국인의 팝송","no":619,"originalNo":619,"viewers":219702,"watchSeconds":158624844,"svi":86.2,"cpi":70,"zpi":73.1,"composite":76.43,"viewUV":21.9702,"dwellHours":0.2005555555555556},{"id":"ch-263","g":"오디오","name":"다문화음악1","no":620,"originalNo":620,"viewers":477793,"watchSeconds":120881629,"svi":79.3,"cpi":82.6,"zpi":91.5,"composite":84.47,"viewUV":47.7793,"dwellHours":0.07027777777777777},{"id":"ch-264","g":"오디오","name":"다문화음악2","no":621,"originalNo":621,"viewers":289169,"watchSeconds":904809801,"svi":88.5,"cpi":85,"zpi":60.1,"composite":77.87,"viewUV":28.9169,"dwellHours":0.8691666666666666},{"id":"ch-265","g":"오디오","name":"Black Music","no":622,"originalNo":622,"viewers":153117,"watchSeconds":177156369,"svi":60.7,"cpi":23.5,"zpi":46.6,"composite":43.6,"viewUV":15.3117,"dwellHours":0.3213888888888889},{"id":"ch-266","g":"오디오","name":"Rock Festival","no":623,"originalNo":623,"viewers":247703,"watchSeconds":75054009,"svi":71.1,"cpi":47.9,"zpi":51.1,"composite":56.7,"viewUV":24.7703,"dwellHours":0.08416666666666667},{"id":"ch-267","g":"오디오","name":"재즈 라운지","no":624,"originalNo":624,"viewers":485161,"watchSeconds":602084801,"svi":74.9,"cpi":86.3,"zpi":73.4,"composite":78.2,"viewUV":48.5161,"dwellHours":0.3447222222222222},{"id":"ch-268","g":"오디오","name":"홈클래식","no":625,"originalNo":625,"viewers":145149,"watchSeconds":474492081,"svi":77.3,"cpi":78.4,"zpi":72.8,"composite":76.17,"viewUV":14.5149,"dwellHours":0.9080555555555555},{"id":"ch-269","g":"오디오","name":"클래식 산책","no":626,"originalNo":626,"viewers":274747,"watchSeconds":381074089,"svi":90.1,"cpi":78.8,"zpi":70.9,"composite":79.93,"viewUV":27.4747,"dwellHours":0.3852777777777778},{"id":"ch-270","g":"오디오","name":"당신의 발라드","no":627,"originalNo":627,"viewers":487273,"watchSeconds":542334849,"svi":72.5,"cpi":58,"zpi":87.6,"composite":72.7,"viewUV":48.7273,"dwellHours":0.30916666666666665},{"id":"ch-271","g":"오디오","name":"2000년대 인기가요","no":628,"originalNo":628,"viewers":17237,"watchSeconds":60622529,"svi":63.9,"cpi":21.4,"zpi":40.9,"composite":42.07,"viewUV":1.7237,"dwellHours":0.9769444444444444},{"id":"ch-272","g":"오디오","name":"TV속 화제음악","no":629,"originalNo":629,"viewers":225148,"watchSeconds":636718544,"svi":70.6,"cpi":45,"zpi":25.7,"composite":47.1,"viewUV":22.5148,"dwellHours":0.7855555555555556},{"id":"ch-273","g":"오디오","name":"OST 천국","no":630,"originalNo":630,"viewers":366791,"watchSeconds":150751101,"svi":82.5,"cpi":77.9,"zpi":55.1,"composite":71.83,"viewUV":36.6791,"dwellHours":0.11416666666666667},{"id":"ch-274","g":"오디오","name":"엄마랑 EQ동요","no":631,"originalNo":631,"viewers":159087,"watchSeconds":354286749,"svi":60.9,"cpi":93.2,"zpi":83.2,"composite":79.1,"viewUV":15.9087,"dwellHours":0.6186111111111111},{"id":"ch-275","g":"오디오","name":"Rainy day","no":632,"originalNo":632,"viewers":492247,"watchSeconds":1047009369,"svi":68.5,"cpi":54.7,"zpi":17,"composite":46.73,"viewUV":49.2247,"dwellHours":0.5908333333333333},{"id":"ch-276","g":"오디오","name":"한국 발라드 명곡770","no":633,"originalNo":633,"viewers":123482,"watchSeconds":61987964,"svi":64.6,"cpi":87.5,"zpi":58,"composite":70.03,"viewUV":12.3482,"dwellHours":0.13944444444444445},{"id":"ch-277","g":"오디오","name":"최신인기댄스&힙합","no":634,"originalNo":634,"viewers":430424,"watchSeconds":1284385216,"svi":60.6,"cpi":27.2,"zpi":27.6,"composite":38.47,"viewUV":43.0424,"dwellHours":0.8288888888888889},{"id":"ch-278","g":"오디오","name":"러브발라드 명곡 550","no":635,"originalNo":635,"viewers":167485,"watchSeconds":546838525,"svi":85.1,"cpi":32.8,"zpi":31.6,"composite":49.83,"viewUV":16.7485,"dwellHours":0.9069444444444444},{"id":"ch-279","g":"오디오","name":"스무드재즈","no":636,"originalNo":636,"viewers":47692,"watchSeconds":165586624,"svi":63.6,"cpi":71.7,"zpi":87.5,"composite":74.27,"viewUV":4.7692,"dwellHours":0.9644444444444444},{"id":"ch-280","g":"오디오","name":"클럽 뮤직","no":637,"originalNo":637,"viewers":294673,"watchSeconds":658004809,"svi":63.3,"cpi":36.9,"zpi":38.6,"composite":46.27,"viewUV":29.4673,"dwellHours":0.6202777777777778},{"id":"ch-281","g":"오디오","name":"파워스테이션","no":638,"originalNo":638,"viewers":72228,"watchSeconds":116142624,"svi":87.8,"cpi":30.9,"zpi":20.8,"composite":46.5,"viewUV":7.2228,"dwellHours":0.44666666666666666},{"id":"ch-282","g":"오디오","name":"Cool & Hot","no":639,"originalNo":639,"viewers":173005,"watchSeconds":301893725,"svi":69.3,"cpi":39.7,"zpi":36,"composite":48.33,"viewUV":17.3005,"dwellHours":0.4847222222222222},{"id":"ch-283","g":"오디오","name":"행복한 육아 태교","no":846,"originalNo":846,"viewers":235316,"watchSeconds":403802256,"svi":82,"cpi":23.8,"zpi":40.6,"composite":48.8,"viewUV":23.5316,"dwellHours":0.4766666666666667},{"id":"ch-284","g":"애니/유아/교육","name":"채널 키즈랜드","no":960,"originalNo":960,"viewers":372302,"watchSeconds":1087866444,"svi":65.2,"cpi":67,"zpi":75,"composite":69.07,"viewUV":37.2302,"dwellHours":0.8116666666666665},{"id":"ch-285","g":"애니/유아/교육","name":"ZooMoo","no":961,"originalNo":961,"viewers":316430,"watchSeconds":661338700,"svi":67,"cpi":63.1,"zpi":86.8,"composite":72.3,"viewUV":31.643,"dwellHours":0.5805555555555556},{"id":"ch-286","g":"애니/유아/교육","name":"드림웍스 채널","no":962,"originalNo":962,"viewers":170899,"watchSeconds":98950521,"svi":69.1,"cpi":59.8,"zpi":63.8,"composite":64.23,"viewUV":17.0899,"dwellHours":0.16083333333333333},{"id":"ch-287","g":"애니/유아/교육","name":"키즈톡톡플러스","no":966,"originalNo":966,"viewers":407492,"watchSeconds":722075824,"svi":83.2,"cpi":90.4,"zpi":59.3,"composite":77.63,"viewUV":40.7492,"dwellHours":0.4922222222222222},{"id":"ch-288","g":"애니/유아/교육","name":"다빈치러닝","no":969,"originalNo":969,"viewers":482050,"watchSeconds":1624508500,"svi":70.8,"cpi":86.9,"zpi":73.4,"composite":77.03,"viewUV":48.205,"dwellHours":0.9361111111111111},{"id":"ch-289","g":"애니/유아/교육","name":"edu TV","no":970,"originalNo":970,"viewers":182395,"watchSeconds":104877125,"svi":72.9,"cpi":61.9,"zpi":67.9,"composite":67.57,"viewUV":18.2395,"dwellHours":0.1597222222222222},{"id":"ch-290","g":"애니/유아/교육","name":"EBS플러스2","no":971,"originalNo":971,"viewers":111946,"watchSeconds":316359396,"svi":73.8,"cpi":85.4,"zpi":72.9,"composite":77.37,"viewUV":11.1946,"dwellHours":0.785},{"id":"ch-291","g":"애니/유아/교육","name":"EBS플러스1","no":972,"originalNo":972,"viewers":300572,"watchSeconds":1013528784,"svi":64.8,"cpi":83.1,"zpi":65.3,"composite":71.07,"viewUV":30.0572,"dwellHours":0.9366666666666666},{"id":"ch-292","g":"애니/유아/교육","name":"EBS English","no":973,"originalNo":973,"viewers":227162,"watchSeconds":645594404,"svi":77.6,"cpi":93,"zpi":85.1,"composite":85.23,"viewUV":22.7162,"dwellHours":0.7894444444444444},{"id":"ch-293","g":"애니/유아/교육","name":"플레이런TV","no":974,"originalNo":974,"viewers":457513,"watchSeconds":554963269,"svi":83.3,"cpi":78.6,"zpi":62.5,"composite":74.8,"viewUV":45.7513,"dwellHours":0.33694444444444444},{"id":"ch-294","g":"애니/유아/교육","name":"JEI English TV","no":975,"originalNo":975,"viewers":462504,"watchSeconds":1509613056,"svi":87.2,"cpi":71.1,"zpi":87.7,"composite":82,"viewUV":46.2504,"dwellHours":0.9066666666666666},{"id":"ch-295","g":"애니/유아/교육","name":"뽀요TV","no":976,"originalNo":976,"viewers":365711,"watchSeconds":837843901,"svi":77.9,"cpi":36.5,"zpi":44.9,"composite":53.1,"viewUV":36.5711,"dwellHours":0.6363888888888889},{"id":"ch-296","g":"애니/유아/교육","name":"CBeebies","no":977,"originalNo":977,"viewers":15714,"watchSeconds":49561956,"svi":68,"cpi":35.1,"zpi":33.3,"composite":45.47,"viewUV":1.5714,"dwellHours":0.8761111111111113},{"id":"ch-297","g":"애니/유아/교육","name":"브라보키즈","no":980,"originalNo":980,"viewers":496260,"watchSeconds":1349827200,"svi":84.4,"cpi":33.6,"zpi":34.8,"composite":50.93,"viewUV":49.626,"dwellHours":0.7555555555555555},{"id":"ch-298","g":"애니/유아/교육","name":"EBS KIDS","no":983,"originalNo":983,"viewers":207170,"watchSeconds":441272100,"svi":76.4,"cpi":90.6,"zpi":84,"composite":83.67,"viewUV":20.717,"dwellHours":0.5916666666666667},{"id":"ch-299","g":"애니/유아/교육","name":"KBS Kids","no":984,"originalNo":984,"viewers":401689,"watchSeconds":1353290241,"svi":89.9,"cpi":67.3,"zpi":76,"composite":77.73,"viewUV":40.1689,"dwellHours":0.9358333333333333},{"id":"ch-300","g":"애니/유아/교육","name":"캐리TV","no":985,"originalNo":985,"viewers":310901,"watchSeconds":740255281,"svi":63.7,"cpi":28,"zpi":34.8,"composite":42.17,"viewUV":31.0901,"dwellHours":0.6613888888888889},{"id":"ch-301","g":"애니/유아/교육","name":"JEI재능방송","no":986,"originalNo":986,"viewers":396955,"watchSeconds":260005525,"svi":82.7,"cpi":79.5,"zpi":76.4,"composite":79.53,"viewUV":39.6955,"dwellHours":0.18194444444444444},{"id":"ch-302","g":"애니/유아/교육","name":"어린이TV","no":987,"originalNo":987,"viewers":138505,"watchSeconds":438368325,"svi":60.1,"cpi":74.2,"zpi":84.9,"composite":73.07,"viewUV":13.8505,"dwellHours":0.8791666666666667},{"id":"ch-303","g":"애니/유아/교육","name":"핑크퐁 채널","no":988,"originalNo":988,"viewers":471384,"watchSeconds":850376736,"svi":86.2,"cpi":30.9,"zpi":22.6,"composite":46.57,"viewUV":47.1384,"dwellHours":0.5011111111111111},{"id":"ch-304","g":"애니/유아/교육","name":"카투니토","no":989,"originalNo":989,"viewers":19047,"watchSeconds":64893129,"svi":62.1,"cpi":23.4,"zpi":37.8,"composite":41.1,"viewUV":1.9047,"dwellHours":0.9463888888888888},{"id":"ch-305","g":"애니/유아/교육","name":"애니플러스","no":990,"originalNo":990,"viewers":73639,"watchSeconds":103020961,"svi":92.5,"cpi":21.7,"zpi":20,"composite":44.73,"viewUV":7.3639,"dwellHours":0.38861111111111113},{"id":"ch-306","g":"애니/유아/교육","name":"카툰네트워크","no":991,"originalNo":991,"viewers":165086,"watchSeconds":591998396,"svi":84.4,"cpi":46.7,"zpi":43.5,"composite":58.2,"viewUV":16.5086,"dwellHours":0.9961111111111111},{"id":"ch-307","g":"애니/유아/교육","name":"애니박스","no":993,"originalNo":993,"viewers":360385,"watchSeconds":1191072425,"svi":68.9,"cpi":37.6,"zpi":24,"composite":43.5,"viewUV":36.0385,"dwellHours":0.9180555555555555},{"id":"ch-308","g":"애니/유아/교육","name":"애니원티비","no":994,"originalNo":994,"viewers":213747,"watchSeconds":591437949,"svi":89.9,"cpi":43.7,"zpi":28.3,"composite":53.97,"viewUV":21.3747,"dwellHours":0.7686111111111111},{"id":"ch-309","g":"애니/유아/교육","name":"애니맥스","no":995,"originalNo":995,"viewers":237363,"watchSeconds":750779169,"svi":64.1,"cpi":30.6,"zpi":23.2,"composite":39.3,"viewUV":23.7363,"dwellHours":0.8786111111111111},{"id":"ch-310","g":"애니/유아/교육","name":"Tooniverse","no":996,"originalNo":996,"viewers":474909,"watchSeconds":241728681,"svi":65.1,"cpi":27.3,"zpi":47.4,"composite":46.6,"viewUV":47.4909,"dwellHours":0.14138888888888887}],"work":[{"id":"ch-311","g":"드라마/오락/음악","name":"지니 TV 가이드","no":997,"originalNo":997,"viewers":251440,"watchSeconds":598427200,"svi":79,"cpi":54.5,"zpi":18.1,"composite":50.53,"viewUV":25.144,"dwellHours":0.6611111111111112},{"id":"ch-312","g":"드라마/오락/음악","name":"E채널","no":998,"originalNo":998,"viewers":314930,"watchSeconds":771578500,"svi":90.8,"cpi":79.9,"zpi":86.3,"composite":85.67,"viewUV":31.493,"dwellHours":0.6805555555555556},{"id":"ch-313","g":"드라마/오락/음악","name":"ENA PLAY","no":999,"originalNo":999,"viewers":249370,"watchSeconds":690754900,"svi":73.8,"cpi":57.4,"zpi":59.4,"composite":63.53,"viewUV":24.937,"dwellHours":0.7694444444444445},{"id":"ch-0","g":"데이터홈쇼핑","name":"GS MY SHOP","no":0,"originalNo":0,"viewers":278623,"watchSeconds":535792029,"svi":71.3,"cpi":85,"zpi":85.1,"composite":80.47,"viewUV":27.8623,"dwellHours":0.5341666666666667},{"id":"ch-1","g":"드라마/오락/음악","name":"ENA","no":1,"originalNo":1,"viewers":79420,"watchSeconds":76243200,"svi":68.8,"cpi":74.6,"zpi":72.2,"composite":71.87,"viewUV":7.942,"dwellHours":0.26666666666666666},{"id":"ch-2","g":"라이브홈쇼핑","name":"NS홈쇼핑","no":2,"originalNo":2,"viewers":372557,"watchSeconds":445950729,"svi":79.1,"cpi":77,"zpi":75.5,"composite":77.2,"viewUV":37.2557,"dwellHours":0.3325},{"id":"ch-3","g":"드라마/오락/음악","name":"tvN STORY","no":3,"originalNo":3,"viewers":308845,"watchSeconds":643941825,"svi":71.7,"cpi":90.7,"zpi":90.3,"composite":84.23,"viewUV":30.8845,"dwellHours":0.5791666666666667},{"id":"ch-4","g":"라이브홈쇼핑","name":"롯데홈쇼핑","no":4,"originalNo":4,"viewers":282051,"watchSeconds":601050681,"svi":78.9,"cpi":59.9,"zpi":77.7,"composite":72.17,"viewUV":28.2051,"dwellHours":0.5919444444444445},{"id":"ch-5","g":"지상파","name":"SBS","no":5,"originalNo":5,"viewers":423700,"watchSeconds":1474476000,"svi":89.2,"cpi":81.9,"zpi":82.7,"composite":84.6,"viewUV":42.37,"dwellHours":0.9666666666666667},{"id":"ch-6","g":"라이브홈쇼핑","name":"CJ ONSTYLE","no":6,"originalNo":6,"viewers":93154,"watchSeconds":312438516,"svi":67.8,"cpi":84.4,"zpi":56.4,"composite":69.53,"viewUV":9.3154,"dwellHours":0.9316666666666666},{"id":"ch-7","g":"지상파","name":"KBS2","no":7,"originalNo":7,"viewers":485446,"watchSeconds":119419716,"svi":90.6,"cpi":88.3,"zpi":56.7,"composite":78.53,"viewUV":48.5446,"dwellHours":0.06833333333333333},{"id":"ch-8","g":"라이브홈쇼핑","name":"현대홈쇼핑","no":8,"originalNo":8,"viewers":463533,"watchSeconds":627160149,"svi":85.3,"cpi":35.7,"zpi":28.8,"composite":49.93,"viewUV":46.3533,"dwellHours":0.37583333333333335},{"id":"ch-9","g":"지상파","name":"KBS1","no":9,"originalNo":9,"viewers":220025,"watchSeconds":735983625,"svi":87.7,"cpi":87.9,"zpi":56.7,"composite":77.43,"viewUV":22.0025,"dwellHours":0.9291666666666667},{"id":"ch-10","g":"라이브홈쇼핑","name":"GS SHOP","no":10,"originalNo":10,"viewers":343665,"watchSeconds":503469225,"svi":71.1,"cpi":74.2,"zpi":92.5,"composite":79.27,"viewUV":34.3665,"dwellHours":0.40694444444444444},{"id":"ch-11","g":"지상파","name":"MBC","no":11,"originalNo":11,"viewers":239995,"watchSeconds":560388325,"svi":70.5,"cpi":80.6,"zpi":71.7,"composite":74.27,"viewUV":23.9995,"dwellHours":0.6486111111111111},{"id":"ch-12","g":"데이터홈쇼핑","name":"KT알파 쇼핑","no":12,"originalNo":12,"viewers":348170,"watchSeconds":971394300,"svi":85.2,"cpi":54,"zpi":27.7,"composite":55.63,"viewUV":34.817,"dwellHours":0.775},{"id":"ch-13","g":"지상파","name":"EBS","no":13,"originalNo":13,"viewers":386597,"watchSeconds":818425849,"svi":77.5,"cpi":87.8,"zpi":56.7,"composite":74,"viewUV":38.6597,"dwellHours":0.5880555555555556},{"id":"ch-14","g":"라이브홈쇼핑","name":"홈&쇼핑","no":14,"originalNo":14,"viewers":386129,"watchSeconds":968797661,"svi":72.9,"cpi":79.3,"zpi":90.5,"composite":80.9,"viewUV":38.6129,"dwellHours":0.6969444444444444},{"id":"ch-15","g":"종합편성","name":"JTBC","no":15,"originalNo":15,"viewers":332570,"watchSeconds":455620900,"svi":80.4,"cpi":45.4,"zpi":45.6,"composite":57.13,"viewUV":33.257,"dwellHours":0.38055555555555554},{"id":"ch-16","g":"종합편성","name":"MBN","no":16,"originalNo":16,"viewers":289219,"watchSeconds":190595321,"svi":72.1,"cpi":64.8,"zpi":88.2,"composite":75.03,"viewUV":28.9219,"dwellHours":0.18305555555555555},{"id":"ch-17","g":"데이터홈쇼핑","name":"SK 스토아","no":17,"originalNo":17,"viewers":269369,"watchSeconds":934441061,"svi":60.5,"cpi":42.3,"zpi":17.6,"composite":40.13,"viewUV":26.9369,"dwellHours":0.9636111111111111},{"id":"ch-18","g":"종합편성","name":"채널A","no":18,"originalNo":18,"viewers":195201,"watchSeconds":550662021,"svi":75.1,"cpi":45,"zpi":45.8,"composite":55.3,"viewUV":19.5201,"dwellHours":0.7836111111111111},{"id":"ch-19","g":"종합편성","name":"TV조선","no":19,"originalNo":19,"viewers":34237,"watchSeconds":86174529,"svi":92.3,"cpi":60.4,"zpi":69,"composite":73.9,"viewUV":3.4237,"dwellHours":0.6991666666666667},{"id":"ch-20","g":"데이터홈쇼핑","name":"신세계쇼핑","no":20,"originalNo":20,"viewers":51204,"watchSeconds":10445616,"svi":69.6,"cpi":86.7,"zpi":91.3,"composite":82.53,"viewUV":5.1204,"dwellHours":0.056666666666666664},{"id":"ch-21","g":"드라마/오락/음악","name":"tvN STORY","no":21,"originalNo":21,"viewers":308845,"watchSeconds":643941825,"svi":71.7,"cpi":90.7,"zpi":90.3,"composite":84.23,"viewUV":30.8845,"dwellHours":0.5791666666666667},{"id":"ch-22","g":"라이브홈쇼핑","name":"공영쇼핑","no":22,"originalNo":22,"viewers":75644,"watchSeconds":42663216,"svi":75,"cpi":33.3,"zpi":31.9,"composite":46.73,"viewUV":7.5644,"dwellHours":0.15666666666666668},{"id":"ch-23","g":"뉴스/경제","name":"연합뉴스TV","no":23,"originalNo":23,"viewers":194479,"watchSeconds":680482021,"svi":84.7,"cpi":69.8,"zpi":91.4,"composite":81.97,"viewUV":19.4479,"dwellHours":0.9719444444444445},{"id":"ch-24","g":"뉴스/경제","name":"YTN","no":24,"originalNo":24,"viewers":311114,"watchSeconds":1087032316,"svi":60,"cpi":71.3,"zpi":68.1,"composite":66.47,"viewUV":31.1114,"dwellHours":0.9705555555555555},{"id":"ch-25","g":"뉴스/경제","name":"SBS Biz","no":25,"originalNo":25,"viewers":106847,"watchSeconds":265728489,"svi":75.9,"cpi":27,"zpi":38.6,"composite":47.17,"viewUV":10.6847,"dwellHours":0.6908333333333333},{"id":"ch-26","g":"지상파","name":"OBS","no":26,"originalNo":26,"viewers":450537,"watchSeconds":449185389,"svi":63.9,"cpi":88.3,"zpi":56.7,"composite":69.63,"viewUV":45.0537,"dwellHours":0.27694444444444444},{"id":"ch-27","g":"드라마/오락/음악","name":"Mnet","no":27,"originalNo":27,"viewers":465592,"watchSeconds":536361984,"svi":71,"cpi":53.5,"zpi":32.6,"composite":52.37,"viewUV":46.5592,"dwellHours":0.32000000000000006},{"id":"ch-28","g":"데이터홈쇼핑","name":"현대홈쇼핑+샵","no":28,"originalNo":28,"viewers":417222,"watchSeconds":1269189324,"svi":85.2,"cpi":52.3,"zpi":53.1,"composite":63.53,"viewUV":41.7222,"dwellHours":0.845},{"id":"ch-29","g":"드라마/오락/음악","name":"MBC 에브리원","no":29,"originalNo":29,"viewers":203332,"watchSeconds":579902864,"svi":75.6,"cpi":25,"zpi":48,"composite":49.53,"viewUV":20.3332,"dwellHours":0.792222222222222},{"id":"ch-30","g":"데이터홈쇼핑","name":"쇼핑엔티","no":30,"originalNo":30,"viewers":231473,"watchSeconds":530767589,"svi":77.5,"cpi":43.8,"zpi":50.2,"composite":57.17,"viewUV":23.1473,"dwellHours":0.6369444444444444},{"id":"ch-31","g":"드라마/오락/음악","name":"MBC 드라마넷","no":31,"originalNo":31,"viewers":325522,"watchSeconds":534507124,"svi":76.2,"cpi":33,"zpi":24,"composite":44.4,"viewUV":32.5522,"dwellHours":0.45611111111111113},{"id":"ch-32","g":"데이터홈쇼핑","name":"LOTTE OneTV","no":32,"originalNo":32,"viewers":283582,"watchSeconds":828626604,"svi":76.4,"cpi":81.4,"zpi":91.3,"composite":83.03,"viewUV":28.3582,"dwellHours":0.8116666666666666},{"id":"ch-33","g":"영화/시리즈","name":"OCN","no":33,"originalNo":33,"viewers":151975,"watchSeconds":470362625,"svi":90.3,"cpi":68,"zpi":56.8,"composite":71.7,"viewUV":15.1975,"dwellHours":0.8597222222222223},{"id":"ch-34","g":"데이터홈쇼핑","name":"W쇼핑","no":34,"originalNo":34,"viewers":431866,"watchSeconds":235798836,"svi":87.6,"cpi":77,"zpi":66.2,"composite":76.93,"viewUV":43.1866,"dwellHours":0.15166666666666667},{"id":"ch-35","g":"드라마/오락/음악","name":"KBS drama","no":35,"originalNo":35,"viewers":218186,"watchSeconds":180221636,"svi":91,"cpi":83.3,"zpi":87.5,"composite":87.27,"viewUV":21.8186,"dwellHours":0.22944444444444445},{"id":"ch-36","g":"데이터홈쇼핑","name":"NS Shop+","no":36,"originalNo":36,"viewers":81288,"watchSeconds":208747584,"svi":88.2,"cpi":58.6,"zpi":64.9,"composite":70.57,"viewUV":8.1288,"dwellHours":0.7133333333333334},{"id":"ch-37","g":"드라마/오락/음악","name":"SBS 플러스","no":37,"originalNo":37,"viewers":82809,"watchSeconds":37181241,"svi":76.9,"cpi":23.6,"zpi":22.7,"composite":41.07,"viewUV":8.2809,"dwellHours":0.1247222222222222},{"id":"ch-38","g":"데이터홈쇼핑","name":"CJ ONSTYLE+","no":38,"originalNo":38,"viewers":317900,"watchSeconds":947342000,"svi":81,"cpi":21.8,"zpi":26.4,"composite":43.07,"viewUV":31.79,"dwellHours":0.8277777777777777},{"id":"ch-39","g":"드라마/오락/음악","name":"JTBC2","no":39,"originalNo":39,"viewers":79178,"watchSeconds":36263524,"svi":63.6,"cpi":24.8,"zpi":41.1,"composite":43.17,"viewUV":7.9178,"dwellHours":0.1272222222222222},{"id":"ch-40","g":"드라마/오락/음악","name":"tvN SHOW","no":40,"originalNo":40,"viewers":182184,"watchSeconds":496269216,"svi":60.6,"cpi":39.2,"zpi":19,"composite":39.6,"viewUV":18.2184,"dwellHours":0.7566666666666667},{"id":"ch-41","g":"드라마/오락/음악","name":"KBS joy","no":41,"originalNo":41,"viewers":196050,"watchSeconds":656767500,"svi":79.2,"cpi":92.2,"zpi":55.1,"composite":75.5,"viewUV":19.605,"dwellHours":0.9305555555555556},{"id":"ch-42","g":"드라마/오락/음악","name":"ENA DRAMA","no":42,"originalNo":42,"viewers":321370,"watchSeconds":530260500,"svi":80.8,"cpi":89.4,"zpi":80.6,"composite":83.6,"viewUV":32.137,"dwellHours":0.4583333333333333},{"id":"ch-43","g":"드라마/오락/음악","name":"SBS funE","no":43,"originalNo":43,"viewers":385828,"watchSeconds":111118464,"svi":65.6,"cpi":59.7,"zpi":73.4,"composite":66.23,"viewUV":38.5828,"dwellHours":0.08},{"id":"ch-44","g":"드라마/오락/음악","name":"채널S","no":44,"originalNo":44,"viewers":398460,"watchSeconds":1211318400,"svi":64.8,"cpi":40.4,"zpi":34,"composite":46.4,"viewUV":39.846,"dwellHours":0.8444444444444446},{"id":"ch-45","g":"드라마/오락/음악","name":"tvN DRAMA","no":45,"originalNo":45,"viewers":345145,"watchSeconds":540151925,"svi":74.1,"cpi":68.7,"zpi":73.2,"composite":72,"viewUV":34.5145,"dwellHours":0.43472222222222223},{"id":"ch-46","g":"드라마/오락/음악","name":"드라마큐브","no":46,"originalNo":46,"viewers":97251,"watchSeconds":129441081,"svi":86.5,"cpi":39.9,"zpi":22.9,"composite":49.77,"viewUV":9.7251,"dwellHours":0.36972222222222223},{"id":"ch-47","g":"드라마/오락/음악","name":"Dramax","no":47,"originalNo":47,"viewers":105111,"watchSeconds":360635841,"svi":92.5,"cpi":28.7,"zpi":22.3,"composite":47.83,"viewUV":10.5111,"dwellHours":0.9530555555555554},{"id":"ch-48","g":"영화/시리즈","name":"OCN Movies","no":48,"originalNo":48,"viewers":199200,"watchSeconds":541824000,"svi":86,"cpi":38,"zpi":45.6,"composite":56.53,"viewUV":19.92,"dwellHours":0.7555555555555554},{"id":"ch-49","g":"영화/시리즈","name":"시네마천국","no":49,"originalNo":49,"viewers":27731,"watchSeconds":92926581,"svi":67.5,"cpi":25.9,"zpi":29.8,"composite":41.07,"viewUV":2.7731,"dwellHours":0.9308333333333333},{"id":"ch-50","g":"종교/오픈","name":"더라이프","no":50,"originalNo":50,"viewers":67302,"watchSeconds":114548004,"svi":81.8,"cpi":53.5,"zpi":23.4,"composite":52.9,"viewUV":6.7302,"dwellHours":0.4727777777777778},{"id":"ch-51","g":"스포츠/레저","name":"SPOTV","no":51,"originalNo":51,"viewers":259965,"watchSeconds":853985025,"svi":90.9,"cpi":52.9,"zpi":41.1,"composite":61.63,"viewUV":25.9965,"dwellHours":0.9125},{"id":"ch-52","g":"스포츠/레저","name":"SPOTV2","no":52,"originalNo":52,"viewers":329910,"watchSeconds":385994700,"svi":67.4,"cpi":26.2,"zpi":54.9,"composite":49.5,"viewUV":32.991,"dwellHours":0.325},{"id":"ch-53","g":"스포츠/레저","name":"IB SPORTS","no":53,"originalNo":53,"viewers":61161,"watchSeconds":151740441,"svi":87.9,"cpi":51.1,"zpi":37.6,"composite":58.87,"viewUV":6.1161,"dwellHours":0.6891666666666667},{"id":"ch-54","g":"스포츠/레저","name":"tvN SPORTS","no":54,"originalNo":54,"viewers":279917,"watchSeconds":335060649,"svi":67.3,"cpi":76.9,"zpi":62.9,"composite":69.03,"viewUV":27.9917,"dwellHours":0.3325},{"id":"ch-55","g":"스포츠/레저","name":"GOLF&PBA","no":55,"originalNo":55,"viewers":486566,"watchSeconds":1141483836,"svi":78.4,"cpi":73.4,"zpi":69.6,"composite":73.8,"viewUV":48.6566,"dwellHours":0.6516666666666666},{"id":"ch-56","g":"스포츠/레저","name":"JTBC Golf","no":56,"originalNo":56,"viewers":36197,"watchSeconds":82420569,"svi":82.9,"cpi":34.4,"zpi":23.1,"composite":46.8,"viewUV":3.6197,"dwellHours":0.6325},{"id":"ch-57","g":"스포츠/레저","name":"SBS 골프","no":57,"originalNo":57,"viewers":448477,"watchSeconds":1469659129,"svi":87.9,"cpi":92.6,"zpi":85.2,"composite":88.57,"viewUV":44.8477,"dwellHours":0.9102777777777776},{"id":"ch-58","g":"스포츠/레저","name":"SBS Sports","no":58,"originalNo":58,"viewers":71057,"watchSeconds":227169229,"svi":68.1,"cpi":48,"zpi":29.5,"composite":48.53,"viewUV":7.1057,"dwellHours":0.8880555555555556},{"id":"ch-59","g":"스포츠/레저","name":"KBS N Sports","no":59,"originalNo":59,"viewers":288388,"watchSeconds":163804384,"svi":91.4,"cpi":24.6,"zpi":17.4,"composite":44.47,"viewUV":28.8388,"dwellHours":0.15777777777777777},{"id":"ch-60","g":"스포츠/레저","name":"MBC SPORTS+","no":60,"originalNo":60,"viewers":230969,"watchSeconds":311577181,"svi":83.1,"cpi":50.5,"zpi":29.3,"composite":54.3,"viewUV":23.0969,"dwellHours":0.3747222222222222},{"id":"ch-61","g":"스포츠/레저","name":"JTBC SPORTS","no":61,"originalNo":61,"viewers":207380,"watchSeconds":456236000,"svi":66.6,"cpi":86.7,"zpi":58.7,"composite":70.67,"viewUV":20.738,"dwellHours":0.6111111111111112},{"id":"ch-62","g":"스포츠/레저","name":"SBS Golf2","no":62,"originalNo":62,"viewers":65797,"watchSeconds":45860509,"svi":81.3,"cpi":37.7,"zpi":43.2,"composite":54.07,"viewUV":6.5797,"dwellHours":0.19361111111111112},{"id":"ch-63","g":"스포츠/레저","name":"SPOTV GOLF PLUS","no":63,"originalNo":63,"viewers":409310,"watchSeconds":1272954100,"svi":85.8,"cpi":88.2,"zpi":60.6,"composite":78.2,"viewUV":40.931,"dwellHours":0.8638888888888889},{"id":"ch-64","g":"공공/공익/정보","name":"KTV","no":64,"originalNo":64,"viewers":28336,"watchSeconds":45790976,"svi":92.8,"cpi":57.8,"zpi":80.3,"composite":76.97,"viewUV":2.8336,"dwellHours":0.4488888888888889},{"id":"ch-65","g":"공공/공익/정보","name":"국회방송","no":65,"originalNo":65,"viewers":222169,"watchSeconds":632959481,"svi":91.9,"cpi":44.1,"zpi":19.1,"composite":51.7,"viewUV":22.2169,"dwellHours":0.7913888888888889},{"id":"ch-66","g":"드라마/오락/음악","name":"SBS LIFE","no":66,"originalNo":66,"viewers":208267,"watchSeconds":134748749,"svi":64.1,"cpi":65.3,"zpi":82.2,"composite":70.53,"viewUV":20.8267,"dwellHours":0.17972222222222223},{"id":"ch-67","g":"드라마/오락/음악","name":"GTV","no":67,"originalNo":67,"viewers":410695,"watchSeconds":1073967425,"svi":86.7,"cpi":57.8,"zpi":80.3,"composite":74.93,"viewUV":41.0695,"dwellHours":0.7263888888888889},{"id":"ch-68","g":"드라마/오락/음악","name":"CNTV","no":68,"originalNo":68,"viewers":470210,"watchSeconds":136360900,"svi":62.6,"cpi":56.8,"zpi":53.9,"composite":57.77,"viewUV":47.021,"dwellHours":0.08055555555555556},{"id":"ch-69","g":"드라마/오락/음악","name":"티브이조선2","no":69,"originalNo":69,"viewers":352096,"watchSeconds":688699776,"svi":62,"cpi":80.2,"zpi":79.7,"composite":73.97,"viewUV":35.2096,"dwellHours":0.5433333333333333},{"id":"ch-70","g":"스포츠/레저","name":"ENA SPORTS","no":70,"originalNo":70,"viewers":220747,"watchSeconds":584317309,"svi":72.7,"cpi":72,"zpi":61,"composite":68.57,"viewUV":22.0747,"dwellHours":0.7352777777777778},{"id":"ch-71","g":"드라마/오락/음악","name":"FUN TV","no":71,"originalNo":71,"viewers":124888,"watchSeconds":388151904,"svi":79,"cpi":43,"zpi":36,"composite":52.67,"viewUV":12.4888,"dwellHours":0.8633333333333333},{"id":"ch-72","g":"드라마/오락/음악","name":"ENA STORY","no":72,"originalNo":72,"viewers":285229,"watchSeconds":664298341,"svi":61.3,"cpi":76.4,"zpi":59,"composite":65.57,"viewUV":28.5229,"dwellHours":0.6469444444444444},{"id":"ch-73","g":"영화/시리즈","name":"Asia N","no":73,"originalNo":73,"viewers":159975,"watchSeconds":472726125,"svi":81.5,"cpi":37.7,"zpi":40.5,"composite":53.23,"viewUV":15.9975,"dwellHours":0.8208333333333333},{"id":"ch-74","g":"드라마/오락/음악","name":"하이라이트TV","no":74,"originalNo":74,"viewers":238288,"watchSeconds":607157824,"svi":70.8,"cpi":47.1,"zpi":49.1,"composite":55.67,"viewUV":23.8288,"dwellHours":0.7077777777777777},{"id":"ch-75","g":"드라마/오락/음악","name":"JTBC4","no":75,"originalNo":75,"viewers":415580,"watchSeconds":1213493600,"svi":69.8,"cpi":50.4,"zpi":44.3,"composite":54.83,"viewUV":41.558,"dwellHours":0.8111111111111111},{"id":"ch-76","g":"영화/시리즈","name":"OCN Movies2","no":76,"originalNo":76,"viewers":374045,"watchSeconds":705074825,"svi":72.1,"cpi":67,"zpi":76,"composite":71.7,"viewUV":37.4045,"dwellHours":0.5236111111111111},{"id":"ch-77","g":"드라마/오락/음악","name":"Hqplus","no":77,"originalNo":77,"viewers":265646,"watchSeconds":787906036,"svi":78.4,"cpi":71.9,"zpi":68.3,"composite":72.87,"viewUV":26.5646,"dwellHours":0.8238888888888889},{"id":"ch-78","g":"드라마/오락/음악","name":"Lifetime","no":78,"originalNo":78,"viewers":404541,"watchSeconds":1278754101,"svi":85.3,"cpi":75.4,"zpi":93.9,"composite":84.87,"viewUV":40.4541,"dwellHours":0.8780555555555557},{"id":"ch-79","g":"드라마/오락/음악","name":"Edge TV","no":79,"originalNo":79,"viewers":333940,"watchSeconds":200364000,"svi":83.8,"cpi":83.6,"zpi":86.4,"composite":84.6,"viewUV":33.394,"dwellHours":0.16666666666666666},{"id":"ch-80","g":"드라마/오락/음악","name":"MBC ON","no":80,"originalNo":80,"viewers":478812,"watchSeconds":1490062944,"svi":81.8,"cpi":67.6,"zpi":72,"composite":73.8,"viewUV":47.8812,"dwellHours":0.8644444444444445},{"id":"ch-81","g":"공공/공익/정보","name":"OBS W","no":81,"originalNo":81,"viewers":74109,"watchSeconds":231887061,"svi":92.3,"cpi":53.7,"zpi":33.9,"composite":59.97,"viewUV":7.4109,"dwellHours":0.8691666666666666},{"id":"ch-82","g":"드라마/오락/음악","name":"동아TV","no":82,"originalNo":82,"viewers":413298,"watchSeconds":172758564,"svi":67,"cpi":63.3,"zpi":87.9,"composite":72.73,"viewUV":41.3298,"dwellHours":0.11611111111111111},{"id":"ch-83","g":"드라마/오락/음악","name":"KBS Story","no":83,"originalNo":83,"viewers":227057,"watchSeconds":685030969,"svi":73.5,"cpi":48.8,"zpi":20.3,"composite":47.53,"viewUV":22.7057,"dwellHours":0.8380555555555556},{"id":"ch-84","g":"드라마/오락/음악","name":"SmileTV Plus","no":84,"originalNo":84,"viewers":232063,"watchSeconds":339508169,"svi":81.1,"cpi":90.6,"zpi":69.5,"composite":80.4,"viewUV":23.2063,"dwellHours":0.4063888888888889},{"id":"ch-85","g":"드라마/오락/음악","name":"코미디TV","no":85,"originalNo":85,"viewers":477820,"watchSeconds":172015200,"svi":61,"cpi":87.5,"zpi":85.8,"composite":78.1,"viewUV":47.782,"dwellHours":0.10000000000000002},{"id":"ch-86","g":"스포츠/레저","name":"OLIFE","no":86,"originalNo":86,"viewers":173998,"watchSeconds":72731164,"svi":79.8,"cpi":43,"zpi":21.2,"composite":48,"viewUV":17.3998,"dwellHours":0.11611111111111111},{"id":"ch-87","g":"드라마/오락/음악","name":"K STAR","no":87,"originalNo":87,"viewers":141417,"watchSeconds":90082629,"svi":68.7,"cpi":39.7,"zpi":31.7,"composite":46.7,"viewUV":14.1417,"dwellHours":0.17694444444444443},{"id":"ch-88","g":"드라마/오락/음악","name":"ONCE","no":88,"originalNo":88,"viewers":403300,"watchSeconds":1435748000,"svi":63.6,"cpi":39.5,"zpi":17.8,"composite":40.3,"viewUV":40.33,"dwellHours":0.9888888888888889},{"id":"ch-89","g":"드라마/오락/음악","name":"디원","no":89,"originalNo":89,"viewers":26496,"watchSeconds":6782976,"svi":80.2,"cpi":87.6,"zpi":87.7,"composite":85.17,"viewUV":2.6496,"dwellHours":0.07111111111111111},{"id":"ch-90","g":"영화/시리즈","name":"AsiaM","no":90,"originalNo":90,"viewers":430911,"watchSeconds":711434061,"svi":79.7,"cpi":65.8,"zpi":63.2,"composite":69.57,"viewUV":43.0911,"dwellHours":0.45861111111111114},{"id":"ch-91","g":"영화/시리즈","name":"월드 클래식 무비","no":91,"originalNo":91,"viewers":312540,"watchSeconds":218778000,"svi":73.6,"cpi":58.2,"zpi":65.1,"composite":65.63,"viewUV":31.254,"dwellHours":0.19444444444444445},{"id":"ch-92","g":"드라마/오락/음악","name":"아이넷TV","no":92,"originalNo":92,"viewers":178559,"watchSeconds":164095721,"svi":60.1,"cpi":73.1,"zpi":73.8,"composite":69,"viewUV":17.8559,"dwellHours":0.2552777777777778},{"id":"ch-93","g":"드라마/오락/음악","name":"채널이엠","no":93,"originalNo":93,"viewers":476613,"watchSeconds":1683873729,"svi":79.1,"cpi":69.5,"zpi":70.4,"composite":73,"viewUV":47.6613,"dwellHours":0.9813888888888889},{"id":"ch-94","g":"드라마/오락/음악","name":"CMCTV","no":94,"originalNo":94,"viewers":186427,"watchSeconds":385344609,"svi":75.3,"cpi":77.7,"zpi":57.7,"composite":70.23,"viewUV":18.6427,"dwellHours":0.5741666666666667},{"id":"ch-95","g":"지상파","name":"EBS2","no":95,"originalNo":95,"viewers":186707,"watchSeconds":184279809,"svi":81.9,"cpi":30.7,"zpi":31.5,"composite":48.03,"viewUV":18.6707,"dwellHours":0.27416666666666667},{"id":"ch-96","g":"드라마/오락/음악","name":"엔터TV","no":96,"originalNo":96,"viewers":407270,"watchSeconds":1388790700,"svi":75.4,"cpi":40.2,"zpi":29.9,"composite":48.5,"viewUV":40.727,"dwellHours":0.9472222222222223},{"id":"ch-97","g":"공공/공익/정보","name":"다문화티브이","no":97,"originalNo":97,"viewers":19177,"watchSeconds":28324429,"svi":75.3,"cpi":34.9,"zpi":32.9,"composite":47.7,"viewUV":1.9177,"dwellHours":0.4102777777777778},{"id":"ch-98","g":"드라마/오락/음악","name":"채널A 플러스","no":98,"originalNo":98,"viewers":132509,"watchSeconds":189355361,"svi":71.9,"cpi":63.6,"zpi":85.3,"composite":73.6,"viewUV":13.2509,"dwellHours":0.39694444444444443},{"id":"ch-99","g":"드라마/오락/음악","name":"MBN플러스","no":99,"originalNo":99,"viewers":352302,"watchSeconds":1043518524,"svi":83,"cpi":50.4,"zpi":45.6,"composite":59.67,"viewUV":35.2302,"dwellHours":0.8227777777777776},{"id":"ch-100","g":"공공/공익/정보","name":"NBS","no":100,"originalNo":100,"viewers":249725,"watchSeconds":116122125,"svi":90.3,"cpi":55.7,"zpi":30,"composite":58.67,"viewUV":24.9725,"dwellHours":0.12916666666666668},{"id":"ch-101","g":"종교/오픈","name":"KFN","no":101,"originalNo":101,"viewers":490730,"watchSeconds":417120500,"svi":84,"cpi":42.6,"zpi":31.2,"composite":52.6,"viewUV":49.073,"dwellHours":0.2361111111111111},{"id":"ch-102","g":"영화/시리즈","name":"채널차이나","no":102,"originalNo":102,"viewers":19286,"watchSeconds":33287636,"svi":82.4,"cpi":57.9,"zpi":77.9,"composite":72.73,"viewUV":1.9286,"dwellHours":0.47944444444444445},{"id":"ch-103","g":"영화/시리즈","name":"엠플렉스","no":103,"originalNo":103,"viewers":355202,"watchSeconds":625865924,"svi":75.6,"cpi":87,"zpi":86.5,"composite":83.03,"viewUV":35.5202,"dwellHours":0.48944444444444446},{"id":"ch-104","g":"영화/시리즈","name":"THE MOVIE","no":104,"originalNo":104,"viewers":273703,"watchSeconds":696026729,"svi":69.1,"cpi":57.1,"zpi":85.1,"composite":70.43,"viewUV":27.3703,"dwellHours":0.7063888888888888},{"id":"ch-105","g":"영화/시리즈","name":"CINETREE","no":105,"originalNo":105,"viewers":111552,"watchSeconds":77193984,"svi":64.4,"cpi":27.8,"zpi":34.9,"composite":42.37,"viewUV":11.1552,"dwellHours":0.1922222222222222},{"id":"ch-106","g":"영화/시리즈","name":"스크린","no":106,"originalNo":106,"viewers":318490,"watchSeconds":710232700,"svi":66.8,"cpi":77.4,"zpi":65.9,"composite":70.03,"viewUV":31.849,"dwellHours":0.6194444444444445},{"id":"ch-107","g":"영화/시리즈","name":"채널나우","no":107,"originalNo":107,"viewers":433657,"watchSeconds":1455786549,"svi":70.9,"cpi":54.1,"zpi":53.2,"composite":59.4,"viewUV":43.3657,"dwellHours":0.9325000000000001},{"id":"ch-108","g":"영화/시리즈","name":"채널J","no":108,"originalNo":108,"viewers":103566,"watchSeconds":149756436,"svi":82,"cpi":23.4,"zpi":39.8,"composite":48.4,"viewUV":10.3566,"dwellHours":0.40166666666666667},{"id":"ch-109","g":"영화/시리즈","name":"에이플드라마","no":109,"originalNo":109,"viewers":108391,"watchSeconds":187624821,"svi":66.9,"cpi":73.2,"zpi":81,"composite":73.7,"viewUV":10.8391,"dwellHours":0.48083333333333333},{"id":"ch-110","g":"영화/시리즈","name":"중화TV","no":110,"originalNo":110,"viewers":138376,"watchSeconds":49261856,"svi":90.8,"cpi":22.6,"zpi":38.9,"composite":50.77,"viewUV":13.8376,"dwellHours":0.09888888888888889},{"id":"sample-mixed-new","g":"영화/시리즈","name":"시네마플러스","no":111,"originalNo":null,"svi":83.1,"cpi":64.6,"zpi":51.1,"composite":66.27,"viewers":136778,"watchSeconds":423326363,"viewUV":13.67775,"dwellHours":0.8597222232376589},{"id":"ch-111","g":"영화/시리즈","name":"CH.U","no":112,"originalNo":112,"viewers":451483,"watchSeconds":145829009,"svi":83.1,"cpi":74.3,"zpi":87,"composite":81.47,"viewUV":45.1483,"dwellHours":0.08972222222222222},{"id":"ch-112","g":"영화/시리즈","name":"NXT","no":113,"originalNo":113,"viewers":47564,"watchSeconds":90561856,"svi":72,"cpi":21.8,"zpi":37.7,"composite":43.83,"viewUV":4.7564,"dwellHours":0.5288888888888889},{"id":"ch-113","g":"영화/시리즈","name":"텔레노벨라","no":114,"originalNo":114,"viewers":218047,"watchSeconds":485590669,"svi":62.1,"cpi":47.4,"zpi":34.8,"composite":48.1,"viewUV":21.8047,"dwellHours":0.6186111111111111},{"id":"ch-114","g":"영화/시리즈","name":"채널W","no":116,"originalNo":116,"viewers":176062,"watchSeconds":84861884,"svi":71.2,"cpi":54.8,"zpi":20.9,"composite":48.97,"viewUV":17.6062,"dwellHours":0.1338888888888889},{"id":"ch-115","g":"영화/시리즈","name":"TVasiaPlus","no":117,"originalNo":117,"viewers":433334,"watchSeconds":1349402076,"svi":60.4,"cpi":41.7,"zpi":48.4,"composite":50.17,"viewUV":43.3334,"dwellHours":0.865},{"id":"ch-116","g":"영화/시리즈","name":"씨네프","no":118,"originalNo":118,"viewers":162019,"watchSeconds":524779541,"svi":91.5,"cpi":80.6,"zpi":86.3,"composite":86.13,"viewUV":16.2019,"dwellHours":0.8997222222222223},{"id":"ch-117","g":"스포츠/레저","name":"Eurosport","no":119,"originalNo":119,"viewers":198069,"watchSeconds":465264081,"svi":79.3,"cpi":63.9,"zpi":70.4,"composite":71.2,"viewUV":19.8069,"dwellHours":0.6525},{"id":"ch-118","g":"스포츠/레저","name":"FTV","no":120,"originalNo":120,"viewers":333818,"watchSeconds":159565004,"svi":85.8,"cpi":23.7,"zpi":52.4,"composite":53.97,"viewUV":33.3818,"dwellHours":0.13277777777777777},{"id":"ch-119","g":"스포츠/레저","name":"한국낚시방송","no":121,"originalNo":121,"viewers":201002,"watchSeconds":342105404,"svi":68.6,"cpi":46.3,"zpi":35.7,"composite":50.2,"viewUV":20.1002,"dwellHours":0.4727777777777778},{"id":"ch-120","g":"스포츠/레저","name":"바둑TV","no":122,"originalNo":122,"viewers":472575,"watchSeconds":309536625,"svi":70.9,"cpi":46.5,"zpi":31.5,"composite":49.63,"viewUV":47.2575,"dwellHours":0.18194444444444444},{"id":"ch-121","g":"스포츠/레저","name":"K바둑","no":123,"originalNo":123,"viewers":356525,"watchSeconds":771876625,"svi":65.9,"cpi":33.4,"zpi":37.6,"composite":45.63,"viewUV":35.6525,"dwellHours":0.6013888888888888},{"id":"ch-122","g":"스포츠/레저","name":"브레인TV","no":126,"originalNo":126,"viewers":197258,"watchSeconds":398066644,"svi":60.4,"cpi":39.9,"zpi":32.9,"composite":44.4,"viewUV":19.7258,"dwellHours":0.5605555555555556},{"id":"ch-123","g":"스포츠/레저","name":"Billiards TV","no":127,"originalNo":127,"viewers":186899,"watchSeconds":343707261,"svi":75.1,"cpi":90.3,"zpi":91.4,"composite":85.6,"viewUV":18.6899,"dwellHours":0.5108333333333333},{"id":"ch-124","g":"스포츠/레저","name":"마운틴 TV","no":128,"originalNo":128,"viewers":304754,"watchSeconds":376066436,"svi":61.6,"cpi":55.8,"zpi":51.4,"composite":56.27,"viewUV":30.4754,"dwellHours":0.3427777777777778},{"id":"ch-125","g":"스포츠/레저","name":"SOOP","no":129,"originalNo":129,"viewers":318520,"watchSeconds":694373600,"svi":87.2,"cpi":41.4,"zpi":33.1,"composite":53.9,"viewUV":31.852,"dwellHours":0.6055555555555555},{"id":"ch-126","g":"드라마/오락/음악","name":"CH.WIDE","no":130,"originalNo":130,"viewers":265789,"watchSeconds":693443501,"svi":61.1,"cpi":46.3,"zpi":53.5,"composite":53.63,"viewUV":26.5789,"dwellHours":0.7247222222222223},{"id":"ch-127","g":"스포츠/레저","name":"STN","no":131,"originalNo":131,"viewers":183549,"watchSeconds":273304461,"svi":69.9,"cpi":84.1,"zpi":70.7,"composite":74.9,"viewUV":18.3549,"dwellHours":0.4136111111111111},{"id":"ch-128","g":"스포츠/레저","name":"생활체육 TV","no":132,"originalNo":132,"viewers":32869,"watchSeconds":29220541,"svi":89.5,"cpi":74.8,"zpi":70.6,"composite":78.3,"viewUV":3.2869,"dwellHours":0.24694444444444444},{"id":"ch-129","g":"스포츠/레저","name":"스크린골프존","no":133,"originalNo":133,"viewers":58958,"watchSeconds":57660924,"svi":62.4,"cpi":59.9,"zpi":56.4,"composite":59.57,"viewUV":5.8958,"dwellHours":0.2716666666666666},{"id":"ch-130","g":"스포츠/레저","name":"StoryTV","no":134,"originalNo":134,"viewers":355190,"watchSeconds":635790100,"svi":75.8,"cpi":36,"zpi":47.2,"composite":53,"viewUV":35.519,"dwellHours":0.49722222222222223},{"id":"ch-131","g":"드라마/오락/음악","name":"SPOTV PLUS","no":135,"originalNo":135,"viewers":465538,"watchSeconds":1209467724,"svi":60,"cpi":42.6,"zpi":53.7,"composite":52.1,"viewUV":46.5538,"dwellHours":0.7216666666666667},{"id":"ch-132","g":"드라마/오락/음악","name":"THE M","no":136,"originalNo":136,"viewers":480177,"watchSeconds":987724089,"svi":66.7,"cpi":83.9,"zpi":56.7,"composite":69.1,"viewUV":48.0177,"dwellHours":0.5713888888888888},{"id":"ch-133","g":"드라마/오락/음악","name":"MBC M","no":137,"originalNo":137,"viewers":21821,"watchSeconds":31880481,"svi":66.9,"cpi":82.6,"zpi":91.2,"composite":80.23,"viewUV":2.1821,"dwellHours":0.4058333333333333},{"id":"ch-134","g":"드라마/오락/음악","name":"뉴트로TV","no":138,"originalNo":138,"viewers":121143,"watchSeconds":281415189,"svi":61.9,"cpi":86.2,"zpi":55.4,"composite":67.83,"viewUV":12.1143,"dwellHours":0.6452777777777777},{"id":"ch-135","g":"드라마/오락/음악","name":"ORFEO","no":139,"originalNo":139,"viewers":395389,"watchSeconds":936676541,"svi":86.5,"cpi":30.6,"zpi":21.8,"composite":46.3,"viewUV":39.5389,"dwellHours":0.6580555555555555},{"id":"ch-136","g":"드라마/오락/음악","name":"한경arteTV","no":140,"originalNo":140,"viewers":365493,"watchSeconds":1188948729,"svi":76.9,"cpi":45.4,"zpi":35.5,"composite":52.6,"viewUV":36.5493,"dwellHours":0.9036111111111111},{"id":"ch-137","g":"드라마/오락/음악","name":"History","no":141,"originalNo":141,"viewers":413461,"watchSeconds":1009258301,"svi":91.9,"cpi":33.4,"zpi":18.3,"composite":47.87,"viewUV":41.3461,"dwellHours":0.6780555555555555},{"id":"ch-138","g":"드라마/오락/음악","name":"GMTV","no":142,"originalNo":142,"viewers":312452,"watchSeconds":547415904,"svi":62.6,"cpi":74.2,"zpi":61.6,"composite":66.13,"viewUV":31.2452,"dwellHours":0.4866666666666667},{"id":"ch-139","g":"드라마/오락/음악","name":"가요TV","no":143,"originalNo":143,"viewers":16799,"watchSeconds":39964821,"svi":78.5,"cpi":78.4,"zpi":60.6,"composite":72.5,"viewUV":1.6799,"dwellHours":0.6608333333333334},{"id":"ch-140","g":"드라마/오락/음악","name":"실버아이TV","no":144,"originalNo":144,"viewers":55828,"watchSeconds":26127504,"svi":64,"cpi":72.5,"zpi":69.6,"composite":68.7,"viewUV":5.5828,"dwellHours":0.13},{"id":"ch-141","g":"드라마/오락/음악","name":"이벤트 TV","no":145,"originalNo":145,"viewers":66085,"watchSeconds":46589925,"svi":63.5,"cpi":79.8,"zpi":56.9,"composite":66.73,"viewUV":6.6085,"dwellHours":0.19583333333333333},{"id":"ch-142","g":"드라마/오락/음악","name":"WeLike","no":146,"originalNo":146,"viewers":198043,"watchSeconds":376875829,"svi":77.3,"cpi":66.2,"zpi":61.4,"composite":68.3,"viewUV":19.8043,"dwellHours":0.5286111111111111},{"id":"ch-143","g":"드라마/오락/음악","name":"붐TV","no":147,"originalNo":147,"viewers":284781,"watchSeconds":752106621,"svi":83.7,"cpi":37.5,"zpi":47.5,"composite":56.23,"viewUV":28.4781,"dwellHours":0.7336111111111111},{"id":"ch-144","g":"드라마/오락/음악","name":"아이넷라이프","no":148,"originalNo":148,"viewers":397005,"watchSeconds":1058018325,"svi":86.3,"cpi":53.7,"zpi":33.2,"composite":57.73,"viewUV":39.7005,"dwellHours":0.7402777777777778},{"id":"ch-145","g":"공공/공익/정보","name":"EDGE ON","no":149,"originalNo":149,"viewers":169207,"watchSeconds":238074249,"svi":78.1,"cpi":50.9,"zpi":18.7,"composite":49.23,"viewUV":16.9207,"dwellHours":0.3908333333333333},{"id":"ch-146","g":"드라마/오락/음악","name":"UXN","no":150,"originalNo":150,"viewers":435196,"watchSeconds":825131616,"svi":82.6,"cpi":85.7,"zpi":70.9,"composite":79.73,"viewUV":43.5196,"dwellHours":0.5266666666666667},{"id":"ch-147","g":"영화/시리즈","name":"Asia UHD","no":151,"originalNo":151,"viewers":116775,"watchSeconds":419806125,"svi":80.1,"cpi":92.1,"zpi":83.7,"composite":85.3,"viewUV":11.6775,"dwellHours":0.9986111111111111},{"id":"ch-148","g":"다큐/교양","name":"SkyUHD","no":152,"originalNo":152,"viewers":96579,"watchSeconds":158292981,"svi":83.1,"cpi":45.6,"zpi":27.5,"composite":52.07,"viewUV":9.6579,"dwellHours":0.4552777777777778},{"id":"ch-149","g":"드라마/오락/음악","name":"UMAX","no":153,"originalNo":153,"viewers":268509,"watchSeconds":738131241,"svi":86.3,"cpi":47.7,"zpi":18.5,"composite":50.83,"viewUV":26.8509,"dwellHours":0.7636111111111111},{"id":"ch-150","g":"드라마/오락/음악","name":"UHDDreamTV","no":154,"originalNo":154,"viewers":333745,"watchSeconds":1196475825,"svi":80.7,"cpi":31.2,"zpi":27.7,"composite":46.53,"viewUV":33.3745,"dwellHours":0.9958333333333333},{"id":"ch-151","g":"드라마/오락/음악","name":"에스비에스필UHD","no":155,"originalNo":155,"viewers":477227,"watchSeconds":1501833369,"svi":72.9,"cpi":60.4,"zpi":68.5,"composite":67.27,"viewUV":47.7227,"dwellHours":0.8741666666666665},{"id":"ch-152","g":"다큐/교양","name":"엑스원","no":156,"originalNo":156,"viewers":42672,"watchSeconds":80735424,"svi":78.8,"cpi":72.3,"zpi":71.7,"composite":74.27,"viewUV":4.2672,"dwellHours":0.5255555555555556},{"id":"ch-153","g":"공공/공익/정보","name":"MGTV","no":157,"originalNo":157,"viewers":338844,"watchSeconds":1024664256,"svi":70.6,"cpi":90.2,"zpi":70,"composite":76.93,"viewUV":33.8844,"dwellHours":0.84},{"id":"ch-154","g":"다큐/교양","name":"KBS LIFE","no":158,"originalNo":158,"viewers":357049,"watchSeconds":388826361,"svi":66.5,"cpi":81.5,"zpi":67.5,"composite":71.83,"viewUV":35.7049,"dwellHours":0.3025},{"id":"ch-155","g":"공공/공익/정보","name":"YTN2","no":159,"originalNo":159,"viewers":336371,"watchSeconds":474619481,"svi":74.9,"cpi":27.7,"zpi":49.7,"composite":50.77,"viewUV":33.6371,"dwellHours":0.3919444444444445},{"id":"ch-156","g":"공공/공익/정보","name":"OUN","no":160,"originalNo":160,"viewers":157158,"watchSeconds":43689924,"svi":77.4,"cpi":46.7,"zpi":31.7,"composite":51.93,"viewUV":15.7158,"dwellHours":0.07722222222222222},{"id":"ch-157","g":"다큐/교양","name":"Real TV","no":161,"originalNo":161,"viewers":224643,"watchSeconds":804895869,"svi":82.9,"cpi":38.7,"zpi":30.7,"composite":50.77,"viewUV":22.4643,"dwellHours":0.9952777777777777},{"id":"ch-158","g":"다큐/교양","name":"Now 제주TV","no":162,"originalNo":162,"viewers":67302,"watchSeconds":168389604,"svi":85.8,"cpi":78.7,"zpi":84,"composite":82.83,"viewUV":6.7302,"dwellHours":0.695},{"id":"ch-159","g":"다큐/교양","name":"9colors","no":163,"originalNo":163,"viewers":362120,"watchSeconds":1223965600,"svi":75.2,"cpi":49.9,"zpi":30.3,"composite":51.8,"viewUV":36.212,"dwellHours":0.9388888888888888},{"id":"ch-160","g":"다큐/교양","name":"MBCNET","no":164,"originalNo":164,"viewers":74853,"watchSeconds":131217309,"svi":65.9,"cpi":93.1,"zpi":70.8,"composite":76.6,"viewUV":7.4853,"dwellHours":0.48694444444444446},{"id":"ch-161","g":"공공/공익/정보","name":"채널i","no":165,"originalNo":165,"viewers":275558,"watchSeconds":93138604,"svi":85.4,"cpi":25.7,"zpi":40,"composite":50.37,"viewUV":27.5558,"dwellHours":0.09388888888888888},{"id":"ch-162","g":"공공/공익/정보","name":"아리랑TV","no":166,"originalNo":166,"viewers":51993,"watchSeconds":24592689,"svi":82.7,"cpi":58.9,"zpi":63.3,"composite":68.3,"viewUV":5.1993,"dwellHours":0.1313888888888889},{"id":"ch-163","g":"스포츠/레저","name":"MAXPORTS","no":167,"originalNo":167,"viewers":47569,"watchSeconds":71781621,"svi":83.5,"cpi":86.5,"zpi":84.9,"composite":84.97,"viewUV":4.7569,"dwellHours":0.4191666666666667},{"id":"ch-164","g":"종교/오픈","name":"TVCHOSUN3","no":168,"originalNo":168,"viewers":207431,"watchSeconds":251198941,"svi":91.1,"cpi":69.1,"zpi":61,"composite":73.73,"viewUV":20.7431,"dwellHours":0.33638888888888896},{"id":"ch-165","g":"공공/공익/정보","name":"쿠키건강TV","no":169,"originalNo":169,"viewers":76258,"watchSeconds":33401004,"svi":85.4,"cpi":41.4,"zpi":48.8,"composite":58.53,"viewUV":7.6258,"dwellHours":0.12166666666666667},{"id":"ch-166","g":"종교/오픈","name":"ONT","no":170,"originalNo":170,"viewers":154664,"watchSeconds":501730016,"svi":74.4,"cpi":24.3,"zpi":38,"composite":45.57,"viewUV":15.4664,"dwellHours":0.9011111111111111},{"id":"ch-167","g":"공공/공익/정보","name":"메디컬TV","no":171,"originalNo":171,"viewers":247040,"watchSeconds":429849600,"svi":71.6,"cpi":34.2,"zpi":34.1,"composite":46.63,"viewUV":24.704,"dwellHours":0.48333333333333334},{"id":"ch-168","g":"종교/오픈","name":"연합뉴스TV JOB","no":172,"originalNo":172,"viewers":409393,"watchSeconds":856859549,"svi":65.3,"cpi":35.9,"zpi":19.9,"composite":40.37,"viewUV":40.9393,"dwellHours":0.5813888888888888},{"id":"ch-169","g":"종교/오픈","name":"BALL TV","no":173,"originalNo":173,"viewers":366853,"watchSeconds":819182749,"svi":65.7,"cpi":86.2,"zpi":56.7,"composite":69.53,"viewUV":36.6853,"dwellHours":0.6202777777777778},{"id":"ch-170","g":"다큐/교양","name":"사이언스TV","no":175,"originalNo":175,"viewers":36246,"watchSeconds":61110756,"svi":88.6,"cpi":91.8,"zpi":92.4,"composite":90.93,"viewUV":3.6246,"dwellHours":0.4683333333333333},{"id":"ch-171","g":"다큐/교양","name":"채널뷰","no":176,"originalNo":176,"viewers":261671,"watchSeconds":217448601,"svi":90.9,"cpi":92.2,"zpi":72.7,"composite":85.27,"viewUV":26.1671,"dwellHours":0.23083333333333333},{"id":"ch-172","g":"애니/유아/교육","name":"대교 뉴이프Plus","no":179,"originalNo":179,"viewers":282122,"watchSeconds":796148284,"svi":73.6,"cpi":80.5,"zpi":68.1,"composite":74.07,"viewUV":28.2122,"dwellHours":0.7838888888888889},{"id":"ch-173","g":"뉴스/경제","name":"한국경제 TV","no":180,"originalNo":180,"viewers":463658,"watchSeconds":611101244,"svi":90,"cpi":76.3,"zpi":58,"composite":74.77,"viewUV":46.3658,"dwellHours":0.3661111111111111},{"id":"ch-174","g":"뉴스/경제","name":"MTN 머니투데이방송","no":181,"originalNo":181,"viewers":238022,"watchSeconds":233737604,"svi":92.8,"cpi":40,"zpi":30.8,"composite":54.53,"viewUV":23.8022,"dwellHours":0.2727777777777778},{"id":"ch-175","g":"뉴스/경제","name":"매일경제TV","no":182,"originalNo":182,"viewers":479623,"watchSeconds":1382753109,"svi":90.1,"cpi":48.9,"zpi":40.1,"composite":59.7,"viewUV":47.9623,"dwellHours":0.8008333333333333},{"id":"ch-176","g":"뉴스/경제","name":"이데일리TV","no":183,"originalNo":183,"viewers":58579,"watchSeconds":69064641,"svi":79.5,"cpi":69.6,"zpi":92.3,"composite":80.47,"viewUV":5.8579,"dwellHours":0.3275},{"id":"ch-177","g":"뉴스/경제","name":"서울경제TV SEN","no":184,"originalNo":184,"viewers":29297,"watchSeconds":104209429,"svi":87.7,"cpi":81.9,"zpi":84.8,"composite":84.8,"viewUV":2.9297,"dwellHours":0.9880555555555556},{"id":"ch-178","g":"뉴스/경제","name":"TomatoTV","no":185,"originalNo":185,"viewers":191343,"watchSeconds":272281089,"svi":67.7,"cpi":81.3,"zpi":61.5,"composite":70.17,"viewUV":19.1343,"dwellHours":0.3952777777777778},{"id":"ch-179","g":"뉴스/경제","name":"팍스경제TV","no":186,"originalNo":186,"viewers":114020,"watchSeconds":364864000,"svi":70,"cpi":90,"zpi":90.1,"composite":83.37,"viewUV":11.402,"dwellHours":0.8888888888888891},{"id":"ch-180","g":"뉴스/경제","name":"연합뉴스경제TV","no":187,"originalNo":187,"viewers":169307,"watchSeconds":458314049,"svi":84.9,"cpi":61.9,"zpi":61.2,"composite":69.33,"viewUV":16.9307,"dwellHours":0.7519444444444443},{"id":"ch-181","g":"뉴스/경제","name":"토마토리빙","no":188,"originalNo":188,"viewers":43815,"watchSeconds":48853725,"svi":68.7,"cpi":48.6,"zpi":24,"composite":47.1,"viewUV":4.3815,"dwellHours":0.30972222222222223},{"id":"ch-182","g":"스포츠/레저","name":"SPOTV PRIME","no":190,"originalNo":190,"viewers":181120,"watchSeconds":184742400,"svi":70.6,"cpi":53.7,"zpi":16.8,"composite":47.03,"viewUV":18.112,"dwellHours":0.2833333333333334},{"id":"ch-183","g":"스포츠/레저","name":"SPOTV PRIME2","no":191,"originalNo":191,"viewers":55127,"watchSeconds":96306869,"svi":92.3,"cpi":31.8,"zpi":38.6,"composite":54.23,"viewUV":5.5127,"dwellHours":0.48527777777777775},{"id":"ch-184","g":"스포츠/레저","name":"SPOTV PRIME+","no":192,"originalNo":192,"viewers":113207,"watchSeconds":91358049,"svi":61.7,"cpi":52.1,"zpi":24.7,"composite":46.17,"viewUV":11.3207,"dwellHours":0.22416666666666665},{"id":"ch-185","g":"영화/시리즈","name":"캐치온 1","no":193,"originalNo":193,"viewers":311661,"watchSeconds":636100101,"svi":79.1,"cpi":73,"zpi":65,"composite":72.37,"viewUV":31.1661,"dwellHours":0.5669444444444445},{"id":"ch-186","g":"영화/시리즈","name":"캐치온 2","no":194,"originalNo":194,"viewers":415333,"watchSeconds":1176638389,"svi":88.3,"cpi":75.4,"zpi":72.5,"composite":78.73,"viewUV":41.5333,"dwellHours":0.7869444444444446},{"id":"ch-187","g":"공공/공익/정보","name":"복지TV","no":199,"originalNo":199,"viewers":196697,"watchSeconds":82022649,"svi":78.7,"cpi":46.7,"zpi":17.3,"composite":47.57,"viewUV":19.6697,"dwellHours":0.11583333333333333},{"id":"ch-188","g":"스포츠/레저","name":"해피독티비","no":201,"originalNo":201,"viewers":84917,"watchSeconds":122025729,"svi":80.9,"cpi":79.1,"zpi":72,"composite":77.33,"viewUV":8.4917,"dwellHours":0.39916666666666667},{"id":"ch-189","g":"스포츠/레저","name":"DOGTV","no":202,"originalNo":202,"viewers":81849,"watchSeconds":256105521,"svi":77.1,"cpi":87.7,"zpi":56.3,"composite":73.7,"viewUV":8.1849,"dwellHours":0.8691666666666665},{"id":"ch-190","g":"성인","name":"VIKI","no":204,"originalNo":204,"viewers":307114,"watchSeconds":532535676,"svi":68.6,"cpi":69.5,"zpi":63.9,"composite":67.33,"viewUV":30.7114,"dwellHours":0.4816666666666667},{"id":"ch-191","g":"성인","name":"미드나잇 채널","no":205,"originalNo":205,"viewers":261593,"watchSeconds":589369029,"svi":89.7,"cpi":63.4,"zpi":75,"composite":76.03,"viewUV":26.1593,"dwellHours":0.6258333333333332},{"id":"ch-192","g":"성인","name":"플레이보이TV","no":206,"originalNo":206,"viewers":217241,"watchSeconds":608492041,"svi":79.5,"cpi":90,"zpi":87.5,"composite":85.67,"viewUV":21.7241,"dwellHours":0.7780555555555555},{"id":"ch-193","g":"성인","name":"허니TV","no":207,"originalNo":207,"viewers":243780,"watchSeconds":507062400,"svi":84.8,"cpi":33.4,"zpi":30.4,"composite":49.53,"viewUV":24.378,"dwellHours":0.5777777777777777},{"id":"ch-194","g":"성인","name":"핑크하우스","no":208,"originalNo":208,"viewers":481196,"watchSeconds":1412791456,"svi":65.6,"cpi":48,"zpi":50.3,"composite":54.63,"viewUV":48.1196,"dwellHours":0.8155555555555556},{"id":"ch-195","g":"성인","name":"DesireTV","no":209,"originalNo":209,"viewers":366620,"watchSeconds":1129189600,"svi":75.6,"cpi":25.5,"zpi":20,"composite":40.37,"viewUV":36.662,"dwellHours":0.8555555555555555},{"id":"ch-196","g":"성인","name":"비너스TV","no":210,"originalNo":210,"viewers":139442,"watchSeconds":460437484,"svi":61.6,"cpi":20.8,"zpi":54.4,"composite":45.6,"viewUV":13.9442,"dwellHours":0.9172222222222223},{"id":"ch-197","g":"공공/공익/정보","name":"법률방송","no":213,"originalNo":213,"viewers":201854,"watchSeconds":144123756,"svi":74.6,"cpi":32.1,"zpi":50.5,"composite":52.4,"viewUV":20.1854,"dwellHours":0.19833333333333333},{"id":"ch-198","g":"공공/공익/정보","name":"TBS TV","no":214,"originalNo":214,"viewers":32597,"watchSeconds":55317109,"svi":80.1,"cpi":77,"zpi":58.8,"composite":71.97,"viewUV":3.2597,"dwellHours":0.4713888888888889},{"id":"ch-199","g":"공공/공익/정보","name":"헬스메디TV","no":215,"originalNo":215,"viewers":220609,"watchSeconds":615278501,"svi":60.3,"cpi":62.6,"zpi":87.5,"composite":70.13,"viewUV":22.0609,"dwellHours":0.7747222222222222},{"id":"ch-200","g":"공공/공익/정보","name":"육아방송","no":217,"originalNo":217,"viewers":426226,"watchSeconds":326489116,"svi":63.6,"cpi":23.8,"zpi":42.9,"composite":43.43,"viewUV":42.6226,"dwellHours":0.2127777777777778},{"id":"ch-201","g":"공공/공익/정보","name":"k-net","no":221,"originalNo":221,"viewers":180057,"watchSeconds":608052489,"svi":81.5,"cpi":29.3,"zpi":40.5,"composite":50.43,"viewUV":18.0057,"dwellHours":0.9380555555555555},{"id":"ch-202","g":"공공/공익/정보","name":"시니어 TV","no":222,"originalNo":222,"viewers":455813,"watchSeconds":1282201969,"svi":83.5,"cpi":76.8,"zpi":66.4,"composite":75.57,"viewUV":45.5813,"dwellHours":0.7813888888888889},{"id":"ch-203","g":"공공/공익/정보","name":"소상공인시장tv","no":223,"originalNo":223,"viewers":412989,"watchSeconds":970111161,"svi":87.5,"cpi":23.1,"zpi":53,"composite":54.53,"viewUV":41.2989,"dwellHours":0.6524999999999999},{"id":"ch-204","g":"공공/공익/정보","name":"지방자치TV","no":224,"originalNo":224,"viewers":382990,"watchSeconds":448098300,"svi":72.6,"cpi":68.3,"zpi":88.2,"composite":76.37,"viewUV":38.299,"dwellHours":0.325},{"id":"ch-205","g":"공공/공익/정보","name":"디마티비","no":225,"originalNo":225,"viewers":431066,"watchSeconds":1140600636,"svi":92.2,"cpi":49,"zpi":43,"composite":61.4,"viewUV":43.1066,"dwellHours":0.735},{"id":"ch-206","g":"스포츠/레저","name":"폴라리스TV","no":226,"originalNo":226,"viewers":85241,"watchSeconds":76802141,"svi":69.5,"cpi":52.3,"zpi":21.4,"composite":47.73,"viewUV":8.5241,"dwellHours":0.25027777777777777},{"id":"ch-207","g":"종교/오픈","name":"가톨릭평화방송","no":231,"originalNo":231,"viewers":163027,"watchSeconds":578256769,"svi":82.1,"cpi":63.3,"zpi":81.9,"composite":75.77,"viewUV":16.3027,"dwellHours":0.9852777777777777},{"id":"ch-208","g":"종교/오픈","name":"BBS불교방송","no":232,"originalNo":232,"viewers":17617,"watchSeconds":8403309,"svi":83.9,"cpi":58.8,"zpi":82.6,"composite":75.1,"viewUV":1.7617,"dwellHours":0.1325},{"id":"ch-209","g":"종교/오픈","name":"BTN불교TV","no":233,"originalNo":233,"viewers":470391,"watchSeconds":400302741,"svi":70.3,"cpi":79,"zpi":61.6,"composite":70.3,"viewUV":47.0391,"dwellHours":0.2363888888888889},{"id":"ch-210","g":"종교/오픈","name":"GOODTV","no":234,"originalNo":234,"viewers":351009,"watchSeconds":262905741,"svi":82.9,"cpi":46.1,"zpi":21,"composite":50,"viewUV":35.1009,"dwellHours":0.20805555555555555},{"id":"ch-211","g":"종교/오픈","name":"C채널","no":235,"originalNo":235,"viewers":451368,"watchSeconds":1068839424,"svi":92,"cpi":66.7,"zpi":75.4,"composite":78.03,"viewUV":45.1368,"dwellHours":0.6577777777777778},{"id":"ch-212","g":"종교/오픈","name":"CTS 기독교TV","no":236,"originalNo":236,"viewers":232065,"watchSeconds":316768725,"svi":81.7,"cpi":83.9,"zpi":57.4,"composite":74.33,"viewUV":23.2065,"dwellHours":0.3791666666666667},{"id":"ch-213","g":"종교/오픈","name":"CGN","no":237,"originalNo":237,"viewers":459719,"watchSeconds":1231587201,"svi":75.3,"cpi":52.8,"zpi":32.4,"composite":53.5,"viewUV":45.9719,"dwellHours":0.7441666666666666},{"id":"ch-214","g":"종교/오픈","name":"CBS TV","no":238,"originalNo":238,"viewers":340286,"watchSeconds":172184716,"svi":74.6,"cpi":37.6,"zpi":43.9,"composite":52.03,"viewUV":34.0286,"dwellHours":0.14055555555555554},{"id":"ch-215","g":"종교/오픈","name":"원음방송","no":239,"originalNo":239,"viewers":190841,"watchSeconds":198665481,"svi":80.7,"cpi":31.7,"zpi":29.8,"composite":47.4,"viewUV":19.0841,"dwellHours":0.2891666666666667},{"id":"ch-216","g":"종교/오픈","name":"YCN유림방송","no":240,"originalNo":240,"viewers":41417,"watchSeconds":132410149,"svi":62.1,"cpi":30.5,"zpi":53.6,"composite":48.73,"viewUV":4.1417,"dwellHours":0.8880555555555556},{"id":"ch-217","g":"종교/오픈","name":"STB 상생방송","no":241,"originalNo":241,"viewers":175009,"watchSeconds":442597761,"svi":72.7,"cpi":72.4,"zpi":74.9,"composite":73.33,"viewUV":17.5009,"dwellHours":0.7025},{"id":"ch-218","g":"종교/오픈","name":"유교TV방송","no":242,"originalNo":242,"viewers":247107,"watchSeconds":224126049,"svi":77.3,"cpi":50.5,"zpi":25.1,"composite":50.97,"viewUV":24.7107,"dwellHours":0.25194444444444447},{"id":"ch-219","g":"종교/오픈","name":"국악방송","no":251,"originalNo":251,"viewers":272811,"watchSeconds":739590621,"svi":73.9,"cpi":60.4,"zpi":66.9,"composite":67.07,"viewUV":27.2811,"dwellHours":0.7530555555555556},{"id":"ch-220","g":"종교/오픈","name":"토마토클래식","no":253,"originalNo":253,"viewers":316676,"watchSeconds":676419936,"svi":80,"cpi":72.5,"zpi":85.3,"composite":79.27,"viewUV":31.6676,"dwellHours":0.5933333333333334},{"id":"ch-221","g":"종교/오픈","name":"WeeTV","no":254,"originalNo":254,"viewers":492619,"watchSeconds":846812061,"svi":78.3,"cpi":39.5,"zpi":27.6,"composite":48.47,"viewUV":49.2619,"dwellHours":0.4775},{"id":"ch-222","g":"종교/오픈","name":"슬로우TV","no":256,"originalNo":256,"viewers":286612,"watchSeconds":318712544,"svi":90,"cpi":75.5,"zpi":81.4,"composite":82.3,"viewUV":28.6612,"dwellHours":0.3088888888888889},{"id":"ch-223","g":"종교/오픈","name":"채널칭","no":258,"originalNo":258,"viewers":217559,"watchSeconds":752536581,"svi":81.1,"cpi":80.1,"zpi":73.1,"composite":78.1,"viewUV":21.7559,"dwellHours":0.9608333333333333},{"id":"ch-224","g":"종교/오픈","name":"채널S 플러스","no":259,"originalNo":259,"viewers":160038,"watchSeconds":409377204,"svi":77.4,"cpi":93.4,"zpi":93.4,"composite":88.07,"viewUV":16.0038,"dwellHours":0.7105555555555557},{"id":"ch-225","g":"종교/오픈","name":"ONN 닥터TV","no":262,"originalNo":262,"viewers":361405,"watchSeconds":1042653425,"svi":80.7,"cpi":58.7,"zpi":71.9,"composite":70.43,"viewUV":36.1405,"dwellHours":0.8013888888888888},{"id":"ch-226","g":"종교/오픈","name":"DealSite경제TV","no":263,"originalNo":263,"viewers":291944,"watchSeconds":655122336,"svi":63.6,"cpi":29.2,"zpi":38.5,"composite":43.77,"viewUV":29.1944,"dwellHours":0.6233333333333333},{"id":"ch-227","g":"종교/오픈","name":"디스토리","no":264,"originalNo":264,"viewers":54633,"watchSeconds":57528549,"svi":75.1,"cpi":42.5,"zpi":44.5,"composite":54.03,"viewUV":5.4633,"dwellHours":0.2925},{"id":"ch-228","g":"드라마/오락/음악","name":"E LIKE","no":265,"originalNo":265,"viewers":175140,"watchSeconds":350280000,"svi":84.4,"cpi":43.1,"zpi":47.3,"composite":58.27,"viewUV":17.514,"dwellHours":0.5555555555555556},{"id":"ch-229","g":"종교/오픈","name":"더라이프2","no":266,"originalNo":266,"viewers":439171,"watchSeconds":1427744921,"svi":77.3,"cpi":46.5,"zpi":41.6,"composite":55.13,"viewUV":43.9171,"dwellHours":0.9030555555555555},{"id":"ch-230","g":"종교/오픈","name":"RNA","no":267,"originalNo":267,"viewers":272353,"watchSeconds":439305389,"svi":80.9,"cpi":65.8,"zpi":91.2,"composite":79.3,"viewUV":27.2353,"dwellHours":0.44805555555555554},{"id":"ch-231","g":"영화/시리즈","name":"채널액션","no":268,"originalNo":268,"viewers":25910,"watchSeconds":9068500,"svi":81.4,"cpi":33.7,"zpi":32.7,"composite":49.27,"viewUV":2.591,"dwellHours":0.09722222222222221},{"id":"ch-232","g":"종교/오픈","name":"리빙TV","no":276,"originalNo":276,"viewers":466807,"watchSeconds":1272982689,"svi":92.1,"cpi":24.9,"zpi":17.7,"composite":44.9,"viewUV":46.6807,"dwellHours":0.7575},{"id":"ch-233","g":"종교/오픈","name":"사회안전방송","no":278,"originalNo":278,"viewers":195220,"watchSeconds":363109200,"svi":89.8,"cpi":54.9,"zpi":46.4,"composite":63.7,"viewUV":19.522,"dwellHours":0.5166666666666667},{"id":"ch-234","g":"영화/시리즈","name":"HITS","no":290,"originalNo":290,"viewers":63550,"watchSeconds":111212500,"svi":83.4,"cpi":91.4,"zpi":81,"composite":85.27,"viewUV":6.355,"dwellHours":0.48611111111111105},{"id":"ch-235","g":"다큐/교양","name":"Discovery Channel","no":291,"originalNo":291,"viewers":40866,"watchSeconds":98323596,"svi":67.8,"cpi":26.7,"zpi":19.8,"composite":38.1,"viewUV":4.0866,"dwellHours":0.6683333333333333},{"id":"ch-236","g":"다큐/교양","name":"BBC Earth","no":292,"originalNo":292,"viewers":238337,"watchSeconds":828697749,"svi":77.7,"cpi":61.4,"zpi":73.5,"composite":70.87,"viewUV":23.8337,"dwellHours":0.9658333333333333},{"id":"ch-237","g":"다큐/교양","name":"HGTV","no":293,"originalNo":293,"viewers":126032,"watchSeconds":445145024,"svi":77.8,"cpi":60.8,"zpi":64.6,"composite":67.73,"viewUV":12.6032,"dwellHours":0.9811111111111112},{"id":"ch-238","g":"다큐/교양","name":"Animal Planet","no":294,"originalNo":294,"viewers":115812,"watchSeconds":404415504,"svi":82,"cpi":31.3,"zpi":55,"composite":56.1,"viewUV":11.5812,"dwellHours":0.9699999999999999},{"id":"ch-239","g":"다큐/교양","name":"CCTV4","no":295,"originalNo":295,"viewers":72983,"watchSeconds":152023589,"svi":86.5,"cpi":43.2,"zpi":51.4,"composite":60.37,"viewUV":7.2983,"dwellHours":0.5786111111111111},{"id":"ch-240","g":"다큐/교양","name":"DSC Science","no":296,"originalNo":296,"viewers":262466,"watchSeconds":788972796,"svi":62.6,"cpi":68.5,"zpi":57.9,"composite":63,"viewUV":26.2466,"dwellHours":0.835},{"id":"ch-241","g":"뉴스/경제","name":"NHK WP","no":297,"originalNo":297,"viewers":286853,"watchSeconds":904447509,"svi":74.1,"cpi":37.8,"zpi":40.8,"composite":50.9,"viewUV":28.6853,"dwellHours":0.8758333333333334},{"id":"ch-242","g":"뉴스/경제","name":"ABC Australia","no":298,"originalNo":298,"viewers":85674,"watchSeconds":38895996,"svi":88,"cpi":41.6,"zpi":34.8,"composite":54.8,"viewUV":8.5674,"dwellHours":0.12611111111111112},{"id":"ch-243","g":"뉴스/경제","name":"CNN Int'l","no":299,"originalNo":299,"viewers":415734,"watchSeconds":454812996,"svi":80.8,"cpi":78.2,"zpi":72.1,"composite":77.03,"viewUV":41.5734,"dwellHours":0.3038888888888889},{"id":"ch-244","g":"뉴스/경제","name":"BBC News","no":300,"originalNo":300,"viewers":187304,"watchSeconds":322912096,"svi":91.2,"cpi":81.1,"zpi":60.6,"composite":77.63,"viewUV":18.7304,"dwellHours":0.47888888888888886},{"id":"ch-245","g":"뉴스/경제","name":"Euro News","no":301,"originalNo":301,"viewers":302441,"watchSeconds":544696241,"svi":91.7,"cpi":33.2,"zpi":32,"composite":52.3,"viewUV":30.2441,"dwellHours":0.5002777777777778},{"id":"ch-246","g":"뉴스/경제","name":"CGTN","no":302,"originalNo":302,"viewers":159524,"watchSeconds":517495856,"svi":71.2,"cpi":81.4,"zpi":76.1,"composite":76.23,"viewUV":15.9524,"dwellHours":0.9011111111111111},{"id":"ch-247","g":"뉴스/경제","name":"Fox News","no":303,"originalNo":303,"viewers":431111,"watchSeconds":754875361,"svi":90.1,"cpi":86.1,"zpi":58.5,"composite":78.23,"viewUV":43.1111,"dwellHours":0.48638888888888887},{"id":"ch-248","g":"뉴스/경제","name":"Bloomberg","no":304,"originalNo":304,"viewers":493239,"watchSeconds":334909281,"svi":61.3,"cpi":42.8,"zpi":34.6,"composite":46.23,"viewUV":49.3239,"dwellHours":0.18861111111111112},{"id":"ch-249","g":"뉴스/경제","name":"CNBC","no":305,"originalNo":305,"viewers":344081,"watchSeconds":537110441,"svi":75.3,"cpi":57.6,"zpi":71.4,"composite":68.1,"viewUV":34.4081,"dwellHours":0.4336111111111111},{"id":"ch-250","g":"뉴스/경제","name":"TV5 Monde","no":306,"originalNo":306,"viewers":229468,"watchSeconds":139516544,"svi":74.2,"cpi":69.4,"zpi":57.8,"composite":67.13,"viewUV":22.9468,"dwellHours":0.1688888888888889},{"id":"ch-251","g":"뉴스/경제","name":"DW-TV Asia+","no":307,"originalNo":307,"viewers":286776,"watchSeconds":119298816,"svi":79.8,"cpi":70.8,"zpi":68.1,"composite":72.9,"viewUV":28.6776,"dwellHours":0.11555555555555555},{"id":"ch-252","g":"오디오","name":"최신 인기가요","no":609,"originalNo":609,"viewers":209346,"watchSeconds":654415596,"svi":92.2,"cpi":92.7,"zpi":57.8,"composite":80.9,"viewUV":20.9346,"dwellHours":0.8683333333333333},{"id":"ch-253","g":"오디오","name":"Dog & Mom","no":610,"originalNo":610,"viewers":480499,"watchSeconds":1613996141,"svi":76.9,"cpi":44.7,"zpi":42.7,"composite":54.77,"viewUV":48.0499,"dwellHours":0.9330555555555555},{"id":"ch-254","g":"오디오","name":"최신발라드가요","no":611,"originalNo":611,"viewers":107997,"watchSeconds":153031749,"svi":74.3,"cpi":39.2,"zpi":48,"composite":53.83,"viewUV":10.7997,"dwellHours":0.39361111111111113},{"id":"ch-255","g":"오디오","name":"K-POP 아이돌","no":612,"originalNo":612,"viewers":88375,"watchSeconds":31373125,"svi":65.9,"cpi":64.2,"zpi":57.5,"composite":62.53,"viewUV":8.8375,"dwellHours":0.09861111111111111},{"id":"ch-256","g":"오디오","name":"최신가요 차트 HOT150","no":613,"originalNo":613,"viewers":70422,"watchSeconds":232533444,"svi":90.6,"cpi":62.3,"zpi":68.4,"composite":73.77,"viewUV":7.0422,"dwellHours":0.9172222222222223},{"id":"ch-257","g":"오디오","name":"트로트가요무대","no":614,"originalNo":614,"viewers":294328,"watchSeconds":902998304,"svi":74.6,"cpi":45.7,"zpi":29.4,"composite":49.9,"viewUV":29.4328,"dwellHours":0.8522222222222222},{"id":"ch-258","g":"오디오","name":"최신트로트히트","no":615,"originalNo":615,"viewers":88229,"watchSeconds":159606261,"svi":71.9,"cpi":30.4,"zpi":51.5,"composite":51.27,"viewUV":8.8229,"dwellHours":0.5025},{"id":"ch-259","g":"오디오","name":"듣기 편한 팝","no":616,"originalNo":616,"viewers":236874,"watchSeconds":619188636,"svi":60.6,"cpi":51.3,"zpi":28.1,"composite":46.67,"viewUV":23.6874,"dwellHours":0.7261111111111112},{"id":"ch-260","g":"오디오","name":"인기성인가요 HOT 300","no":617,"originalNo":617,"viewers":235286,"watchSeconds":617861036,"svi":90.6,"cpi":46.6,"zpi":26.2,"composite":54.47,"viewUV":23.5286,"dwellHours":0.7294444444444445},{"id":"ch-261","g":"오디오","name":"최신 히트 팝스","no":618,"originalNo":618,"viewers":472447,"watchSeconds":1411199189,"svi":67.5,"cpi":62.9,"zpi":80.2,"composite":70.2,"viewUV":47.2447,"dwellHours":0.8297222222222222},{"id":"ch-262","g":"오디오","name":"한국인의 팝송","no":619,"originalNo":619,"viewers":219702,"watchSeconds":158624844,"svi":86.2,"cpi":70,"zpi":73.1,"composite":76.43,"viewUV":21.9702,"dwellHours":0.2005555555555556},{"id":"ch-263","g":"오디오","name":"다문화음악1","no":620,"originalNo":620,"viewers":477793,"watchSeconds":120881629,"svi":79.3,"cpi":82.6,"zpi":91.5,"composite":84.47,"viewUV":47.7793,"dwellHours":0.07027777777777777},{"id":"ch-264","g":"오디오","name":"다문화음악2","no":621,"originalNo":621,"viewers":289169,"watchSeconds":904809801,"svi":88.5,"cpi":85,"zpi":60.1,"composite":77.87,"viewUV":28.9169,"dwellHours":0.8691666666666666},{"id":"ch-265","g":"오디오","name":"Black Music","no":622,"originalNo":622,"viewers":153117,"watchSeconds":177156369,"svi":60.7,"cpi":23.5,"zpi":46.6,"composite":43.6,"viewUV":15.3117,"dwellHours":0.3213888888888889},{"id":"ch-266","g":"오디오","name":"Rock Festival","no":623,"originalNo":623,"viewers":247703,"watchSeconds":75054009,"svi":71.1,"cpi":47.9,"zpi":51.1,"composite":56.7,"viewUV":24.7703,"dwellHours":0.08416666666666667},{"id":"ch-267","g":"오디오","name":"재즈 라운지","no":624,"originalNo":624,"viewers":485161,"watchSeconds":602084801,"svi":74.9,"cpi":86.3,"zpi":73.4,"composite":78.2,"viewUV":48.5161,"dwellHours":0.3447222222222222},{"id":"ch-268","g":"오디오","name":"홈클래식","no":625,"originalNo":625,"viewers":145149,"watchSeconds":474492081,"svi":77.3,"cpi":78.4,"zpi":72.8,"composite":76.17,"viewUV":14.5149,"dwellHours":0.9080555555555555},{"id":"ch-269","g":"오디오","name":"클래식 산책","no":626,"originalNo":626,"viewers":274747,"watchSeconds":381074089,"svi":90.1,"cpi":78.8,"zpi":70.9,"composite":79.93,"viewUV":27.4747,"dwellHours":0.3852777777777778},{"id":"ch-270","g":"오디오","name":"당신의 발라드","no":627,"originalNo":627,"viewers":487273,"watchSeconds":542334849,"svi":72.5,"cpi":58,"zpi":87.6,"composite":72.7,"viewUV":48.7273,"dwellHours":0.30916666666666665},{"id":"ch-271","g":"오디오","name":"2000년대 인기가요","no":628,"originalNo":628,"viewers":17237,"watchSeconds":60622529,"svi":63.9,"cpi":21.4,"zpi":40.9,"composite":42.07,"viewUV":1.7237,"dwellHours":0.9769444444444444},{"id":"ch-272","g":"오디오","name":"TV속 화제음악","no":629,"originalNo":629,"viewers":225148,"watchSeconds":636718544,"svi":70.6,"cpi":45,"zpi":25.7,"composite":47.1,"viewUV":22.5148,"dwellHours":0.7855555555555556},{"id":"ch-273","g":"오디오","name":"OST 천국","no":630,"originalNo":630,"viewers":366791,"watchSeconds":150751101,"svi":82.5,"cpi":77.9,"zpi":55.1,"composite":71.83,"viewUV":36.6791,"dwellHours":0.11416666666666667},{"id":"ch-274","g":"오디오","name":"엄마랑 EQ동요","no":631,"originalNo":631,"viewers":159087,"watchSeconds":354286749,"svi":60.9,"cpi":93.2,"zpi":83.2,"composite":79.1,"viewUV":15.9087,"dwellHours":0.6186111111111111},{"id":"ch-275","g":"오디오","name":"Rainy day","no":632,"originalNo":632,"viewers":492247,"watchSeconds":1047009369,"svi":68.5,"cpi":54.7,"zpi":17,"composite":46.73,"viewUV":49.2247,"dwellHours":0.5908333333333333},{"id":"ch-276","g":"오디오","name":"한국 발라드 명곡770","no":633,"originalNo":633,"viewers":123482,"watchSeconds":61987964,"svi":64.6,"cpi":87.5,"zpi":58,"composite":70.03,"viewUV":12.3482,"dwellHours":0.13944444444444445},{"id":"ch-277","g":"오디오","name":"최신인기댄스&힙합","no":634,"originalNo":634,"viewers":430424,"watchSeconds":1284385216,"svi":60.6,"cpi":27.2,"zpi":27.6,"composite":38.47,"viewUV":43.0424,"dwellHours":0.8288888888888889},{"id":"ch-278","g":"오디오","name":"러브발라드 명곡 550","no":635,"originalNo":635,"viewers":167485,"watchSeconds":546838525,"svi":85.1,"cpi":32.8,"zpi":31.6,"composite":49.83,"viewUV":16.7485,"dwellHours":0.9069444444444444},{"id":"ch-279","g":"오디오","name":"스무드재즈","no":636,"originalNo":636,"viewers":47692,"watchSeconds":165586624,"svi":63.6,"cpi":71.7,"zpi":87.5,"composite":74.27,"viewUV":4.7692,"dwellHours":0.9644444444444444},{"id":"ch-280","g":"오디오","name":"클럽 뮤직","no":637,"originalNo":637,"viewers":294673,"watchSeconds":658004809,"svi":63.3,"cpi":36.9,"zpi":38.6,"composite":46.27,"viewUV":29.4673,"dwellHours":0.6202777777777778},{"id":"ch-281","g":"오디오","name":"파워스테이션","no":638,"originalNo":638,"viewers":72228,"watchSeconds":116142624,"svi":87.8,"cpi":30.9,"zpi":20.8,"composite":46.5,"viewUV":7.2228,"dwellHours":0.44666666666666666},{"id":"ch-282","g":"오디오","name":"Cool & Hot","no":639,"originalNo":639,"viewers":173005,"watchSeconds":301893725,"svi":69.3,"cpi":39.7,"zpi":36,"composite":48.33,"viewUV":17.3005,"dwellHours":0.4847222222222222},{"id":"ch-283","g":"오디오","name":"행복한 육아 태교","no":846,"originalNo":846,"viewers":235316,"watchSeconds":403802256,"svi":82,"cpi":23.8,"zpi":40.6,"composite":48.8,"viewUV":23.5316,"dwellHours":0.4766666666666667},{"id":"ch-284","g":"애니/유아/교육","name":"채널 키즈랜드","no":960,"originalNo":960,"viewers":372302,"watchSeconds":1087866444,"svi":65.2,"cpi":67,"zpi":75,"composite":69.07,"viewUV":37.2302,"dwellHours":0.8116666666666665},{"id":"ch-285","g":"애니/유아/교육","name":"ZooMoo","no":961,"originalNo":961,"viewers":316430,"watchSeconds":661338700,"svi":67,"cpi":63.1,"zpi":86.8,"composite":72.3,"viewUV":31.643,"dwellHours":0.5805555555555556},{"id":"ch-286","g":"애니/유아/교육","name":"드림웍스 채널","no":962,"originalNo":962,"viewers":170899,"watchSeconds":98950521,"svi":69.1,"cpi":59.8,"zpi":63.8,"composite":64.23,"viewUV":17.0899,"dwellHours":0.16083333333333333},{"id":"ch-287","g":"애니/유아/교육","name":"키즈톡톡플러스","no":966,"originalNo":966,"viewers":407492,"watchSeconds":722075824,"svi":83.2,"cpi":90.4,"zpi":59.3,"composite":77.63,"viewUV":40.7492,"dwellHours":0.4922222222222222},{"id":"ch-288","g":"애니/유아/교육","name":"다빈치러닝","no":969,"originalNo":969,"viewers":482050,"watchSeconds":1624508500,"svi":70.8,"cpi":86.9,"zpi":73.4,"composite":77.03,"viewUV":48.205,"dwellHours":0.9361111111111111},{"id":"ch-289","g":"애니/유아/교육","name":"edu TV","no":970,"originalNo":970,"viewers":182395,"watchSeconds":104877125,"svi":72.9,"cpi":61.9,"zpi":67.9,"composite":67.57,"viewUV":18.2395,"dwellHours":0.1597222222222222},{"id":"ch-290","g":"애니/유아/교육","name":"EBS플러스2","no":971,"originalNo":971,"viewers":111946,"watchSeconds":316359396,"svi":73.8,"cpi":85.4,"zpi":72.9,"composite":77.37,"viewUV":11.1946,"dwellHours":0.785},{"id":"ch-291","g":"애니/유아/교육","name":"EBS플러스1","no":972,"originalNo":972,"viewers":300572,"watchSeconds":1013528784,"svi":64.8,"cpi":83.1,"zpi":65.3,"composite":71.07,"viewUV":30.0572,"dwellHours":0.9366666666666666},{"id":"ch-292","g":"애니/유아/교육","name":"EBS English","no":973,"originalNo":973,"viewers":227162,"watchSeconds":645594404,"svi":77.6,"cpi":93,"zpi":85.1,"composite":85.23,"viewUV":22.7162,"dwellHours":0.7894444444444444},{"id":"ch-293","g":"애니/유아/교육","name":"플레이런TV","no":974,"originalNo":974,"viewers":457513,"watchSeconds":554963269,"svi":83.3,"cpi":78.6,"zpi":62.5,"composite":74.8,"viewUV":45.7513,"dwellHours":0.33694444444444444},{"id":"ch-294","g":"애니/유아/교육","name":"JEI English TV","no":975,"originalNo":975,"viewers":462504,"watchSeconds":1509613056,"svi":87.2,"cpi":71.1,"zpi":87.7,"composite":82,"viewUV":46.2504,"dwellHours":0.9066666666666666},{"id":"ch-295","g":"애니/유아/교육","name":"뽀요TV","no":976,"originalNo":976,"viewers":365711,"watchSeconds":837843901,"svi":77.9,"cpi":36.5,"zpi":44.9,"composite":53.1,"viewUV":36.5711,"dwellHours":0.6363888888888889},{"id":"ch-296","g":"애니/유아/교육","name":"CBeebies","no":977,"originalNo":977,"viewers":15714,"watchSeconds":49561956,"svi":68,"cpi":35.1,"zpi":33.3,"composite":45.47,"viewUV":1.5714,"dwellHours":0.8761111111111113},{"id":"ch-297","g":"애니/유아/교육","name":"브라보키즈","no":980,"originalNo":980,"viewers":496260,"watchSeconds":1349827200,"svi":84.4,"cpi":33.6,"zpi":34.8,"composite":50.93,"viewUV":49.626,"dwellHours":0.7555555555555555},{"id":"ch-298","g":"애니/유아/교육","name":"EBS KIDS","no":983,"originalNo":983,"viewers":207170,"watchSeconds":441272100,"svi":76.4,"cpi":90.6,"zpi":84,"composite":83.67,"viewUV":20.717,"dwellHours":0.5916666666666667},{"id":"ch-299","g":"애니/유아/교육","name":"KBS Kids","no":984,"originalNo":984,"viewers":401689,"watchSeconds":1353290241,"svi":89.9,"cpi":67.3,"zpi":76,"composite":77.73,"viewUV":40.1689,"dwellHours":0.9358333333333333},{"id":"ch-300","g":"애니/유아/교육","name":"캐리TV","no":985,"originalNo":985,"viewers":310901,"watchSeconds":740255281,"svi":63.7,"cpi":28,"zpi":34.8,"composite":42.17,"viewUV":31.0901,"dwellHours":0.6613888888888889},{"id":"ch-301","g":"애니/유아/교육","name":"JEI재능방송","no":986,"originalNo":986,"viewers":396955,"watchSeconds":260005525,"svi":82.7,"cpi":79.5,"zpi":76.4,"composite":79.53,"viewUV":39.6955,"dwellHours":0.18194444444444444},{"id":"ch-302","g":"애니/유아/교육","name":"어린이TV","no":987,"originalNo":987,"viewers":138505,"watchSeconds":438368325,"svi":60.1,"cpi":74.2,"zpi":84.9,"composite":73.07,"viewUV":13.8505,"dwellHours":0.8791666666666667},{"id":"ch-303","g":"애니/유아/교육","name":"핑크퐁 채널","no":988,"originalNo":988,"viewers":471384,"watchSeconds":850376736,"svi":86.2,"cpi":30.9,"zpi":22.6,"composite":46.57,"viewUV":47.1384,"dwellHours":0.5011111111111111},{"id":"ch-304","g":"애니/유아/교육","name":"카투니토","no":989,"originalNo":989,"viewers":19047,"watchSeconds":64893129,"svi":62.1,"cpi":23.4,"zpi":37.8,"composite":41.1,"viewUV":1.9047,"dwellHours":0.9463888888888888},{"id":"ch-305","g":"애니/유아/교육","name":"애니플러스","no":990,"originalNo":990,"viewers":73639,"watchSeconds":103020961,"svi":92.5,"cpi":21.7,"zpi":20,"composite":44.73,"viewUV":7.3639,"dwellHours":0.38861111111111113},{"id":"ch-306","g":"애니/유아/교육","name":"카툰네트워크","no":991,"originalNo":991,"viewers":165086,"watchSeconds":591998396,"svi":84.4,"cpi":46.7,"zpi":43.5,"composite":58.2,"viewUV":16.5086,"dwellHours":0.9961111111111111},{"id":"ch-307","g":"애니/유아/교육","name":"애니박스","no":993,"originalNo":993,"viewers":360385,"watchSeconds":1191072425,"svi":68.9,"cpi":37.6,"zpi":24,"composite":43.5,"viewUV":36.0385,"dwellHours":0.9180555555555555},{"id":"ch-308","g":"애니/유아/교육","name":"애니원티비","no":994,"originalNo":994,"viewers":213747,"watchSeconds":591437949,"svi":89.9,"cpi":43.7,"zpi":28.3,"composite":53.97,"viewUV":21.3747,"dwellHours":0.7686111111111111},{"id":"ch-309","g":"애니/유아/교육","name":"애니맥스","no":995,"originalNo":995,"viewers":237363,"watchSeconds":750779169,"svi":64.1,"cpi":30.6,"zpi":23.2,"composite":39.3,"viewUV":23.7363,"dwellHours":0.8786111111111111},{"id":"ch-310","g":"애니/유아/교육","name":"Tooniverse","no":996,"originalNo":996,"viewers":474909,"watchSeconds":241728681,"svi":65.1,"cpi":27.3,"zpi":47.4,"composite":46.6,"viewUV":47.4909,"dwellHours":0.14138888888888887}],"changes":[{"id":"ch-3","no":3,"before":"tvN","after":"tvN STORY","type":"pp","ppNo":1},{"id":"ch-8","no":8,"before":"GS SHOP","after":"현대홈쇼핑","type":"swap","swapNo":1,"swapRole":"target"},{"id":"ch-10","no":10,"before":"현대홈쇼핑","after":"GS SHOP","type":"swap","swapNo":1,"swapRole":"counterpart"},{"id":"sample-mixed-new","no":111,"before":"신규","after":"시네마플러스","type":"new","replacedName":""}],"swapScenarios":[{"sourceId":"ch-8","targetId":"ch-10","sourceNo":8,"targetNo":10,"sourceName":"GS SHOP","targetName":"현대홈쇼핑","sourceBefore":"GS SHOP","sourceAfter":"현대홈쇼핑","targetBefore":"현대홈쇼핑","targetAfter":"GS SHOP"}],"ppScenarios":[{"slotId":"ch-3","no":3,"oldName":"tvN","oldG":"드라마/오락/음악","newName":"tvN STORY","newG":"드라마/오락/음악","homeId":"ch-2","homeName":"NS홈쇼핑"}],"time":1790491415117,"baseDate":"2026-09-26","sort":{"key":"order","dir":"asc"},"page":1,"range":{"start":997,"end":111}},"details":[{"no":3,"name":"tvN STORY","genre":"드라마/오락/음악","before":"tvN","after":"tvN STORY","changeType":"pp"},{"no":8,"name":"현대홈쇼핑","genre":"라이브홈쇼핑","before":"GS SHOP","after":"현대홈쇼핑","changeType":"swap"},{"no":10,"name":"GS SHOP","genre":"라이브홈쇼핑","before":"현대홈쇼핑","after":"GS SHOP","changeType":"swap"},{"no":111,"name":"시네마플러스","genre":"영화/시리즈","before":"신규","after":"시네마플러스","changeType":"new"}]};
  sample.run = recalculateRunComposite(sample.run);
  history.unshift(sample);
  try { localStorage.setItem(STORE.history, JSON.stringify(history)); } catch (e) { }
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('is-show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('is-show'), 2400);
}


function compareVal(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'ko', { numeric: true, sensitivity: 'base' });
}
function sortRows(rows, scope, valueFn) {
  const s = sorts[scope], dir = s.dir === 'asc' ? 1 : -1;
  return rows.map((row, i) => ({ row, i })).sort((a, b) => compareVal(valueFn(a.row, s.key), valueFn(b.row, s.key)) * dir || a.i - b.i).map(x => x.row);
}
function renderHead(scope, cols, tbody) {
  const s = sorts[scope];
  tbody.closest('table').querySelector('thead').innerHTML = `<tr>${cols.map(([key, label]) => {
    const on = s.key === key;
    return `<th aria-sort="${on ? (s.dir === 'asc' ? 'ascending' : 'descending') : 'none'}"><button type="button" class="${on ? 'is-on' : ''} ${on && s.dir === 'desc' ? 'is-desc' : ''}" data-sort="${key}">${label}</button></th>`;
  }).join('')}</tr>`;
  $$('th button', tbody.closest('table')).forEach(b => b.addEventListener('click', () => toggleSort(scope, b.dataset.sort)));
}
function toggleSort(scope, key) {
  const s = sorts[scope];
  if (s.key === key) s.dir = s.dir === 'asc' ? 'desc' : 'asc'; else { s.key = key; s.dir = 'asc'; }
  if (scope === 'results') $('#resultSortOrder').value = key === 'order' ? 'channel' : key === 'composite' ? (s.dir === 'asc' ? 'scoreAsc' : 'scoreDesc') : 'custom';
  renderScope(scope);
}
// Number ranges follow the television dial: 999 is followed by 0.
function channelPageGroups(list) {
  if (!channelPageRange) {
    return Array.from({ length: Math.max(1, Math.ceil(list.length / PAGE_SIZE)) }, (_, i) => {
      const items = list.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE);
      return { items, label: items.length ? `${items[0].no}~${items[items.length - 1].no}번` : '검색 결과 없음' };
    });
  }
  const { start, end } = channelPageRange;
  const size = (end - start + 1000) % 1000 + 1;
  const offset = c => (c.no - start + 1000) % 1000;
  const ordered = list.slice().sort((a, b) => offset(a) - offset(b));
  return Array.from({ length: Math.ceil(1000 / size) }, (_, i) => {
    const from = i * size, to = Math.min(from + size - 1, 999);
    const first = (start + from) % 1000, last = (start + to) % 1000;
    const items = ordered.filter(c => offset(c) >= from && offset(c) <= to);
    const rangeLabel = `${first}~${last}번`;
    const count = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    return Array.from({ length: count }, (_, part) => {
      const pageItems = items.slice(part * PAGE_SIZE, (part + 1) * PAGE_SIZE);
      return { items: pageItems, label: pageItems.length ? `${pageItems[0].no}~${pageItems[pageItems.length - 1].no}번` : rangeLabel };
    });
  }).flat();
}
function pageWindow(scope, list) {
  const groups = channelPageGroups(list), max = groups.length;
  pages[scope] = Math.max(1, Math.min(max, pages[scope] || 1));
  const pager = $(`.pager[data-scope="${scope}"]`), sel = $('select', pager);
  sel.innerHTML = groups.map((group, i) => `<option value="${i + 1}">${group.label}</option>`).join('');
  sel.value = pages[scope];
  $('[data-dir="-1"]', pager).disabled = pages[scope] === 1;
  $('[data-dir="1"]', pager).disabled = pages[scope] === max;
  const group = groups[pages[scope] - 1];
  const start = groups.slice(0, pages[scope] - 1).reduce((n, p) => n + p.items.length, 0);
  const note = $(`[data-page-status="${scope}"]`);
  if (note) note.textContent = `${pages[scope]} / ${max}페이지 · ${group.label} · 전체 조회 ${list.length}개`;
  return { start, items: group.items };
}
function syncPageRangeControls() {
  $$('.channel-range').forEach(form => {
    const isCurrent = form.dataset.rangeScope === 'current';
    $('[name="start"]', form).value = channelPageRange ? channelPageRange.start : isCurrent ? '' : 997;
    $('[name="end"]', form).value = channelPageRange ? channelPageRange.end : isCurrent ? '' : 45;
    if (isCurrent) $('[data-reset-range]', form).disabled = !channelPageRange;
    $('.channel-range__error', form).textContent = '';
    $('.channel-range__summary', form).textContent = channelPageRange
      ? `${channelPageRange.start}–${channelPageRange.end}번 · 공통 적용${channelPageRange.start > channelPageRange.end ? " · 999→0 순환" : ""}`
      : (isCurrent ? '' : '기본 49개');
  });
  $$('[data-view-scope] [data-view="grid"]').forEach(button => {
    button.innerHTML = ic('grid') + '7열';
  });
}
function applyPageRange(form) {
  const from = $('[name="start"]', form), to = $('[name="end"]', form);
  const start = Number(from.value), end = Number(to.value);
  if (from.value.trim() === '' || to.value.trim() === '' || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > 999 || end < 0 || end > 999) {
    $('.channel-range__error', form).textContent = '시작번호와 종료번호를 0~999 사이의 정수로 입력하세요.';
    return;
  }
  channelPageRange = { start, end };
  pages.current = pages.scenario = pages.results = 1;
  syncPageRangeControls(); renderChannels(); renderScenario(); renderResultsChannels();
  toast(`첫 페이지를 ${start}–${end}번으로 설정했습니다.`);
}
function resetPageRange() {
  channelPageRange = null;
  pages.current = pages.scenario = pages.results = 1;
  syncPageRangeControls(); renderChannels(); renderScenario(); renderResultsChannels();
}
function renderScope(scope) { if (scope === 'current') renderChannels(); else if (scope === 'scenario') renderScenario(); else renderResultsChannels(); }
function setView(scope, v) {
  views[scope] = v;
  $$(`.seg[data-view-scope="${scope}"] button`).forEach(b => b.classList.toggle('is-on', b.dataset.view === v));
  $$(`[data-view-panel^="${scope}:"]`).forEach(p => { p.hidden = p.dataset.viewPanel !== `${scope}:${v}`; });
}
function pageFor(scope, id, list) {
  const i = channelPageGroups(list).findIndex(group => group.items.some(c => c.id === id));
  if (i >= 0) pages[scope] = i + 1;
}


const STEPS = ['current', 'scenario', 'results'];
function showPanel(n) {
  STEPS.forEach((x, i) => {
    $('#' + x + 'Panel').classList.toggle('is-active', x === n);
    const st = $(`.step[data-step="${x}"]`);
    st.classList.toggle('is-active', x === n);
    st.classList.toggle('is-done', i < STEPS.indexOf(n) || (x === 'results' && hasResults && n !== 'results'));
  });
  window.scrollTo(0, 0);
  if (n === 'results' && hasResults) renderTrend();   
}



function pickChange(list) {
  return list.slice().reverse().find(x => x.type !== 'shift') || list[list.length - 1];
}
function oncePerSlot(list) {
  const bySlot = new Map();
  list.forEach(x => { const a = bySlot.get(x.id) || []; a.push(x); bySlot.set(x.id, a); });
  return Array.from(bySlot.values()).map(pickChange);
}
// Slot identity stays fixed during a swap; compare the final slot with the original slot.
function sameChannelState(a, b) {
  return !!a && !!b && a.name === b.name && a.g === b.g && a.no === b.no
    && ALL_METRICS.every(m => a[m.key] === b[m.key])
    && AUDIENCE_COLS.every(([key]) => audienceOf(a)[key] === audienceOf(b)[key]);
}
function changeMeta(c, entries = changes, baseline = base) {
  if (sameChannelState(c, baseline.find(x => x.no === c.no))) return { cls: '', label: '', badge: '' };
  const own = entries.filter(x => x.id === c.id);
  
  const ch = pickChange(own);
  if (!ch) return { cls: '', label: '', badge: '' };
  
  if (ch.type === 'pp') return { cls: 'is-pp', label: 'PP사 변경', badge: 'is-pp' };
  if (ch.type === 'swap') {
    const no = Math.max(1, Math.min(MAX_SWAPS, ch.swapNo || 1)), role = ch.swapRole === 'counterpart' ? 'counterpart' : 'target';
    return { cls: `is-swap pair-${no} ${role === 'counterpart' ? 'is-counterpart' : ''}`, label: `교환 ${no} · ${role === 'target' ? '첫 채널' : '맞바꿀 채널'}`, badge: `pair-${no}` };
  }
  if (ch.type === 'new') return { cls: 'is-new', label: '신규 채널', badge: 'is-new' };
  return { cls: 'is-shift', label: '번호 이동', badge: 'is-shift' };
}
function changeGroup(c) {
  const own = changes.filter(x => x.id === c.id);
  if (own.some(x => x.type === 'swap')) return 1;
  if (own.some(x => x.type === 'pp')) return 2;
  if (own.some(x => x.type === 'new' || x.type === 'shift')) return 3;
  return 4;
}
function scenarioRole(c) {
  if (mode !== 'swap') return '';
  if (selectionPhase === 'counterpart' && c.id === selectedId) return 'is-role-target';
  if (c.id === swapTargetId) return 'is-role-counterpart';
  return '';
}
function tile(c, opts = {}) {
  const meta = opts.meta || (opts.scenario ? changeMeta(c) : { cls: '', label: '' });
  const role = opts.scenario && !opts.readonly ? scenarioRole(c) : '';
  const roleLabel = role === 'is-role-target' ? '첫 채널 선택 중' : role === 'is-role-counterpart' ? '맞바꿀 채널' : '';
  const badge = roleLabel ? `<span class="tile__badge" style="--pair:var(--brand)">${roleLabel}</span>` : meta.label ? `<span class="tile__badge">${meta.label}</span>` : '';
  
  const vv = opts.after ? (valueView === 'scenario' ? 'tobe' : valueView) : 'compare';
  const score = opts.after ? (vv === 'asis' ? (opts.before ?? c.composite) : opts.after.composite) : c.composite;
  const scoreText = opts.isNew && vv === 'asis' ? '—' : f1(score);
  
  const dual = opts.after && vv === 'compare' && opts.before !== undefined
    ? `<span class="tile__dual">${opts.isNew ? '—' : f1(opts.before)} <i>→</i> ${f1(opts.after.composite)}</span>` : '';
  const lift = opts.lift !== undefined && vv !== 'asis' ? `<span class="tile__lift ${opts.lift > 0 ? 'is-up' : opts.lift < 0 ? 'is-down' : ''}">${opts.lift ? signed(opts.lift) : f1(score)}</span>` : '';
  const tag = opts.readonly && !opts.selectable ? 'div' : 'button';
  return `<${tag} ${tag === 'button' ? 'type="button"' : ''} ${opts.selectable ? `aria-pressed="${trend.channelId === c.id}" aria-label="${esc(c.name)} ${c.no}번 이벤트 전후 추이 보기"` : ''} class="tile ${opts.selectable && trend.channelId === c.id ? 'is-result-selected' : ''} ${!opts.scenario && !opts.readonly && selectedId === c.id ? 'is-selected' : ''} ${meta.cls} ${role}" style="--genre:${genreColor(c.g)}" data-id="${c.id}" title="${esc(c.name)} · ${c.g}">
    <div class="tile__top"><span class="tile__no">${c.no}</span>${lift || `<span class="tile__score">${scoreText}</span>`}</div>
    <div class="tile__name">${esc(c.name)}</div>
    <div class="tile__genre">${dual || c.g}</div>${opts.current ? currentTileAudience(c) : tileAudience(c, opts)}${badge}
  </${tag}>`;
}



const DETAIL_METRICS = [
  { key: 'viewUV', label: '시청UV', desc: '만', unit: '만', full: '시청UV (만)', tip: '채널 시청UV · 예시 환산값', audience: true },
  { key: 'dwellHours', label: '체류시간', desc: '시간 · 평균', unit: '시간', full: '평균 체류시간', tip: 'UV당 평균 체류시간 (시간)', audience: true },
  COMPOSITE, ...METRICS
];
const detailValue = (c, m) => m.audience ? audienceOf(c)[m.key] : c[m.key];
const detailNumber = (m, n) => m.audience ? currentAudienceNumber(m.key, n) : f1(n);
const detailDisplay = (m, n) => detailNumber(m, n) + (m.unit ? ' ' + m.unit : '');
function detailBar(c, m) {
  const max = m.audience ? Math.max(...base.map(x => detailValue(x, m)), 1e-6) : 100;
  return Math.max(0, Math.min(100, detailValue(c, m) / max * 100));
}
const CURRENT_CHART_METRICS = DETAIL_METRICS.filter(m => m.audience);
let baseTrend = { days: 7, metric: 'viewUV' };
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d; };
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function trendSeries(endV, tag, metricKey, N) {
  const seed = hash('base' + tag + metricKey + N), out = [];
  for (let d = -N; d <= 0; d++) {
    const noise = ((hash(String(seed + d)) % 100) / 100 - .5) * endV * .01;
    out.push({ d, v: endV + noise + Math.sin(d / (N / 2.2)) * endV * .008 });
  }
  return out;
}

function filtered() {
  const q = $('#channelSearch').value.trim().toLowerCase(), g = $('#genreFilter').value, sort = $('#sortOrder').value;
  const list = base.filter(c => (g === 'all' || c.g === g) && (!q || c.name.toLowerCase().includes(q) || String(c.no).includes(q)));
  return list.sort((a, b) => sort === 'scoreDesc' ? b.composite - a.composite : sort === 'scoreAsc' ? a.composite - b.composite : ord(a.no) - ord(b.no));
}
// Page 1 uses the reference display precision; underlying values stay unchanged across all pages.
function currentAudienceNumber(key, value) {
  return formatAbsolute(value, key === 'viewUV' ? 1 : 2);
}
function currentAudienceCells(c) {
  return AUDIENCE_COLS.map(([key]) => `<td class="audience-cell">${currentAudienceNumber(key, audienceOf(c)[key])}</td>`).join('');
}
function currentTileAudience(c) {
  return `<div class="tile__aud">${[['viewUV','UV','만'],['dwellHours','체류','시간']].map(([key,label,unit]) => `<span><em>${label}</em>${currentAudienceNumber(key, audienceOf(c)[key])}<small>${unit}</small></span>`).join('')}</div>`;
}
function currentEmptyPage() {
  const group = channelPageGroups(filtered())[pages.current - 1];
  return `<div class="range-empty">${ic('search', 'i i--lg')}<strong>${channelPageRange ? esc(group.label) + '에 ' : ''}조회되는 채널이 없습니다</strong><span>${channelPageRange ? '범위·검색 조건을 변경하세요.' : '검색어나 장르 조건을 바꿔 보세요.'}</span>${channelPageRange ? '<button class="btn btn--sm btn--ghost" type="button" data-current-range-reset>범위 초기화</button>' : ''}</div>`;
}

const currentCols = () => [['order', '순서'], ['no', '번호'], ['name', '채널명'], ['genre', '장르'], ...AUDIENCE_COLS, ...TABLE_METRICS.map(m => [m.key, abbr(m)])];
function channelSortVal(c, key, meta = { label: '' }) {
  if (key === 'order') return ord(c.no);
  if (key === 'no') return c.no;
  if (key === 'name') return c.name;
  if (key === 'genre') return c.g;
  if (key === 'change') return meta.label || '변경 없음';
  if (AUDIENCE_COLS.some(([k]) => k === key)) return audienceOf(c)[key];
  return c[key] ?? '';
}
function renderChannels() {
  const list = filtered();
  const { start, items } = pageWindow('current', list);
  const tableList = sortRows(items, 'current', (c, k) => channelSortVal(c, k));
  const gridOrder = $('#sortOrder').value;
  const gridItems = gridOrder === 'channel' ? items : items.slice().sort((a, b) => gridOrder === 'scoreDesc' ? b.composite - a.composite : a.composite - b.composite);
  $('#channelGrid').innerHTML = gridItems.map(c => tile(c, { current: true })).join('') || currentEmptyPage();
  const tb = $('#channelTable');
  tb.innerHTML = tableList.map((c, i) => `<tr class="${selectedId === c.id ? 'is-selected' : ''}" data-id="${c.id}"><td>${list.indexOf(c) + 1}</td><td><b>${c.no}</b></td><td><b>${esc(c.name)}</b></td><td><i class="genre-dot" style="background:${genreColor(c.g)}"></i>${c.g}</td>${currentAudienceCells(c)}${TABLE_METRICS.map(m => `<td><span class="bar"><i style="width:${c[m.key]}%"></i></span>${f1(c[m.key])}</td>`).join('')}</tr>`).join('');
  if (!items.length) tb.innerHTML = `<tr><td colspan="${currentCols().length}" >${currentEmptyPage()}</td></tr>`;
  renderHead('current', currentCols(), tb);
  
  renderDetail();
}



function sparkControls() {
  const per = [[7, '일주일'], [30, '한 달']];
  return `<div class="spark__ctl">
    <select class="select select--sm" id="baseTrendMetric" aria-label="추이 지표">${CURRENT_CHART_METRICS.map(x => `<option value="${x.key}" ${x.key === baseTrend.metric ? 'selected' : ''}>${x.label} (${x.unit})</option>`).join('')}</select>
    <div class="seg seg--sm" id="baseTrendPeriod" role="tablist">${per.map(([d, l]) => `<button class="${baseTrend.days === d ? 'is-on' : ''}" data-days="${d}" type="button">${l}</button>`).join('')}</div>
  </div>`;
}
function sparkline(c) {
  const m = CURRENT_CHART_METRICS.find(x => x.key === baseTrend.metric) || CURRENT_CHART_METRICS[0], N = baseTrend.days, avgV = base.reduce((sum, item) => sum + detailValue(item, m), 0) / base.length;
  const pts = trendSeries(detailValue(c, m), c.name, m.key, N), avgPts = trendSeries(avgV, '', m.key, N);
  
  const W = 240, H = 104, padY = 10;
  const vals = [...pts, ...avgPts].map(p => p.v), vmin = Math.min(...vals), vmax = Math.max(...vals), span = (vmax - vmin) || 1;
  const x = d => ((d + N) / N) * W;
  const y = v => padY + (1 - (v - (vmin - span * .18)) / (span * 1.36)) * (H - padY * 2);
  const line = ps => ps.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const per = N === 7 ? '최근 일주일' : '최근 한 달';
  const baseDate = $('#baseDate').value || ymd(yesterday());
  const [year, month, day] = baseDate.split('-').map(Number);
  const dateAt = offset => ymd(new Date(year, month - 1, day + offset));
  const dateTicks = N === 7 ? [-7, -5, -3, 0] : [-30, -20, -10, 0];
  
  const selV = detailValue(c, m), diff = selV - avgV;
  return `<div class="spark">
    <div class="spark__head">
      <b class="spark__now">${detailNumber(m, selV)}<small>${m.unit}</small></b>
      <span class="spark__gap ${diff >= 0 ? 'is-up' : 'is-down'}">평균 ${detailNumber(m, avgV)} 대비 ${diff >= 0 ? '↑' : '↓'} ${detailNumber(m, Math.abs(diff))}</span>
    </div>
    <div class="spark__plot">
      <div class="spark__tooltip" id="sparkTooltip" role="tooltip" hidden><strong></strong><span data-channel-value></span><span data-average-value></span></div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" tabindex="0" aria-describedby="sparkTooltip" aria-label="${esc(c.name)}의 ${per} (${fmtDate(dateAt(-N))}–${fmtDate(baseDate)}) ${esc(m.label)} 추이 ${detailDisplay(m, selV)} · 평균 ${detailDisplay(m, avgV)}. 좌우 방향키로 날짜별 값 확인">
        <defs><linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-opacity=".16"/><stop offset="1" stop-opacity="0"/></linearGradient></defs>
        <path class="spark__area" d="${line(pts)} L${W},${H} L0,${H} Z"/>
        <path class="avgline" d="${line(avgPts)}" vector-effect="non-scaling-stroke"/>
        <path class="asis" d="${line(pts)}" vector-effect="non-scaling-stroke"/>
        ${pts.map((p, i) => {
          const px = x(p.d), left = Math.max(0, px - W / N / 2), right = Math.min(W, px + W / N / 2);
          return `<g class="spark__point" data-date="${fmtDate(dateAt(p.d))}" data-channel="${esc(c.name)} · ${esc(m.label)} ${detailDisplay(m, p.v)}" data-average="평균 · ${esc(m.label)} ${detailDisplay(m, avgPts[i].v)}">
            <g class="spark__marker"><line class="spark__guide" x1="${px}" x2="${px}" y1="0" y2="${H}"/><circle class="spark__dot" cx="${px}" cy="${y(p.v)}" r="3"/><circle class="spark__dot spark__dot--avg" cx="${px}" cy="${y(avgPts[i].v)}" r="3"/></g>
            <rect class="spark__hit" x="${left}" y="0" width="${right - left}" height="${H}"/>
          </g>`;
        }).join('')}
      </svg>
      <div class="spark__dates">${dateTicks.map(d => `<span style="left:${(d + N) / N * 100}%" title="${fmtDate(dateAt(d))}">${dateAt(d).slice(5).replace('-', '.')}</span>`).join('')}</div>
    </div>
    <div class="spark__cap"><span><i></i>이 채널</span><span><i class="avg"></i>평균</span></div>
    <div class="spark__note">기준일 ${fmtDate($('#baseDate').value || ymd(yesterday()))}</div>
  </div>`;
}
function bindSparkHover(selector = '#channelDetail .spark__plot') {
  const plot = $(selector); if (!plot) return;
  const svg = $('svg', plot), tooltip = $('.spark__tooltip', plot), points = $$('.spark__point', plot);
  let active = points.length - 1;
  const show = index => {
    active = Math.max(0, Math.min(points.length - 1, index));
    points.forEach((point, i) => point.classList.toggle('is-active', i === active));
    const point = points[active];
    $('strong', tooltip).textContent = point.dataset.date;
    $('[data-channel-value]', tooltip).textContent = point.dataset.channel;
    $('[data-average-value]', tooltip).textContent = point.dataset.average;
    tooltip.hidden = false;
    const available = plot.clientWidth - tooltip.offsetWidth;
    tooltip.style.left = `${Math.max(0, Math.min(available, (point.dataset.position === undefined ? active / (points.length - 1) : Number(point.dataset.position)) * plot.clientWidth - tooltip.offsetWidth / 2))}px`;
  };
  const hide = () => { tooltip.hidden = true; points.forEach(point => point.classList.remove('is-active')); };
  points.forEach((point, i) => point.addEventListener('pointerenter', () => show(i)));
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('focus', () => show(active));
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', event => {
    if (event.key === 'Escape') { hide(); return; }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    show(event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : active + (event.key === 'ArrowLeft' ? -1 : 1));
  });
}
function renderDetail() {
  const c = byId(selectedId);
  $('#channelDetail').innerHTML = !c
    ? `<div class="empty-side">${ic('compass', 'i i--lg')}<strong>채널을 선택하세요</strong><span>채널의 가치 지표가 표시됩니다.</span></div>`
    : `<div class="detail">
        <div><div class="detail__kicker">선택 채널</div><div class="detail__title"><b>${esc(c.name)}</b><span class="detail__no">${c.no}</span></div><div class="detail__genre"><i style="background:${genreColor(c.g)}"></i>${c.g}</div></div>
        <div class="trendbox">${sparkControls()}${sparkline(c)}</div>
        <div class="scores">${DETAIL_METRICS.map(m => `<div class="score ${m.audience ? 'score--aud' : m.key === 'composite' ? 'score--composite' : ''}"><div class="score__lbl"><span>${m.audience ? `${m.label} (${m.unit})` : `${abbr(m)} · ${m.desc}`}</span><b>${detailNumber(m, detailValue(c, m))}</b></div><div class="score__track"><i style="width:${detailBar(c, m)}%"></i></div></div>`).join('')}</div>

        <button class="btn btn--primary btn--block" type="button" id="detailToScenario">이 채널로 시나리오 만들기</button>
      </div>`;
  bindSparkHover();
  const b = $('#detailToScenario'); if (b) b.addEventListener('click', () => startScenario('swap'));
  const ms = $('#baseTrendMetric'); if (ms) ms.addEventListener('change', e => { baseTrend.metric = CURRENT_CHART_METRICS.some(m => m.key === e.target.value) ? e.target.value : 'viewUV'; renderDetail(); });
  $$('#baseTrendPeriod button').forEach(x => x.addEventListener('click', () => { baseTrend.days = +x.dataset.days === 30 ? 30 : 7; renderDetail(); }));
}
function selectChannel(id) { selectedId = id; renderChannels(); }
function resetAll() {
  channelPageRange = null; syncPageRangeControls();
  
  selectedId = DEFAULT_SELECTED; work = base.map(x => ({ ...x })); changes = []; swapScenarios = []; ppScenarios = []; ops = []; autoApplyPending = false; hasResults = false; resultRun = null; resultsStale = false;
  pages.current = pages.scenario = pages.results = 1;
  $('#channelSearch').value = ''; $('#genreFilter').value = 'all'; $('#sortOrder').value = 'channel';
  renderChannels(); renderBuilder(); renderScenario(); renderResults();
  toast('조회 조건과 시나리오를 초기화했습니다.');
}


function startScenario(m = 'swap') {
  swapTargetId = null; selectionPhase = 'counterpart';
  pageFor('scenario', selectedId, work);
  setMode(m); showPanel('scenario');
}
function setMode(m) {
  const prev = mode; mode = m;
  if (m === 'new' || m === 'pp') { autoApplyPending = false; swapTargetId = null; }
  else if (prev !== 'swap') { swapTargetId = null; selectionPhase = 'counterpart'; }
  $$('.mode-tab').forEach(x => x.classList.toggle('is-on', x.dataset.mode === m));
  $('#swapFields').hidden = m !== 'swap';
  $('#newFields').hidden = m !== 'new';
  $('#ppFields').hidden = m !== 'pp';                 
  renderBuilder(); renderScenario();
}

function renderBuilder() {
  if (!byId(selectedId, work)) selectedId = work[0].id;
  if (swapTargetId === selectedId || !byId(swapTargetId, work)) swapTargetId = null;
  const chooseTarget = mode === 'swap' && selectionPhase === 'target', limit = swapCount() >= MAX_SWAPS;
  const opt = c => `<option value="${c.id}">${c.no} · ${esc(c.name)} · ${c.g}</option>`;
  const tsel = $('#targetChannelSelect');
  tsel.innerHTML = (chooseTarget ? '<option value="">첫 채널을 선택하세요</option>' : '') + work.map(opt).join('');
  tsel.value = chooseTarget ? '' : selectedId;
  tsel.disabled = limit;
  const ssel = $('#swapChannel');
  ssel.innerHTML = `<option value="">${chooseTarget ? '먼저 첫 채널을 선택하세요' : '맞바꿀 채널을 선택하면 자동 반영됩니다'}</option>` + work.filter(c => c.id !== selectedId).map(opt).join('');
  ssel.value = swapTargetId || '';
  ssel.disabled = chooseTarget || limit || autoApplyPending;
  $('#similarChannel').innerHTML = work.map(c => `<option value="${c.id}">${c.no} · ${esc(c.name)}</option>`).join('');
  renderPpFields();

  const newCount = changes.filter(x => x.type === 'new').length;
  
  
  $('#mixTag').textContent = `PP사 변경 ${ppCount()}/${MAX_PP} · 교환 ${swapCount()}/${MAX_SWAPS} · 신규 ${newCount}/${MAX_NEW}`;
  const guide = $('#selectionGuide'), setStep = (id, st) => { $('#' + id).className = 'flow__step' + (st ? ' ' + st : ''); };
  const target = byId(selectedId, work), counter = byId(swapTargetId, work), count = swapCount();
  $('#swapFlowCount').textContent = `${count}/${MAX_SWAPS}건`;
  if (limit) {
    guide.textContent = `교환 ${MAX_SWAPS}쌍 완료`;
    setStep('flowTarget', 'is-done'); setStep('flowCounterpart', 'is-done'); setStep('flowApply', 'is-done');
    $('#flowTargetName').textContent = `${MAX_SWAPS}건 완료`; $('#flowCounterpartName').textContent = `${MAX_SWAPS}건 완료`; $('#flowApplyState').textContent = '반영 완료';
  } else if (autoApplyPending && counter) {
    guide.textContent = `${count + 1}번 교환안 반영 중 · ${target.name} ⇄ ${counter.name}`;
    setStep('flowTarget', 'is-done'); setStep('flowCounterpart', 'is-done'); setStep('flowApply', 'is-active');
    $('#flowTargetName').textContent = target.name; $('#flowCounterpartName').textContent = counter.name; $('#flowApplyState').textContent = '반영 중…';
  } else if (selectionPhase === 'target') {
    guide.textContent = `첫 채널을 선택하세요.`;
    setStep('flowTarget', 'is-active'); setStep('flowCounterpart', ''); setStep('flowApply', '');
    $('#flowTargetName').textContent = '선택하세요'; $('#flowCounterpartName').textContent = '대기'; $('#flowApplyState').textContent = '선택 즉시';
  } else {
    guide.textContent = `맞바꿀 채널을 선택하면 즉시 반영됩니다.`;
    setStep('flowTarget', 'is-done'); setStep('flowCounterpart', 'is-active'); setStep('flowApply', '');
    $('#flowTargetName').textContent = target ? target.name : '선택됨'; $('#flowCounterpartName').textContent = '선택하세요'; $('#flowApplyState').textContent = '선택 즉시';
  }
}
function changeScenarioTarget(id) {
  if (!id || swapCount() >= MAX_SWAPS) return;
  selectedId = id; pageFor('scenario', id, work); swapTargetId = null; selectionPhase = 'counterpart';
  renderBuilder(); renderScenario();
}
function queueSwapApply() {
  if (autoApplyPending || !swapTargetId) return;
  autoApplyPending = true; renderBuilder(); renderScenario();
  setTimeout(() => { if (!autoApplyPending || mode !== 'swap') return; autoApplyPending = false; applySwap(); }, 180);
}
function changeSwapTarget(id) {
  if (!id) { swapTargetId = null; renderBuilder(); renderScenario(); return; }
  if (swapCount() >= MAX_SWAPS) return;
  swapTargetId = id; queueSwapApply();
}
function selectScenarioChannel(id) {
  if (mode !== 'swap' || autoApplyPending) return;
  if (swapCount() >= MAX_SWAPS) { toast(`교환안 ${MAX_SWAPS}쌍이 완료되었습니다. 시뮬레이션을 실행하세요.`); return; }
  if (selectionPhase === 'counterpart') {
    if (id === selectedId) { toast('첫 채널과 다른 채널을 선택하세요.'); return; }
    swapTargetId = id; queueSwapApply();
  } else { selectedId = id; swapTargetId = null; selectionPhase = 'counterpart'; renderBuilder(); renderScenario(); }
}

const HOME_GENRES = ['데이터홈쇼핑', '라이브홈쇼핑'];
const isHome = c => HOME_GENRES.includes(c.g);

function homeNeighbor(no, list = work) {
  const arr = list.slice().sort((a, b) => ord(a.no) - ord(b.no));
  const i = arr.findIndex(c => c.no === no);
  if (i < 0) return null;
  return [arr[i - 1], arr[i + 1]].find(c => c && isHome(c)) || null;
}
function renderPpFields() {
  const ss = $('#ppSlot'); if (!ss) return;
  const list = work.slice().sort((a, b) => ord(a.no) - ord(b.no));
  const keepS = ss.value;
  ss.innerHTML = list.map(c => `<option value="${c.id}">${c.no}번 · ${esc(c.name)} · ${c.g}</option>`).join('');
  if (list.some(c => c.id === keepS)) ss.value = keepS;
  const ps = $('#ppNew'), keepP = ps.value;
  ps.innerHTML = list.filter(c => c.id !== ss.value)
    .map(c => `<option value="${c.id}">${esc(c.name)} · ${c.g} · 현재 ${c.no}번</option>`).join('');
  if (ps.querySelector(`option[value="${keepP}"]`)) ps.value = keepP;
  const limit = ppCount() >= MAX_PP;
  $('#ppApplyBtn').disabled = limit;
  $('#ppHint').textContent = limit
    ? `최대 ${MAX_PP}건 · 변경안을 취소한 뒤 추가하세요.`
    : '선택 번호의 채널을 교체합니다. 가져올 채널의 원래 번호는 유지됩니다.';
}

function primPp(slotId, srcId) {
  const slot = byId(slotId, work), src = byId(srcId, work);
  if (!slot || !src || slot.id === src.id) return null;
  const oldName = slot.name, oldG = slot.g, ppNo = ppScenarios.length + 1;
  slot.name = src.name; slot.g = src.g;
  ALL_METRICS.forEach(m => { slot[m.key] = src[m.key]; });
  Object.assign(slot, audienceOf(src));
  const home = homeNeighbor(slot.no);
  changes.push({ id: slot.id, no: slot.no, before: oldName, after: src.name, type: 'pp', ppNo });
  ppScenarios.push({ slotId: slot.id, no: slot.no, oldName, oldG, newName: src.name, newG: src.g,
    homeId: home ? home.id : null, homeName: home ? home.name : '' });
  return { slot, src, oldName, ppNo, home };
}
function applyPpChange() {
  if (ppCount() >= MAX_PP) { toast(`채널 PP사 변경은 최대 ${MAX_PP}건까지 가능합니다.`); return; }
  const r = primPp($('#ppSlot').value, $('#ppNew').value);
  if (!r) { toast('바꿀 채널과 가져올 PP사를 다르게 고르세요.'); return; }
  ops.push({ kind: 'pp', slotId: r.slot.id, srcId: r.src.id });
  staleResults();
  selectedId = r.slot.id; pageFor('scenario', r.slot.id, work);
  renderBuilder(); renderScenario();
  toast(`${r.slot.no}번을 ${r.oldName} 에서 ${r.src.name}${ro(r.src.name)} 바꿨습니다.`);
}



function primSwap(aId, bId) {
  const slotA = byId(aId, work), slotB = byId(bId, work);
  if (!slotA || !slotB || slotA.id === slotB.id) return null;
  const swapNo = swapScenarios.length + 1;
  const nameA = slotA.name, gA = slotA.g, nameB = slotB.name, gB = slotB.g;
  slotA.name = nameB; slotA.g = gB;
  slotB.name = nameA; slotB.g = gA;
  ALL_METRICS.forEach(m => { const t = slotA[m.key]; slotA[m.key] = slotB[m.key]; slotB[m.key] = t; });
  const audienceA = audienceOf(slotA), audienceB = audienceOf(slotB);
  Object.assign(slotA, audienceB); Object.assign(slotB, audienceA);
  
  const pair = [{ id: slotA.id, no: slotA.no, before: nameA, after: nameB, type: 'swap', swapNo, swapRole: 'target' }, { id: slotB.id, no: slotB.no, before: nameB, after: nameA, type: 'swap', swapNo, swapRole: 'counterpart' }];
  changes.push(...pair);
  swapScenarios.push({ sourceId: slotA.id, targetId: slotB.id, sourceNo: slotA.no, targetNo: slotB.no, sourceName: nameA, targetName: nameB, sourceBefore: nameA, sourceAfter: nameB, targetBefore: nameB, targetAfter: nameA });
  return { pair, swapNo, source: slotA, target: slotB, a: slotA.no, b: slotB.no };
}
function applySwap() {
  if (swapCount() >= MAX_SWAPS) { toast(`채널 교환은 한 시나리오에서 최대 ${MAX_SWAPS}쌍까지 가능합니다.`); return; }
  const r = primSwap(selectedId, swapTargetId);
  if (!r) { toast('첫 채널과 맞바꿀 채널을 선택하세요.'); return; }
  const { pair, swapNo, source, target, a, b } = r;
  ops.push({ kind: 'swap', aId: source.id, bId: target.id });
  staleResults();
  
  swapTargetId = null; selectionPhase = 'target';
  renderBuilder(); renderScenario();
  toast(`${a}번과 ${b}번의 채널서비스ID를 맞바꿨습니다(교환 ${swapNo}). 다음 첫 채널을 선택하세요.`);
}
function addNewChannel(preset, opId) {
  
  if (!preset && changes.filter(x => x.type === 'new').length >= MAX_NEW) {
    toast(`신규 채널 추가는 한 시나리오에서 최대 ${MAX_NEW}건까지 가능합니다. 추가한 신규 채널을 지우고 다시 넣으세요.`); return null;
  }
  const name = preset ? preset.name : $('#newName').value.trim(),
        g = preset ? preset.g : $('#newGenre').value,
        posText = preset ? String(preset.pos) : $('#newPosition').value.trim(),
        pos = Number(posText),
        similar = byId(preset ? preset.similarId : $('#similarChannel').value, work);
  
  
  if (!name || posText === '' || !Number.isInteger(pos) || pos < 0 || pos > 999 || !similar) {
    if (!preset) {
      toast(!name ? '신규 채널명을 입력하세요.'
        : posText === '' ? '신규 채널 번호를 입력하세요.'
        : !Number.isInteger(pos) ? `채널 번호는 숫자로 입력하세요. (입력값 「${posText}」)`
        : (pos < 0 || pos > 999) ? `채널 번호는 0~999 사이여야 합니다. (입력값 ${pos})`
        : '가장 유사한 기준 채널을 선택하세요.');
    }
    return null;
  }
  
  const rmIdx = work.findIndex(c => c.no === pos), replaced = rmIdx >= 0 ? work[rmIdx] : null;
  if (replaced) {
    work.splice(rmIdx, 1);
    
    changes = changes.filter(x => x.id !== replaced.id);
    // Preserve operation records for undo and pair numbering; final rows use work + changes.
  }
  const id = opId || ('new-' + Date.now()), fresh = { id, g, name, no: pos, originalNo: null };
  
  const ratio = { svi: .92, cpi: .95, zpi: .9 };
  METRICS.forEach(m => { fresh[m.key] = +(similar[m.key] * (ratio[m.key] || .93)).toFixed(1); });
  fresh.composite = composite(fresh);
  const similarAudience = audienceOf(similar);
  fresh.viewers = Math.round(similarAudience.viewers * .9);
  fresh.watchSeconds = Math.round(similarAudience.watchSeconds * .9);
  fresh.viewUV = similarAudience.viewUV * .9;
  fresh.dwellHours = fresh.viewUV > 0 ? fresh.watchSeconds / (fresh.viewUV * 10000) / 3600 : 0;
  work.push(fresh); work.sort((a, b) => ord(a.no) - ord(b.no));
  
  const entries = [{ id, no: pos, before: replaced ? replaced.name : '신규', after: name, type: 'new', replacedName: replaced ? replaced.name : '' }];
  changes.push(...entries);
  selectedId = id; pageFor('scenario', id, work);
  if (preset) return id;                                
  ops.push({ kind: 'new', id, name, g, pos, similarId: similar.id });
  $('#newName').value = ''; $('#newPosition').value = '';
  renderBuilder(); renderScenario();
  staleResults();
  toast(replaced ? `${pos}번을 ${replaced.name} 에서 신규 채널 「${name}」${ro(name)} 바꿨습니다.`
    : `${pos}번에 신규 채널 「${name}」을 추가했습니다.`);
  return id;
}


function rebuildFromOps() {
  const list = ops.slice();
  work = base.map(x => ({ ...x })); changes = []; swapScenarios = []; ppScenarios = []; ops = [];
  
  const dropped = [];
  list.forEach(op => {
    if (op.kind === 'pp') { if (primPp(op.slotId, op.srcId)) ops.push(op); else dropped.push(op); }
    else if (op.kind === 'swap') { if (primSwap(op.aId, op.bId)) ops.push(op); else dropped.push(op); }
    else if (addNewChannel({ name: op.name, g: op.g, pos: op.pos, similarId: op.similarId }, op.id)) ops.push(op);
    else dropped.push(op);
  });
  if (!byId(selectedId, work)) selectedId = DEFAULT_SELECTED;
  swapTargetId = null; selectionPhase = 'counterpart'; autoApplyPending = false;
  if (hasResults) resultsStale = true;
  hasResults = false; resultRun = null;
  return dropped;
}
function removeOp(index) {
  if (index < 0 || index >= ops.length) return;
  const gone = ops[index];
  ops.splice(index, 1);
  const dropped = rebuildFromOps();
  renderBuilder(); renderScenario(); renderResults();
  
  const KIND = { swap: '교환', pp: 'PP사 변경', new: '신규 채널' };
  const also = dropped.length
    ? ` 이 자리를 쓰던 ${Array.from(new Set(dropped.map(o => KIND[o.kind] || '변경'))).join('·')} ${dropped.length}건도 함께 취소되었습니다.`
    : '';
  
  toast((gone.kind === 'swap' ? '교환 한 건을 취소했습니다.'
    : gone.kind === 'pp' ? 'PP사 변경 한 건을 취소했습니다.'
    : `신규 채널 「${gone.name}」을 취소했습니다.`) + also);
}

function staleResults() {
  if (!hasResults) return;
  hasResults = false; resultRun = null; resultsStale = true;
  renderResults();
}
function clearScenario() {
  work = base.map(x => ({ ...x })); changes = []; swapScenarios = []; ppScenarios = []; ops = []; autoApplyPending = false; hasResults = false; resultRun = null; resultsStale = false;
  selectedId = DEFAULT_SELECTED; swapTargetId = null; selectionPhase = 'counterpart'; pages.scenario = pages.results = 1;
  renderBuilder(); renderScenario(); renderResults();
  toast('임시 변경안을 초기화했습니다.');
}
const scenarioCols = () => [['order', '순서'], ['no', '번호'], ['name', '채널명'], ['genre', '장르'], ...AUDIENCE_COLS, ['change', '변경 구분'], ...TABLE_METRICS.map(m => [m.key, abbr(m)])];
function renderScenario() {
  const yes = changes.length > 0;
  $('#runBtn').disabled = !yes;
  const list = work.slice().sort((a, b) => ord(a.no) - ord(b.no));
  const { start, items } = pageWindow('scenario', list);
  const tableList = sortRows(items, 'scenario', (c, k) => channelSortVal(c, k, changeMeta(c)));
  
  $('#scenarioGrid').innerHTML = items.map(c => tile(c, { scenario: true })).join('') || '<div class="range-empty">이 페이지 범위에 조회되는 채널이 없습니다.</div>';
  const tb = $('#scenarioTable');
  tb.innerHTML = tableList.map((c, i) => {
    const meta = changeMeta(c), role = scenarioRole(c);
    const label = role === 'is-role-target' ? '선택 중 · 첫 채널' : role === 'is-role-counterpart' ? '선택 중 · 맞바꿀 채널' : meta.label || '변경 없음';
    const cls = role ? 'is-role' : meta.badge || 'is-none';
    return `<tr data-id="${c.id}"><td>${start + i + 1}</td><td><b>${c.no}</b></td><td><b>${esc(c.name)}</b></td><td><i class="genre-dot" style="background:${genreColor(c.g)}"></i>${c.g}</td>${audienceCells(c)}<td><span class="rolebadge ${cls}">${label}</span></td>${TABLE_METRICS.map(m => `<td>${m.key === 'composite' ? `<b>${f1(c[m.key])}</b>` : f1(c[m.key])}</td>`).join('')}</tr>`;
  }).join('');
  if (!items.length) tb.innerHTML = `<tr><td colspan="${scenarioCols().length}" class="range-empty">이 페이지 범위에 조회되는 채널이 없습니다.</td></tr>`;
  renderHead('scenario', scenarioCols(), tb);
  setView('scenario', views.scenario);

  
  const newItems = changes.filter(x => x.type === 'new');
  
  let swapSeen = 0, newSeen = 0, ppSeen = 0;
  $('#changeList').innerHTML = ops.length ? ops.map((op, k) => {
    if (op.kind === 'pp') {
      const sc = ppScenarios[ppSeen++]; if (!sc) return '';
      const home = sc.homeName ? `<div class="change__row change__row--home"><span class="change__role">옆 홈쇼핑</span><b>${esc(sc.homeName)}</b><span class="arrow">가치 변화 확인</span></div>` : '';
      return `<div class="change change--pp"><span class="change__no">${ppSeen}</span><div class="change__body">
        <div class="change__row"><span class="change__role">${sc.no}번</span><b>${esc(sc.newName)}</b><span class="arrow">${esc(sc.oldName)} 에서 변경</span></div>${home}</div>
        <button class="change__del" type="button" data-undo="${k}" aria-label="${sc.no}번 PP사 변경 취소" title="이 PP사 변경 취소">${ic('x')}</button></div>`;
    }
    if (op.kind === 'swap') {
      const sc = swapScenarios[swapSeen++]; if (!sc) return '';
      return `<div class="change pair-${swapSeen}"><span class="change__no">${swapSeen}</span><div class="change__body">
        <div class="change__row"><span class="change__role">첫 채널</span><b>${sc.sourceNo}번</b><span class="arrow">${esc(sc.sourceBefore)} → ${esc(sc.sourceAfter)}</span></div>
        <div class="change__row"><span class="change__role">맞바꿀</span><b>${sc.targetNo}번</b><span class="arrow">${esc(sc.targetBefore)} → ${esc(sc.targetAfter)}</span></div></div>
        <button class="change__del" type="button" data-undo="${k}" aria-label="${swapSeen}번 교환 취소" title="이 교환 취소">${ic('x')}</button></div>`;
    }
    newSeen += 1;
    const c = byId(op.id, work), entry = changes.find(x => x.id === op.id && x.type === 'new');
    return `<div class="change change--new"><span class="change__no">+</span><div class="change__body">
      <div class="change__row"><span class="change__role">신규 ${newSeen}</span><b>${esc(c ? c.name : op.name)}</b><span class="arrow">${entry ? entry.no : op.pos}번${c && entry && c.no !== entry.no ? ` · 현재 ${c.no}번` : ''}</span></div></div>
      <button class="change__del" type="button" data-undo="${k}" aria-label="신규 채널 ${esc(op.name)} 취소" title="이 신규 채널 취소">${ic('x')}</button></div>`;
  }).join('') : '<div class="changes__empty">변경안이 없습니다.</div>';
  $$('#changeList [data-undo]').forEach(b => b.addEventListener('click', () => removeOp(+b.dataset.undo)));
}


const RUN_STAGES = [500, 700, 1500, 500];   
let runToken = 0, runStart = 0, runTick = null;
function runSimulation() {
  if (!changes.length) { toast('먼저 변경안을 적용하세요.'); return; }
  const token = ++runToken, modal = $('#runModal'), stages = $$('#runStages li');
  $('#runProgress').hidden = false; $('#runFail').hidden = true;
  $('#runBaseDate').textContent = fmtDate($('#baseDate').value);
  modal.hidden = false;
  runStart = Date.now();
  stages.forEach(li => { li.className = ''; });
  $('#runBar').style.width = '0%'; $('#runElapsed').textContent = '0초';
  clearInterval(runTick); runTick = setInterval(() => { $('#runElapsed').textContent = `${Math.round((Date.now() - runStart) / 1000)}초`; }, 500);
  let t = 0;
  RUN_STAGES.forEach((ms, i) => {
    setTimeout(() => {
      if (token !== runToken) return;
      stages.forEach((li, j) => { li.className = j < i ? 'is-done' : j === i ? 'is-active' : ''; });
      $('#runBar').style.width = `${Math.round((i / RUN_STAGES.length) * 100)}%`;
      if (i === 2 && failOnce) { failOnce = false; runToken++; setTimeout(failRun, 900); }
    }, t);
    t += ms;
  });
  setTimeout(() => { if (token === runToken) completeRun(); }, t);
}
function failRun() {
  clearInterval(runTick);
  $('#runProgress').hidden = true; $('#runFail').hidden = false;
  recordHistory('실행', changes, historySummary(changes, $('#baseDate').value), '실패');
}
function completeRun() {
  clearInterval(runTick);
  $$('#runStages li').forEach(li => { li.className = 'is-done'; }); $('#runBar').style.width = '100%';
  hasResults = true; resultsStale = false;
  sorts.results = { ...sorts.scenario }; pages.results = pages.scenario;
  resultRun = { baseline: base.map(x => ({ ...x })), sort: { ...sorts.scenario }, page: pages.scenario, range: channelPageRange ? { ...channelPageRange } : null, time: Date.now(), baseDate: $('#baseDate').value, changes: changes.map(x => ({ ...x })), swapScenarios: swapScenarios.map(x => ({ ...x })), ppScenarios: ppScenarios.map(x => ({ ...x })), work: work.map(x => ({ ...x })) };
  const entry = recordHistory('실행', changes, historySummary(changes, resultRun.baseDate), '성공', resultRun);
  resultRun.id = entry.id;
  setTimeout(() => { $('#runModal').hidden = true; renderResults(); showPanel('results'); renderEntryNotice(); toast('시뮬레이션이 완료되었습니다.'); }, 350);
}
function closeRun() { runToken++; clearInterval(runTick); $('#runModal').hidden = true; }


// Every result view, total, chart and CSV uses the same immutable run projection.
const runProjectionCache = new WeakMap();
function projection(c, run = resultRun) {
  let cache = runProjectionCache.get(run);
  if (!cache) { cache = new Map(); runProjectionCache.set(run, cache); }
  if (cache.has(c.id)) return cache.get(c.id);
  const baseline = run.baseline || base;
  const before = baseline.find(x => x.no === c.no);
  const unchanged = sameChannelState(c, before);
  const ch = unchanged ? null : pickChange(run.changes.filter(x => x.id === c.id));
  const lift = ch ? (ch.type === 'shift' ? .35 : 1.3 + (hash(c.name) % 24) / 10) : 0;
  const after = { ...c, ...audienceOf(c) };
  if (lift) {
    METRICS.forEach(m => { after[m.key] = +(c[m.key] * (1 + lift * m.liftFactor)).toFixed(2); });
    after.composite = composite(after);
    const audience = audienceOf(c), audienceRates = viewDelta(c, lift);
    after.viewers = Math.round(audience.viewers * (1 + audienceRates.viwr / 100));
    after.watchSeconds = Math.round(audience.watchSeconds * (1 + audienceRates.stm / 100));
    after.viewUV = audience.viewUV * (1 + audienceRates.viwr / 100);
    after.dwellHours = after.viewUV > 0 ? after.watchSeconds / (after.viewUV * 10000) / 3600 : 0;
  }
  const p = { c, src: before || c, hasBefore: !!before, beforeNo: before ? before.no : '신규', beforeName: before ? before.name : '신규 입점', lift, ciLow: lift ? lift - .8 : 0, ciHigh: lift ? lift + 1 : 0, after, change: ch };
  cache.set(c.id, p);
  return p;
}

function lineupImpact(run = resultRun) {
  const direct = run.changes.filter(x => x.type !== 'shift');
  return Math.min(3.8, .7 + direct.length * .63 + Math.min(run.changes.length, 8) * .08);
}
function audienceLift(before, after) { return before > 0 ? (after / before - 1) * 100 : null; }
// Round only displayed result metrics; keep channel numbers, counts and source values unchanged.
function resultNumber(value) {
  const rounded = reportNumber(value);
  return rounded === '' ? '—' : formatAbsolute(Number(rounded), 2);
}
function resultSigned(value) {
  return (Number(reportNumber(value)) > 0 ? '+' : '') + resultNumber(value);
}
const liftText = rate => rate === null ? '산출 불가' : `${resultSigned(rate)}%`;
function audienceRunSummary(run) {
  const projections = run.work.map(c => projection(c, run));
  const before = { viewUV: 0, dwellHours: 0 }, after = { viewUV: 0, dwellHours: 0 };
  const baseline = run.baseline || base;
  baseline.forEach(c => { const a = audienceOf(c); before.viewUV += a.viewUV; before.dwellHours += a.dwellHours; });
  projections.forEach(p => { after.viewUV += p.after.viewUV; after.dwellHours += p.after.dwellHours; });
  before.dwellHours /= baseline.length || 1; after.dwellHours /= projections.length || 1;
  return { before, after, projections, beforeCount: baseline.length, afterCount: projections.length };
}
function renderAudienceTotals(run) {
  const sum = audienceRunSummary(run);
  for (const [key, prefix, unit, digits] of [['viewUV','uv','만',2],['dwellHours','dwell','시간',2]]) {
    const b = sum.before[key], a = sum.after[key], rate = audienceLift(b,a);
    $(`#${prefix}TotalLift`).textContent = liftText(rate);
    $(`#${prefix}TotalValues`).textContent = `${resultNumber(b)} → ${resultNumber(a)} ${unit}`;
    $(`#${prefix}TotalDelta`).textContent = `증감 ${resultSigned(a-b)} ${unit}`;
  }
}
function channelAudienceComparison(p, key) {
  const before = p.beforeNo === '신규' ? null : audienceOf(p.src)[key], after = p.after[key];
  return { before, after, delta: before === null ? null : after-before, rate: before === null ? null : audienceLift(before,after) };
}
function renderResults() {
  $('#noResults').hidden = hasResults; $('#resultsContent').hidden = !hasResults;
  
  if (!hasResults) {
    const em = $('#noResults');
    em.querySelector('strong').textContent = resultsStale ? '변경안이 바뀌어 이전 결과를 내렸습니다' : '시뮬레이션 결과가 없습니다';
    em.querySelector('span').textContent = resultsStale ? '바뀐 변경안으로 다시 실행하세요.' : '';
    em.querySelector('span').hidden = !resultsStale;
    return;
  }
  const run = resultRun, impact = lineupImpact(run);
  const runKey = String(run.id || run.time);
  if (trendRunKey !== runKey) {
    trend.channelId = null; trendRunKey = runKey;
    $('#resultChannelSearch').value = '';
    $('#resultGenreFilter').innerHTML = '<option value="all">전체 장르</option>' + [...new Set(run.work.map(c => c.g))].map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
    const sort = sorts.results;
    $('#resultSortOrder').value = sort.key === 'order' ? 'channel' : sort.key === 'composite' ? (sort.dir === 'asc' ? 'scoreAsc' : 'scoreDesc') : 'custom';
  }
  $('#resultTitle').textContent = `시나리오 결과 · PP사 변경 ${(run.ppScenarios || []).length}건 · 교환 ${run.swapScenarios.length}쌍 · 신규 ${run.changes.filter(x => x.type === 'new').length}건`;
  $('#resultMeta').textContent = `기준일자 ${fmtDate(run.baseDate)} · 실행 ${fmtTime(run.time)}`;
  renderCond(run);
  renderAudienceTotals(run);
  const affected = oncePerSlot(run.changes).map((x, i) => { const c = byId(x.id, run.work); return c && projection(c, run).change ? { ...x, c, lift: x.type === 'shift' ? (.2 + (i % 4) * .14) : (1.3 + (hash(c.name) % 24) / 10) } : null; }).filter(Boolean);
  const uvRates = run.work.map(c => channelAudienceComparison(projection(c,run),'viewUV').rate).filter(v => v !== null);
  const improved = uvRates.filter(v => v > .000001).length, declined = uvRates.filter(v => v < -.000001).length;
  $('#improvedCount').textContent = improved + '개';
  $('#declinedCount').textContent = declined + '개';
  $('#improvedCount').classList.toggle('is-up', improved > 0);
  $('#declinedCount').classList.toggle('is-down', declined > 0);
  const dwellRates = run.work.map(c => channelAudienceComparison(projection(c, run), 'dwellHours').rate).filter(v => v !== null);
  const dwellImproved = dwellRates.filter(v => v > .000001).length, dwellDeclined = dwellRates.filter(v => v < -.000001).length;
  $('#dwellImprovedCount').textContent = dwellImproved + '개';
  $('#dwellDeclinedCount').textContent = dwellDeclined + '개';
  $('#dwellImprovedCount').classList.toggle('is-up', dwellImproved > 0);
  $('#dwellDeclinedCount').classList.toggle('is-down', dwellDeclined > 0);
  $('#changeCountTag').textContent = affected.length + '개 영향';
  $('#impactList').innerHTML = affected.map(x => {
    const meta = changeMetaIn(x.c, run), p = projection(x.c, run);
    const uv = channelAudienceComparison(p,'viewUV'), dwell = channelAudienceComparison(p,'dwellHours');
    return `<div class="impact__row ${meta.badge}" data-trend-id="${x.c.id}" role="button" tabindex="0" aria-label="${esc(x.c.name)} 이벤트 전후 추이 보기"><div class="impact__name"><strong>${esc(x.c.name)}</strong><span>${x.c.g} · ${meta.label || '인접 영향'}</span>
      </div><div class="impact__pos">${x.c.no}번 · ${esc(p.beforeName)} → <b>${esc(x.c.name)}</b></div>
      <div class="audience-lift-pair"><span>시청UV Lift <b>${liftText(uv.rate)}</b></span><span>체류시간 Lift <b>${liftText(dwell.rate)}</b></span></div>${impactAbsoluteTable(p)}</div>`;
  }).join('');

  renderZones(run);
  renderGrades(run);

  $('#trendMetric').innerHTML = CURRENT_CHART_METRICS.map(m => `<option value="${m.key}" ${m.key === trend.metric ? 'selected' : ''}>${m.label} · ${m.desc}</option>`).join('');
  renderTrend();
  renderResultsChannels();
}


// % 표시를 유지하면서 같은 비율로 환산한 기준값·예상값·증감을 함께 제공한다.
function rateAmounts(before, rate, digits = 0) {
  const b = +before.toFixed(digits), after = +(b * (1 + rate / 100)).toFixed(digits);
  return { before: b, after, delta: +(after - b).toFixed(digits), rate, digits };
}
function formatAbsolute(value, digits = 0) { return Number(value).toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
function signedAbsolute(value, digits = 0) { return (value > 0 ? '+' : '') + formatAbsolute(value, digits); }
function rateCells(value, rate, digits = 0) {
  const after = value * (1 + rate / 100), a = { before: value, after, delta: after - value }, cls = a.delta > 0 ? 'is-up' : a.delta < 0 ? 'is-down' : '';
  return `<td>${resultNumber(a.before)}</td><td><b>${resultNumber(a.after)}</b></td><td class="${cls}">${resultSigned(a.delta)}</td><td class="${cls}">${liftText(rate)}</td>`;
}
function liftRange(c, low, high) { return [c.composite * (1 + low / 100), c.composite * (1 + high / 100)].map(v => +v.toFixed(2)); }
const dwellRate = (uvRate, secondsRate) => ((1 + secondsRate / 100) / (1 + uvRate / 100) - 1) * 100;
function impactAbsoluteTable(p) {
  return `<div class="impact-absolute-wrap"><table class="impact-absolute"><thead><tr><th>지표</th><th>변경 전</th><th>변경 후 예상</th><th>증감</th><th>Lift</th></tr></thead><tbody>${[['viewUV','시청UV Lift (만)',2],['dwellHours','체류시간 Lift (시간)',2]].map(([key,label,digits]) => {
    const v = channelAudienceComparison(p,key);
    return `<tr><th>${label}</th><td>${resultNumber(v.before)}</td><td><b>${resultNumber(v.after)}</b></td><td>${v.delta === null ? '—' : resultSigned(v.delta)}</td><td>${liftText(v.rate)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}
function zoneAbsoluteCells(r) {
  const a = audienceOf(r.c);
  return rateCells(a.viewUV, r.viwr, 2) + rateCells(a.dwellHours, dwellRate(r.viwr, r.stm), 2);
}

function viewDelta(c, lift) {
  const seed = (hash(c.name + 'uv') % 100) / 100;
  const viwr = +(lift * (.78 + seed * .5)).toFixed(1);
  return { viwr, stm: +(viwr * (.62 + seed * .5)).toFixed(1) };
}


const ZONE_SPAN = 5;
function zoneRows(anchorNo, run, excludeIds) {
  const list = run.work.slice().sort((a, b) => ord(a.no) - ord(b.no));
  const i = list.findIndex(c => c.no === anchorNo);
  if (i < 0) return [];
  const rows = [];
  for (let d = -ZONE_SPAN; d <= ZONE_SPAN; d++) {
    const c = list[i + d];
    if (!c || d === 0 || excludeIds.has(c.id)) continue;
    
    const near = (ZONE_SPAN + 1 - Math.abs(d)) / ZONE_SPAN;
    const dir = d < 0 ? .85 : 1;
    const seed = (hash(c.name + anchorNo) % 100) / 100;
    const viwr = +(near * dir * (1.1 + seed * 1.6)).toFixed(1);
    rows.push({ c, d, viwr, stm: +(viwr * (.62 + seed * .5)).toFixed(1) });
  }
  return rows;
}
function renderZones(run) {
  const el = $('#zoneList'); if (!el) return;
  
  const direct = run.changes.filter(x => x.type !== 'shift');
  const excludeIds = new Set(direct.map(x => x.id));
  const seen = new Set(), zones = [];
  direct.forEach(x => {
    const c = byId(x.id, run.work); if (!c || seen.has(c.no)) return;
    seen.add(c.no);
    const sc = (run.swapScenarios || []).find(s => s.sourceId === x.id || s.targetId === x.id);
    const pp = x.type === 'pp' ? (run.ppScenarios || []).find(s => s.slotId === x.id) : null;
    zones.push({
      no: c.no, name: c.name,
      why: pp ? `시나리오 1 · PP사 변경${pp.homeName ? ` · 옆 홈쇼핑 ${pp.homeName}` : ''}` : sc ? '시나리오 2 · 채널 교환' : '시나리오 3 · 신규 입점',
      
      homeId: pp ? pp.homeId : null,
      rows: zoneRows(c.no, run, excludeIds)
    });
  });
  $('#zoneCountTag').textContent = `${zones.length}개 구간`;
  
  zones.forEach(z => { if (z.homeId) z.rows.sort((a, b) => (b.c.id === z.homeId) - (a.c.id === z.homeId)); });
  el.innerHTML = zones.length ? zones.map(z => `<div class="zone">
    <div class="zone__head"><b>${z.no}번 ${esc(z.name)}</b><span>${esc(z.why)}</span><span class="zone__range">${z.rows.length ? `${z.rows[0].c.no}번 ~ ${z.rows[z.rows.length - 1].c.no}번` : '인접 채널 없음'}</span></div>
    <div class="zone-table-scroll"><table class="zone__tbl"><thead><tr><th rowspan="2" scope="col">번호</th><th rowspan="2" scope="col">채널명</th><th rowspan="2" scope="col">거리</th><th colspan="4" scope="colgroup">시청UV (만)</th><th colspan="4" scope="colgroup">체류시간 (시간)</th></tr><tr>${['시청UV','체류시간'].map(() => '<th scope="col">기준값</th><th scope="col">예상값</th><th scope="col">증감</th><th scope="col">변화율</th>').join('')}</tr></thead>
    <tbody>${z.rows.map(r => `<tr class="${r.c.id === z.homeId ? 'is-home' : ''}"><td>${r.c.no}</td><td>${esc(r.c.name)}${r.c.id === z.homeId ? '<span class="zone__tag">기준 홈쇼핑</span>' : ''}</td><td>${r.d > 0 ? '+' : ''}${r.d}</td>
      ${zoneAbsoluteCells(r)}</tr>`).join('')}</tbody></table></div>
  </div>`).join('') : '<div class="changes__empty">직접 바뀐 채널이 없어 주위 영향을 낼 구간이 없습니다.</div>';
}


function renderCond(run) {
  const el = $('#resultCond'); if (!el) return;
  const label = id => { const c = byId(id, run.work); return c ? `${c.no}번 ${c.name}` : '채널'; };
  const parts = [];
  
  run.swapScenarios.forEach(sc => { parts.push(`${sc.sourceNo}번 ↔ ${sc.targetNo}번 교환 (${sc.sourceName} ↔ ${sc.targetName})`); });
  run.changes.filter(x => x.type === 'new').forEach(x => { parts.push(`${label(x.id)} 신규 편성`); });
  const shifts = run.changes.filter(x => x.type === 'shift').length;
  el.innerHTML = parts.length
    
    ? `<b>테스트 조건</b> ${parts.map(p => `<span class="cond__item">${esc(p)}</span>`).join('')}${shifts ? ` <small>(번호 순차 이동 ${shifts}개 포함)</small>` : ''}`
    : '<b>테스트 조건</b> 변경 없음';
}


function renderGrades(run) {
  
  const rows = oncePerSlot(run.changes).slice(0, 8).map(x => {
    const c = byId(x.id, run.work); if (!c) return null;
    const p = projection(c, run); if (!p.change) return null;
    const gb = p.hasBefore ? gradeOf(p.src.composite) : '—', ga = gradeOf(p.after.composite);
    const moved = gb !== ga;
    const note = x.type === 'new' ? `신규 편성 · ${x.no}번 진입, 유사 채널 대비 보수 추정`
      : x.type === 'shift' ? `번호 이동 ${x.before} → ${x.after} · 인접 재핑 흐름 변화`
      : x.type === 'pp' ? `PP사 변경 ${p.beforeName} → ${c.name} · 자리는 그대로, 채널서비스ID 교체`
      : `채널 교환 ${p.beforeName} → ${c.name} · 번호는 그대로, 채널서비스ID 교환`;
    return { c, gb, ga, moved, note, lift: p.lift };
  }).filter(Boolean);
  $('#gradeCountTag').textContent = rows.length + '개';
  $('#gradeList').innerHTML = rows.length ? rows.map(r =>
    `<div class="grade ${r.moved ? 'is-moved' : ''}">
      <div class="grade__ch"><strong>${esc(r.c.name)}</strong><span>${r.c.g} · ${r.c.no}번</span></div>
      <div class="grade__move"><span class="grade__tag is-before">${r.gb}</span><i>→</i><span class="grade__tag ${r.moved ? 'is-after' : 'is-before'}">${r.ga}</span></div>
    </div>`).join('') : '<p class="empty-line">변경된 채널이 없습니다.</p>';
}

function changeMetaIn(c, run) {
  return changeMeta(c, run.changes, run.baseline || base);
}

const resultCols = () => [['order', '순서'], ['no', '번호'], ['before', '변경 전 채널'], ['name', '변경 후 채널'], ['genre', '변경 후 장르'], ...AUDIENCE_COLS, ['change', '변경 구분'], ...TABLE_METRICS.map(m => [m.key, abbr(m)])];
function resultSortVal(row, key) {
  const { c, p } = row;
  if (key === 'order') return ord(c.no);
  if (key === 'no') return c.no;
  if (key === 'before') return p.beforeName;
  if (key === 'name') return c.name;
  if (key === 'genre') return c.g;
  if (key === 'change') return row.meta.label || '변경 없음';
  return resultValue(p, key) ?? null;
}
function filteredResults() {
  if (!resultRun) return [];
  const q = $('#resultChannelSearch').value.trim().toLowerCase(), g = $('#resultGenreFilter').value;
  const order = $('#resultSortOrder').value;
  return resultRun.work.filter(c => (g === 'all' || c.g === g) && (!q || c.name.toLowerCase().includes(q) || projection(c).beforeName.toLowerCase().includes(q) || String(c.no).includes(q)))
    .sort((a, b) => order === 'scoreDesc' ? projection(b).after.composite - projection(a).after.composite : order === 'scoreAsc' ? projection(a).after.composite - projection(b).after.composite : ord(a.no) - ord(b.no));
}
function updateResultFilters() {
  pages.results = 1;
  const first = channelPageGroups(filteredResults()).findIndex(group => group.items.length);
  if (first >= 0) pages.results = first + 1;
  renderResultsChannels();
}
function renderResultsChannels() {
  if (!hasResults) return;
  const run = resultRun, list = filteredResults();
  const { start, items } = pageWindow('results', list);
  const rows = items.map(c => ({ c, p: projection(c, run), meta: changeMetaIn(c, run) }));
  const tableRows = sortRows(rows, 'results', resultSortVal);
  

  const tb = $('#resultsTable');
  tb.innerHTML = tableRows.map(({ c, p, meta }, i) => `<tr data-id="${c.id}" tabindex="0" aria-selected="${trend.channelId === c.id}" class="${trend.channelId === c.id ? 'is-selected' : ''}" aria-label="${esc(c.name)} ${c.no}번 이벤트 전후 추이 보기"><td>${start + i + 1}</td><td><b>${c.no}</b></td><td>${esc(p.beforeName)}</td><td><b>${esc(c.name)}</b></td><td><i class="genre-dot" style="background:${genreColor(c.g)}"></i>${c.g}</td>${audienceComparison(p)}<td><span class="rolebadge ${meta.badge || 'is-none'}">${meta.label || '변경 없음'}</span></td>${TABLE_METRICS.map(m => `<td>${m.key === 'composite' ? '<b>' : ''}${resultValueText(p, m.key)}${m.key === 'composite' ? '</b>' : ''}</td>`).join('')}</tr>`).join('');
  if (!items.length) {
    tb.innerHTML = `<tr><td colspan="${resultCols().length}" class="range-empty">조회되는 채널이 없습니다. 조회 조건을 변경하세요.</td></tr>`;
  }
  renderHead('results', resultCols(), tb);
  setView('results', views.results);
}


function selectResultTrend(id, reveal = false) {
  if (!hasResults || !resultRun) return;
  if (id && !byId(id, resultRun.work)) return;
  trend.channelId = id || null;
  if (reveal) setResultSectionExpanded($('#resultTrendTitle').closest('.result-section'), true);
  renderTrend(); renderResultsChannels();
  if (reveal) {
    const title = $('#resultTrendTitle');
    title.closest('.card').scrollIntoView({ behavior: 'instant', block: 'start' });
    title.focus({ preventScroll: true });
  }
}
function renderTrend() {
  if (!hasResults || !resultRun) return;
  const c = trend.channelId ? byId(trend.channelId, resultRun.work) : null;
  if (!c) trend.channelId = null;
  const p = c ? projection(c, resultRun) : null;
  const isNew = p && p.beforeNo === '신규';
  const m = CURRENT_CHART_METRICS.find(x => x.key === trend.metric) || CURRENT_CHART_METRICS[0], N = trend.days;
  trend.metric = m.key;
  const chartValue = value => `${resultNumber(value)} ${m.unit}`;
  const summary = audienceRunSummary(resultRun);
  const divisorBefore = m.key === 'viewUV' ? summary.beforeCount : 1;
  const divisorAfter = m.key === 'viewUV' ? summary.afterCount : 1;
  const baseV = p ? audienceOf(p.src)[m.key] : summary.before[m.key] / (divisorBefore || 1);
  const afterV = p ? p.after[m.key] : summary.after[m.key] / (divisorAfter || 1);
  const channelLabel = c ? `${c.no}번 ${c.name}` : '전체 평균';
  $('#resultTrendChannel').innerHTML = '<option value="">전체 평균</option>' + resultRun.work.slice().sort((a,b) => ord(a.no)-ord(b.no)).map(x => `<option value="${esc(x.id)}">${x.no} · ${esc(x.name)}</option>`).join('');
  $('#resultTrendChannel').value = trend.channelId || '';
  $('#resultTrendTitle').textContent = '이벤트 전/후 추이 비교';
  $('#resultTrendDescription').textContent = c ? (isNew ? '신규 · 변경 전 데이터 없음' : `${c.no}번 기준: ${p.beforeName} → ${c.name}`) : '';
  $('#resultTrendDescription').hidden = !c;
  $('#resultTrendSummary').innerHTML = `<span><b>${esc(m.label)}</b> · 기준일 ${fmtDate(resultRun.baseDate)}</span><span>변경 전 <b>${isNew ? '—' : chartValue(baseV)}</b> → 변경 후 예상 <b>${chartValue(afterV)}</b></span>`;
  const el = $('#trendChart'), W = Math.max(480, el.clientWidth), H = 260, padL = 58, padR = 28, padT = 16, padB = 32;
  const seed = hash((c ? c.name + c.no : 'lineup') + m.key + N), pts = [];
  for (let d = -N; d <= N; d++) {
    const noise = d === 0 || d === N ? 0 : (((hash(String(seed + d)) % 100) / 100 - .5) * baseV * .008 + Math.sin(d / (N / 2.5)) * baseV * .006);
    const asis = isNew ? null : baseV + noise;
    const ramp = d <= 0 ? 0 : Math.min(1, d / Math.max(2, N * .3));
    const tobe = isNew ? (d < 0 ? null : afterV + noise) : asis + (afterV - baseV) * ramp;
    pts.push({ d, asis, tobe, lo: tobe === null ? null : tobe * (1 - .011 * ramp), hi: tobe === null ? null : tobe * (1 + .013 * ramp) });
  }
  const vals = pts.flatMap(p => [p.asis, p.hi, p.lo]).filter(v => v !== null), vmin = Math.min(...vals), vmax = Math.max(...vals), span = (vmax - vmin) || 1;
  const x = d => padL + ((d + N) / (2 * N)) * (W - padL - padR);
  const y = v => padT + (1 - (v - (vmin - span * .15)) / (span * 1.3)) * (H - padT - padB);
  const path = key => pts.filter(p => p[key] !== null).map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  const band = pts.filter(p => p.d >= 0);
  const bandPath = band.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(p.hi).toFixed(1)}`).join(' ') + ' ' + band.slice().reverse().map(p => `L${x(p.d).toFixed(1)},${y(p.lo).toFixed(1)}`).join(' ') + ' Z';
  const ticks = 4, yTicks = Array.from({ length: ticks + 1 }, (_, i) => vmin - span * .15 + (span * 1.3) * i / ticks);
  const [year, month, day] = resultRun.baseDate.split('-').map(Number);
  const dateAt = offset => ymd(new Date(year, month - 1, day + offset));
  const xTicks = N === 7 ? [-7, -5, -3, 0, 3, 5, 7] : [-30, -20, -10, 0, 10, 20, 30];
  const hoverValue = value => value === null ? '데이터 없음' : chartValue(value);
  el.innerHTML = `<div class="trend__legend">${isNew ? '<span>변경 전 데이터 없음</span>' : '<span><i></i>AS-IS 기준 추이</span>'}<span><i class="tobe"></i>TO-BE 예상 추이</span><span><i class="event"></i>이벤트(변경 적용)</span></div>
  <div class="spark__plot">
  <div class="spark__tooltip" id="resultTrendTooltip" role="tooltip" hidden><strong></strong><span data-channel-value></span><span data-average-value></span></div>
  <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" tabindex="0" aria-describedby="resultTrendTooltip" aria-label="${esc(channelLabel)} 이벤트 전후 ${N}일 (${fmtDate(dateAt(-N))}–${fmtDate(dateAt(N))}) ${m.label} 추이 · ${isNew ? '변경 전 없음' : chartValue(baseV)} → ${chartValue(afterV)}. 좌우 방향키로 날짜별 값 확인">
    ${yTicks.map(v => `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="axis" x="${padL - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${resultNumber(v)}</text>`).join('')}
    <path class="tobe-band" d="${bandPath}"/>
    <line class="event" x1="${x(0).toFixed(1)}" x2="${x(0).toFixed(1)}" y1="${padT}" y2="${H - padB}"/>
    <text class="event-lbl" x="${(x(0) + 6).toFixed(1)}" y="${padT + 12}">변경 적용</text>
    ${isNew ? '' : `<path class="asis" d="${path('asis')}"/>`}
    <path class="tobe" d="${path('tobe')}"/>
    ${pts.map(point => {
      const px = x(point.d), half = (W - padL - padR) / (2 * N) / 2;
      const left = Math.max(padL, px - half), right = Math.min(W - padR, px + half);
      return `<g class="spark__point" data-position="${px / W}" data-date="${fmtDate(dateAt(point.d))}${point.d === 0 ? ' · 변경 적용' : ''}" data-channel="AS-IS · ${esc(m.label)} ${hoverValue(point.asis)}" data-average="TO-BE · ${esc(m.label)} ${hoverValue(point.tobe)}">
        <g class="spark__marker"><line class="spark__guide" x1="${px}" x2="${px}" y1="${padT}" y2="${H - padB}"/>
          ${point.asis === null ? '' : `<circle class="spark__dot spark__dot--avg" cx="${px}" cy="${y(point.asis)}" r="4"/>`}
          ${point.tobe === null ? '' : `<circle class="spark__dot" cx="${px}" cy="${y(point.tobe)}" r="4"/>`}
        </g>
        <rect class="spark__hit" x="${left}" y="${padT}" width="${right - left}" height="${H - padT - padB}"/>
      </g>`;
    }).join('')}
  </svg>
  <div class="spark__dates" style="margin-left:${padL / W * 100}%;margin-right:${padR / W * 100}%">${xTicks.map(d => `<span style="left:${(d + N) / (2 * N) * 100}%" title="${fmtDate(dateAt(d))}">${dateAt(d).slice(5).replace('-', '.')}</span>`).join('')}</div>
  </div>`;
  bindSparkHover('#trendChart .spark__plot');
}


function saveHistory() {
  history = history.slice(0, 50);
  try { localStorage.setItem(STORE.history, JSON.stringify(history)); } catch (e) {  }
  renderHistory();
}

function historySummary(entries, baseDate) {
  const count = entries.filter(x => (x.changeType || x.type) !== 'shift').length;
  return `${count}개 채널 변경 · 기준일 ${fmtDate(baseDate)}`;
}

function recordHistory(type, entries, summary, status = '성공', run = null) {
  const details = entries.map(x => { const c = byId(x.id, work) || byId(x.id, base); return { no: x.no ?? (c ? c.no : ''), name: c ? c.name : '미확인 채널', genre: c ? c.g : '', before: x.before, after: x.after, changeType: x.type }; });
  
  const item = { id: Date.now(), time: new Date().toISOString(), baseDate: $('#baseDate').value, type, summary, status, details, scenario: ops.map(o => ({ ...o })), run: run ? { baseline: run.baseline, sort: run.sort, page: run.page, range: run.range, time: run.time, baseDate: run.baseDate, changes: run.changes, swapScenarios: run.swapScenarios, ppScenarios: run.ppScenarios, work: run.work } : null };
  history.unshift(item); saveHistory();
  return item;
}
function renderHistory() {
  $('#historyBadge').textContent = history.length;
  
  const cls = s => s === '성공' ? 'is-done' : 'is-fail';
  $('#historyList').innerHTML = history.length ? history.map(h => `<div class="history__item">
      <div><div class="history__type">실행일</div><div class="history__time">${fmtTime(h.time)}</div></div>
      <div class="history__body"><strong>${esc(h.summary)}</strong><span>${h.details.slice(0, 3).map(d => `${d.no}번 ${esc(String(d.before))}→${esc(String(d.after))}`).join(' · ')}${h.details.length > 3 ? ` 외 ${h.details.length - 3}건` : ''}</span></div>
      <div class="history__side"><span class="history__status ${cls(h.status)}">${esc(h.status)}</span>${h.status === '성공' && h.run
        ? `<button class="btn btn--sm" type="button" data-open="${h.id}">결과 보기</button><button class="btn btn--sm btn--ghost" type="button" data-csv="${h.id}">${ic('download')}다운로드</button>`
        : `<button class="btn btn--sm btn--primary" type="button" data-rerun="${h.id}">${ic('reset')}재실행</button>`}</div>
    </div>`).join('') : '<div class="history__empty">아직 실행 이력이 없습니다.</div>';
  $$('#historyList [data-open]').forEach(b => b.addEventListener('click', () => { openResult(+b.dataset.open); $('#historyModal').hidden = true; }));
  $$('#historyList [data-csv]').forEach(b => b.addEventListener('click', () => { const h = history.find(x => x.id === +b.dataset.csv); if (h && h.run) downloadReport(h.run); }));
  $$('#historyList [data-rerun]').forEach(b => b.addEventListener('click', () => rerunFromHistory(+b.dataset.rerun)));
}

function rerunFromHistory(id) {
  const h = history.find(x => x.id === id);
  if (!h || !h.scenario || !h.scenario.length) { toast('다시 돌릴 변경안이 남아 있지 않습니다.'); return; }
  ops = h.scenario.map(o => ({ ...o }));
  rebuildFromOps();
  
  if (h.baseDate) $('#baseDate').value = h.baseDate;
  $('#historyModal').hidden = true;
  renderBuilder(); renderScenario(); showPanel('scenario');
  runSimulation();
}
function openResult(id) {
  const h = history.find(x => x.id === id);
  if (!h || !h.run) return;
  resultRun = { ...h.run, id }; hasResults = true; resultsStale = false;
  work = resultRun.work.map(c => ({ ...c }));
  changes = resultRun.changes.map(c => ({ ...c }));
  swapScenarios = (resultRun.swapScenarios || []).map(c => ({ ...c }));
  ppScenarios = (resultRun.ppScenarios || []).map(c => ({ ...c }));
  ops = h.scenario.map(c => ({ ...c }));
  autoApplyPending = false; swapTargetId = null; selectionPhase = 'target';
  sorts.scenario = { ...(resultRun.sort || { key: 'order', dir: 'asc' }) };
  sorts.results = { ...sorts.scenario };
  pages.scenario = pages.results = resultRun.page || 1;
  channelPageRange = resultRun.range || null; syncPageRangeControls();
  if (h.baseDate) $('#baseDate').value = h.baseDate;
  renderChannels(); renderBuilder(); renderScenario();
  renderResults(); showPanel('results');
}


function renderEntryNotice() {
  const el = $('#entryNotice'), last = history.find(h => h.status === '성공' && h.run);
  el.hidden = !last;
  if (!last) { el.innerHTML = ''; return; }
  el.className = 'notice notice--result';
  el.innerHTML = `<span class="notice__ic">${ic('check', 'i i--lg')}</span><div class="notice__txt"><b>최근 실행 결과</b><span>${fmtTime(last.time)} · ${esc(last.summary)}</span></div>
    <div class="right"><button class="btn btn--sm btn--ghost" type="button" data-act="history">실행 이력</button><button class="btn btn--sm btn--primary" type="button" data-act="open">최근 결과 보기</button></div>`;
  $('[data-act="open"]', el).addEventListener('click', () => openResult(last.id));
  $('[data-act="history"]', el).addEventListener('click', openHistory);
}
function openHistory() { renderHistory(); $('#historyModal').hidden = false; }


const csvCell = v => `"${(v === null || v === undefined ? '' : String(v)).replace(/"/g, '""')}"`;
function downloadCsv(rows, name) {
  const csv = '\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  const a = document.createElement('a'), url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
function reportNumber(value) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  const magnitude = Math.abs(number);
  const rounded = Math.round((magnitude + Number.EPSILON * Math.max(1, magnitude)) * 100) / 100;
  return (number < 0 && rounded ? -rounded : rounded).toFixed(2);
}
function reportChangeType(type) {
  return ({ pp: '1채널PP사변경', swap: '2채널교환', new: '3신규채널입점', shift: '3신규채널입점' })[type] || '변경없음';
}
function buildReportRows(run) {
  const projections = run.work.map(c => projection(c, run));
  const audienceSummary = audienceRunSummary(run), rows = [];
  rows.push(['채널배치 시뮬레이션 보고서'], ['기준일자', fmtDate(run.baseDate)], ['실행 일시', fmtTime(run.time)], ['다운로드 일시', new Date().toLocaleString('ko-KR')], ['채널 수', run.work.length], ['변경 채널 수', run.changes.length], ['전체 시청UV Lift(%)', reportNumber(audienceLift(audienceSummary.before.viewUV,audienceSummary.after.viewUV))], ['평균 체류시간 Lift(%)', reportNumber(audienceLift(audienceSummary.before.dwellHours,audienceSummary.after.dwellHours))], []);
  rows.push(['[시청 지표 변화]'],['지표','변경 전','변경 후 예상','증감','Lift(%)']);
  [['viewUV','시청UV 합산(만)'],['dwellHours','채널 평균 체류시간(시간)']].forEach(([key,label]) => {
    const b=audienceSummary.before[key], a=audienceSummary.after[key]; rows.push([label,...[b,a,a-b,audienceLift(b,a)].map(reportNumber)]);
  });
  rows.push([], ['[변경 내역]'], ['채널번호', '장르', '변경 전 채널', '변경 후 채널', '변경유형']);
  run.changes.forEach(x => { const c = byId(x.id, run.work); rows.push([x.no ?? (c ? c.no : ''), c ? c.g : '', x.before, x.after, reportChangeType(x.type)]); });
  rows.push([], ['[전체 채널 세부 지표]'], ['채널번호', '변경 전 채널', '변경 후 채널', '장르', '변경유형', '시청UV(전, 만)', '시청UV(후, 만)', '체류시간(전, 시간)', '체류시간(후, 시간)', '시청UV 합산(만) Lift(%)', '채널 평균 체류시간(시간) Lift(%)', ...TABLE_METRICS.flatMap(m => [`${m.label}(전)`, `${m.label}(후)`, `${m.label} 증감`])]);
  projections.sort((a, b) => ord(a.c.no) - ord(b.c.no)).forEach(p => rows.push([p.c.no, p.beforeName, p.c.name, p.c.g, reportChangeType(p.change?.type), ...AUDIENCE_COLS.flatMap(([key]) => [p.hasBefore ? reportNumber(audienceOf(p.src)[key]) : '', reportNumber(p.after[key])]), ...['viewUV','dwellHours'].map(key => reportNumber(channelAudienceComparison(p,key).rate)), ...TABLE_METRICS.flatMap(m => [p.hasBefore ? reportNumber(p.src[m.key]) : '', reportNumber(p.after[m.key]), p.hasBefore ? reportNumber(p.after[m.key] - p.src[m.key]) : ''])]));
  rows.push([], ['[주위 ±5 채널 영향률 환산]'], ['변경 지점 번호', '변경 지점 채널', '영향 채널 번호', '영향 채널명', '거리', '시청UV 기준(만)', '시청UV 예상(만)', '시청UV 증감(만)', '시청UV 변화율(%)', '체류시간 기준(시간)', '체류시간 예상(시간)', '체류시간 증감(시간)', '체류시간 변화율(%)']);
  const direct = run.changes.filter(x => x.type !== 'shift'), excluded = new Set(direct.map(x => x.id)), seen = new Set();
  direct.forEach(change => { const anchor = byId(change.id, run.work); if (!anchor || seen.has(anchor.no)) return; seen.add(anchor.no); zoneRows(anchor.no, run, excluded).forEach(r => { const a=audienceOf(r.c); rows.push([anchor.no,anchor.name,r.c.no,r.c.name,r.d,...[['viewUV',r.viwr],['dwellHours',dwellRate(r.viwr,r.stm)]].flatMap(([key,pct])=>{const before=a[key], after=before*(1+pct/100);return [before,after,after-before,pct].map(reportNumber);})]); }); });
  return rows;
}
function downloadReport(run = resultRun) {
  if (!run) return;
  downloadCsv(buildReportRows(run), `channel-placement-report_${new Date(run.time).toISOString().slice(0, 16).replace(/[-T:]/g, '')}.csv`);
  toast(`전체 채널 ${run.work.length}개의 지표 변화와 변경 내역을 내려받았습니다.`);
}


// Collapse only section contents; paging, sorting and result data remain intact.
function setResultSectionExpanded(section, expanded) {
  if (!section) return;
  const button = section.querySelector(':scope > .card__head > .result-section-toggle');
  const content = section.querySelector(':scope > .result-section-content');
  if (!button || !content) return;
  content.hidden = !expanded;
  section.classList.toggle('is-collapsed', !expanded);
  button.setAttribute('aria-expanded', String(expanded));
  button.textContent = expanded ? '접기' : '펼치기';
  const title = section.querySelector(':scope > .card__head h2').textContent;
  button.setAttribute('aria-label', `${title} ${button.textContent}`);
}
function initResultSections() {
  $$('#resultsContent section.card').forEach((section, index) => {
    const head = section.querySelector(':scope > .card__head');
    if (!head || head.querySelector('.result-section-toggle')) return;
    section.classList.add('result-section');
    const content = document.createElement('div');
    content.className = 'result-section-content';
    content.id = `result-section-content-${index + 1}`;
    while (head.nextSibling) content.appendChild(head.nextSibling);
    section.appendChild(content);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn--sm btn--ghost result-section-toggle';
    button.setAttribute('aria-controls', content.id);
    head.appendChild(button);
    setResultSectionExpanded(section, !!head.querySelector('#resultSummaryTitle, #resultTrendTitle'));
    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') !== 'true';
      setResultSectionExpanded(section, expanded);
      if (expanded && section.contains($('#trendChart')) && hasResults) renderTrend();
    });
  });
}

function bind() {
  $$('.channel-range').forEach(form => {
    form.addEventListener('submit', event => { event.preventDefault(); applyPageRange(form); });
    $('[data-reset-range]', form).addEventListener('click', resetPageRange);
  });
  syncPageRangeControls();
  const filterChanged = () => { pages.current = 1; const matches = filtered(); const first = channelPageGroups(matches).findIndex(group => group.items.length); if (first >= 0) pages.current = first + 1; renderChannels(); };
  $('#channelSearch').addEventListener('input', filterChanged);
  $('#genreFilter').addEventListener('change', filterChanged);
  $('#sortOrder').addEventListener('change', () => { pages.current = 1; renderChannels(); });
  $('#resetAllBtn').addEventListener('click', resetAll);
  $('#startScenarioBtn').addEventListener('click', () => startScenario('swap'));
  $('#currentPanel').addEventListener('click', e => { if (e.target.closest('[data-current-range-reset]')) resetPageRange(); });
  $('#channelGrid').addEventListener('click', e => { const t = e.target.closest('.tile'); if (t) selectChannel(t.dataset.id); });
  $('#channelTable').addEventListener('click', e => { const t = e.target.closest('tr'); if (t) selectChannel(t.dataset.id); });

  $$('.mode-tab').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  $('#targetChannelSelect').addEventListener('change', e => changeScenarioTarget(e.target.value));
  $('#swapChannel').addEventListener('change', e => changeSwapTarget(e.target.value));
  $('#applyBtn').addEventListener('click', () => addNewChannel());
  $('#ppApplyBtn').addEventListener('click', applyPpChange);
  $('#ppSlot').addEventListener('change', renderPpFields);
  $('#clearScenarioBtn').addEventListener('click', clearScenario);
  $('#runBtn').addEventListener('click', runSimulation);
  $('#backToCurrentBtn').addEventListener('click', () => showPanel('current'));
  $('#scenarioGrid').addEventListener('click', e => { const t = e.target.closest('.tile'); if (t) selectScenarioChannel(t.dataset.id); });
  $('#scenarioTable').addEventListener('click', e => { const t = e.target.closest('tr'); if (t) selectScenarioChannel(t.dataset.id); });

  $('#emptyToScenarioBtn').addEventListener('click', () => showPanel('scenario'));
  $('#editScenarioBtn').addEventListener('click', () => showPanel('scenario'));
  $('#downloadBtn').addEventListener('click', () => downloadReport());
  
  $('#resultChannelSearch').addEventListener('input', updateResultFilters);
  $('#resultGenreFilter').addEventListener('change', updateResultFilters);
  $('#resultSortOrder').addEventListener('change', e => {
    const order = e.target.value;
    if (order === 'custom') return;
    sorts.results = { key: order === 'channel' ? 'order' : 'composite', dir: order === 'scoreDesc' ? 'desc' : 'asc' };
    updateResultFilters();
  });
  $('#resetResultFiltersBtn').addEventListener('click', () => {
    $('#resultChannelSearch').value = ''; $('#resultGenreFilter').value = 'all'; $('#resultSortOrder').value = 'channel';
    sorts.results = { key: 'order', dir: 'asc' }; updateResultFilters();
  });
  $('#resultTrendChannel').addEventListener('change', e => selectResultTrend(e.target.value));
  ['#resultsTable', '#impactList'].forEach(selector => {
    const container = $(selector);
    container.addEventListener('click', e => { const target = e.target.closest('[data-id], [data-trend-id]'); if (target) selectResultTrend(target.dataset.trendId || target.dataset.id, true); });
    container.addEventListener('keydown', e => { const target = e.target.closest('tr[data-id], [data-trend-id]'); if (target && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectResultTrend(target.dataset.trendId || target.dataset.id, true); } });
  });
  $('#trendMetric').addEventListener('change', e => { trend.metric = CURRENT_CHART_METRICS.some(m => m.key === e.target.value) ? e.target.value : 'viewUV'; renderTrend(); });
  $$('#trendPeriod button').forEach(b => b.addEventListener('click', () => { trend.days = +b.dataset.days === 30 ? 30 : 7; $$('#trendPeriod button').forEach(x => x.classList.toggle('is-on', x === b)); renderTrend(); }));
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { renderTrend(); }, 120); });

  $$('.step').forEach(b => b.addEventListener('click', () => showPanel(b.dataset.step)));
  $$('.pager').forEach(p => {
    const scope = p.dataset.scope;
    $$('.pager__btn', p).forEach(b => b.addEventListener('click', () => { pages[scope] = (pages[scope] || 1) + (+b.dataset.dir); renderScope(scope); }));
    $('select', p).addEventListener('change', e => { pages[scope] = +e.target.value || 1; renderScope(scope); });
  });
  $$('.seg[data-view-scope] button').forEach(b => b.addEventListener('click', () => setView(b.closest('.seg').dataset.viewScope, b.dataset.view)));
  
  $('#historyBtn').addEventListener('click', openHistory);
  $('#historyCloseBtn').addEventListener('click', () => { $('#historyModal').hidden = true; });
  $('#historyOkBtn').addEventListener('click', () => { $('#historyModal').hidden = true; });
  $('#historyModal').addEventListener('click', e => { if (e.target.id === 'historyModal') $('#historyModal').hidden = true; });
  $('#runRetryBtn').addEventListener('click', runSimulation);
  $('#runFailEditBtn').addEventListener('click', () => { closeRun(); showPanel('scenario'); });
  
  $('#baseDate').value = ymd(yesterday());
  $('#baseDate').max = ymd(yesterday());
  $('#baseDate').addEventListener('change', e => { if (!e.target.value || e.target.value > ymd(yesterday())) { e.target.value = ymd(yesterday()); toast('기준일자는 전날까지 선택하세요.'); } else { staleResults(); toast(`기준일자를 ${fmtDate(e.target.value)}로 바꿨습니다. `); } renderDetail(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('#historyModal').hidden = true; } });
}
function init() {
  mountIcons();
  $('#genreFilter').innerHTML += GENRES.map(g => `<option value="${g}">${g}</option>`).join('');
  $('#newGenre').innerHTML = GENRES.map(g => `<option value="${g}">${g}</option>`).join('');
  bind(); initResultSections();
  renderChannels(); renderBuilder(); renderScenario(); renderResults(); renderHistory(); renderEntryNotice();
  ['current', 'scenario', 'results'].forEach(s => setView(s, views[s]));
}
init();
})();


