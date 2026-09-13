/* ============================================================
   채널배치 시뮬레이터 — 화면 로직
   · 데이터: channels.js (채널 314개). 지표값·Lift·신뢰구간은 전부 자리표시 더미 — 실서비스에선 모델 응답으로 대체
   · 지표 정의(METRICS)는 한 곳에서만 관리한다. KPI·표·상세·결과·CSV 가 전부 여기서 자동 생성되므로
     모델 Feature 가 늘거나 줄어도 화면 코드는 손대지 않는다
   · 상태 미리보기: ?state=empty (이전 실행 없음 · 초기 안내) · ?state=fail (첫 실행 실패 → 재실행 성공)
   ============================================================ */
(function () {
'use strict';

/* ── 지표 정의 ─────────────────────────────────────────── */
const METRICS = [
  { key: 'svi', label: 'SVI', desc: '위치가치',   weight: .36, seed: [0, 60, 330], liftFactor: .009,  lineupLift: .9 },
  { key: 'cpi', label: 'CPI', desc: '콘텐츠파워', weight: .36, seed: [3, 57, 370], liftFactor: .0045, lineupLift: .45 },
  { key: 'zsi', label: 'ZSI', desc: '재핑시너지', weight: .28, seed: [6, 55, 390], liftFactor: .0118, lineupLift: 1.18 }
];
const COMPOSITE = { key: 'composite', label: '종합지수', desc: '가중 합산' };
const ALL_METRICS = [...METRICS, COMPOSITE];
const FORMULA = '종합지수 = ' + METRICS.map(m => `${m.label} ${Math.round(m.weight * 100)}%`).join(' + ');

const GENRE_COLORS = {
  '데이터홈쇼핑': 'var(--sec-purple)', '라이브홈쇼핑': 'var(--graph-03)', '지상파': 'var(--graph-04)', '종합편성': 'var(--graph-09)',
  '드라마/오락/음악': 'var(--graph-01)', '영화/시리즈': 'var(--graph-02)', '뉴스/경제': 'var(--graph-13)', '스포츠/레저': 'var(--graph-05)',
  '공공/공익/정보': 'var(--graph-10)', '다큐/교양': 'var(--graph-07)', '애니/유아/교육': 'var(--graph-06)', '종교/오픈': 'var(--graph-08)',
  '성인': 'var(--graph-15)', '오디오': 'var(--graph-12)'
};
const PAGE_SIZE = 100;
const MAX_SWAPS = 5;
const STORE = { history: 'cpHistory' };
const URL_STATE = new URLSearchParams(location.search).get('state') || '';

/* ── 유틸 ─────────────────────────────────────────────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const ord = n => n >= 997 ? n - 997 : n + 3;                 /* 997~999 는 0번 앞(가이드·E채널·ENA PLAY) — KT 채널 순서 관례 */
const hash = s => [...s].reduce((a, c) => ((a * 31 + c.charCodeAt(0)) >>> 0), 7);
const val = (s, min, span) => +(min + (s % span) / 10).toFixed(1);
const f1 = n => (+n).toFixed(1);
const signed = n => `${n > 0 ? '+' : ''}${f1(n)}%`;
const genreColor = g => GENRE_COLORS[g] || 'var(--gray-300)';
const composite = c => +METRICS.reduce((s, m) => s + c[m.key] * m.weight, 0).toFixed(1);
const fmtTime = t => new Date(t).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
const fmtDate = d => d ? d.replace(/-/g, '.') : '';

/* Lucide 아이콘 — 원본 패스 인라인 (외부 아이콘 폰트 없이 CSP 환경에서도 동작) */
const ICONS = {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  'chev-left': '<path d="m15 18-6-6 6-6"/>',
  'chev-right': '<path d="m9 18 6-6-6-6"/>',
  reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
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

/* ── 채널 마스터 → 기준 라인업 ─────────────────────────── */
const base = window.CP_CHANNELS.map(([g, name, no], i) => {
  const h = hash(name + no), c = { id: 'ch-' + i, g, name, no, originalNo: no };
  // seed[0]=0 이면 시프트 없이 원값(부호 없는 32bit) — `h >> 0` 은 부호 있는 정수로 바뀌어 KT 초안과 값이 달라진다
  METRICS.forEach(m => { c[m.key] = val(m.seed[0] ? h >> m.seed[0] : h, m.seed[1], m.seed[2]); });
  c.composite = composite(c);
  return c;
}).sort((a, b) => ord(a.no) - ord(b.no));
const GENRES = [...new Set(base.map(c => c.g))];
const byId = (id, list = base) => list.find(x => x.id === id);
const avg = (k, list = base) => list.reduce((s, c) => s + c[k], 0) / list.length;
const DEFAULT_SELECTED = base.find(c => c.no === 8).id;

/* ── 상태 ─────────────────────────────────────────────── */
let work = base.map(x => ({ ...x }));
let changes = [], swapScenarios = [];
let selectedId = DEFAULT_SELECTED, swapTargetId = null, selectionPhase = 'counterpart', autoApplyPending = false, mode = 'swap';
let hasResults = false, resultRun = null, failOnce = URL_STATE === 'fail';
const pages = { current: 1, scenario: 1, results: 1 };
const views = { current: 'grid', scenario: 'grid', results: 'grid' };
const sorts = { current: { key: 'order', dir: 'asc' }, scenario: { key: 'order', dir: 'asc' }, results: { key: 'order', dir: 'asc' } };
let trend = { days: 7, metric: 'composite' };
let history = [];
try { history = URL_STATE === 'empty' ? [] : JSON.parse(localStorage.getItem(STORE.history) || '[]'); } catch (e) { history = []; }

/* ── 토스트 ───────────────────────────────────────────── */
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('is-show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('is-show'), 2400);
}

/* ── 공통: 정렬 · 페이지 · 뷰 ───────────────────────────── */
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
  pages[scope] = 1; renderScope(scope);
}
function pageWindow(scope, total) {
  const max = Math.max(1, Math.ceil(total / PAGE_SIZE));
  pages[scope] = Math.max(1, Math.min(max, pages[scope] || 1));
  const pager = $(`.pager[data-scope="${scope}"]`), sel = $('select', pager);
  sel.innerHTML = Array.from({ length: max }, (_, i) => {
    const a = i * PAGE_SIZE + 1, b = Math.min((i + 1) * PAGE_SIZE, total);
    return `<option value="${i + 1}">${total ? `${a}–${b}번째` : '검색 결과 없음'}</option>`;
  }).join('');
  sel.value = pages[scope];
  $('[data-dir="-1"]', pager).disabled = pages[scope] === 1;
  $('[data-dir="1"]', pager).disabled = pages[scope] === max;
  const start = (pages[scope] - 1) * PAGE_SIZE;
  return { start, end: Math.min(start + PAGE_SIZE, total) };
}
function renderScope(scope) { if (scope === 'current') renderChannels(); else if (scope === 'scenario') renderScenario(); else renderResultsChannels(); }
function setView(scope, v) {
  views[scope] = v;
  $$(`.seg[data-view-scope="${scope}"] button`).forEach(b => b.classList.toggle('is-on', b.dataset.view === v));
  $$(`[data-view-panel^="${scope}:"]`).forEach(p => { p.hidden = p.dataset.viewPanel !== `${scope}:${v}`; });
}
function pageFor(scope, id, list) {
  const i = list.findIndex(c => c.id === id);
  if (i >= 0) pages[scope] = Math.floor(i / PAGE_SIZE) + 1;
}

/* ── 단계 전환 ─────────────────────────────────────────── */
const STEPS = ['current', 'scenario', 'results'];
function showPanel(n) {
  STEPS.forEach((x, i) => {
    $('#' + x + 'Panel').classList.toggle('is-active', x === n);
    const st = $(`.step[data-step="${x}"]`);
    st.classList.toggle('is-active', x === n);
    st.classList.toggle('is-done', i < STEPS.indexOf(n) || (x === 'results' && hasResults && n !== 'results'));
  });
  window.scrollTo(0, 0);
  if (n === 'results' && hasResults) renderTrend();   /* 숨겨진 상태에서 그린 차트는 폭이 0 이라 보일 때 다시 그린다 */
}

/* ── 변경 메타(타일·표 배지) ───────────────────────────── */
function changeMeta(c) {
  const own = changes.filter(x => x.id === c.id);
  const ch = own.slice().reverse().find(x => x.type === 'swap') || own.find(x => x.type === 'new') || own[own.length - 1];
  if (!ch) return { cls: '', label: '', badge: '' };
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
  if (own.some(x => x.type === 'new' || x.type === 'shift')) return 2;
  return 3;
}
function scenarioRole(c) {
  if (mode !== 'swap') return '';
  if (selectionPhase === 'counterpart' && c.id === selectedId) return 'is-role-target';
  if (c.id === swapTargetId) return 'is-role-counterpart';
  return '';
}
function tile(c, opts = {}) {
  const meta = opts.scenario ? changeMeta(c) : { cls: '', label: '' };
  const role = opts.scenario ? scenarioRole(c) : '';
  const roleLabel = role === 'is-role-target' ? '첫 채널 선택 중' : role === 'is-role-counterpart' ? '맞바꿀 채널' : '';
  const badge = roleLabel ? `<span class="tile__badge" style="--pair:var(--brand)">${roleLabel}</span>` : meta.label ? `<span class="tile__badge">${meta.label}</span>` : '';
  const score = opts.after ? opts.after.composite : c.composite;
  const lift = opts.lift !== undefined ? `<span class="tile__lift ${opts.lift > 0 ? 'is-up' : opts.lift < 0 ? 'is-down' : ''}">${opts.lift ? signed(opts.lift) : '—'}</span>` : '';
  const tag = opts.readonly ? 'div' : 'button';
  return `<${tag} ${opts.readonly ? '' : 'type="button"'} class="tile ${!opts.scenario && !opts.readonly && selectedId === c.id ? 'is-selected' : ''} ${meta.cls} ${role}" style="--genre:${genreColor(c.g)}" data-id="${c.id}" title="${esc(c.name)} · ${c.g}">
    <div class="tile__top"><span class="tile__no">${c.no}</span>${lift || `<span class="tile__score">${f1(score)}</span>`}</div>
    <div class="tile__name">${esc(c.name)}</div>
    <div class="tile__genre">${c.g}${lift ? ` · ${f1(score)}` : ''}</div>${badge}
  </${tag}>`;
}

/* ══════════ ① 현재 채널 가치 ══════════ */
function renderKpis() {
  const list = filtered();
  $('#kpiRow').innerHTML = [
    `<div class="card kpi"><div class="kpi__lbl">조회 채널</div><div class="kpi__val">${Math.min(PAGE_SIZE, list.length)}<small>개 / 화면</small></div><div class="kpi__cap">전체 ${base.length}개 · 현재 조건 ${list.length}개</div></div>`,
    `<div class="card kpi"><div class="kpi__lbl">평균 ${COMPOSITE.label}</div><div class="kpi__val">${f1(avg('composite'))}</div><div class="kpi__cap">${FORMULA}</div></div>`,
    ...METRICS.map(m => `<div class="card kpi"><div class="kpi__lbl">평균 ${m.label} <small>${m.desc}</small></div><div class="kpi__val">${f1(avg(m.key))}</div><div class="kpi__cap">전체 채널 기준</div></div>`)
  ].join('');
}
function filtered() {
  const q = $('#channelSearch').value.trim().toLowerCase(), g = $('#genreFilter').value, sort = $('#sortOrder').value;
  const list = base.filter(c => (g === 'all' || c.g === g) && (!q || c.name.toLowerCase().includes(q) || String(c.no).includes(q)));
  return list.sort((a, b) => sort === 'scoreDesc' ? b.composite - a.composite : sort === 'scoreAsc' ? a.composite - b.composite : ord(a.no) - ord(b.no));
}
const currentCols = () => [['order', '순서'], ['no', '번호'], ['name', '채널명'], ['genre', '장르'], ...ALL_METRICS.map(m => [m.key, m.label])];
function channelSortVal(c, key, meta = { label: '' }) {
  if (key === 'order') return ord(c.no);
  if (key === 'no') return c.no;
  if (key === 'name') return c.name;
  if (key === 'genre') return c.g;
  if (key === 'change') return meta.label || '변경 없음';
  return c[key] ?? '';
}
function renderChannels() {
  const list = filtered(), tableList = sortRows(list, 'current', (c, k) => channelSortVal(c, k));
  const { start, end } = pageWindow('current', list.length);
  $('#channelGrid').innerHTML = list.slice(start, end).map(c => tile(c)).join('');
  const tb = $('#channelTable');
  tb.innerHTML = tableList.slice(start, end).map((c, i) => `<tr class="${selectedId === c.id ? 'is-selected' : ''}" data-id="${c.id}"><td>${start + i + 1}</td><td><b>${c.no}</b></td><td><b>${esc(c.name)}</b></td><td><i class="genre-dot" style="background:${genreColor(c.g)}"></i>${c.g}</td>${ALL_METRICS.map(m => `<td><span class="bar"><i style="width:${c[m.key]}%"></i></span>${f1(c[m.key])}</td>`).join('')}</tr>`).join('');
  renderHead('current', currentCols(), tb);
  $('#totalChannelLabel').textContent = `전체 ${base.length}개 · 현재 조건 ${list.length}개 · 100개씩 조회`;
  renderKpis();
  renderDetail();
}
function renderDetail() {
  const c = byId(selectedId);
  $('#channelDetail').innerHTML = !c
    ? `<div class="empty-side">${ic('compass', 'i i--lg')}<strong>채널을 선택하세요</strong><span>채널의 가치 지표가 표시됩니다.</span></div>`
    : `<div class="detail">
        <div><div class="detail__kicker">선택 채널</div><div class="detail__title"><b>${esc(c.name)}</b><span class="detail__no">${c.no}</span></div><div class="detail__genre"><i style="background:${genreColor(c.g)}"></i>${c.g}</div></div>
        <div class="scores">${ALL_METRICS.map(m => `<div class="score ${m.key === 'composite' ? 'score--composite' : ''}"><div class="score__lbl"><span>${m.label} · ${m.desc}</span><b>${f1(c[m.key])}</b></div><div class="score__track"><i style="width:${c[m.key]}%"></i></div></div>`).join('')}</div>
        <div class="formula">${FORMULA}<br>※ 가중치는 운영 정책에 따라 설정 가능</div>
        <button class="btn btn--primary btn--block" type="button" id="detailToScenario">이 채널로 시나리오 만들기</button>
      </div>`;
  const b = $('#detailToScenario'); if (b) b.addEventListener('click', () => startScenario('swap'));
}
function selectChannel(id) { selectedId = id; renderChannels(); }
function resetAll() {
  selectedId = DEFAULT_SELECTED; work = base.map(x => ({ ...x })); changes = []; swapScenarios = []; autoApplyPending = false; hasResults = false; resultRun = null;
  pages.current = pages.scenario = pages.results = 1;
  $('#channelSearch').value = ''; $('#genreFilter').value = 'all'; $('#sortOrder').value = 'channel';
  renderChannels(); renderBuilder(); renderScenario(); renderResults();
  toast('조회 조건과 시나리오를 초기화했습니다.');
}

/* ══════════ ② 배치 변경 설계 ══════════ */
function startScenario(m = 'swap') {
  swapTargetId = null; selectionPhase = 'counterpart';
  pageFor('scenario', selectedId, work);
  setMode(m); showPanel('scenario');
}
function setMode(m) {
  const prev = mode; mode = m;
  if (m === 'new') { autoApplyPending = false; swapTargetId = null; }
  else if (prev !== 'swap') { swapTargetId = null; selectionPhase = 'counterpart'; }
  $$('.mode-tab').forEach(x => x.classList.toggle('is-on', x.dataset.mode === m));
  $('#swapFields').hidden = m !== 'swap';
  $('#newFields').hidden = m !== 'new';
  renderBuilder(); renderScenario();
}
/* 빌더의 select · 진행 3단계 · 안내 문구 */
function renderBuilder() {
  if (!byId(selectedId, work)) selectedId = work[0].id;
  if (swapTargetId === selectedId || !byId(swapTargetId, work)) swapTargetId = null;
  const chooseTarget = mode === 'swap' && selectionPhase === 'target', limit = swapScenarios.length >= MAX_SWAPS;
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

  const newCount = changes.filter(x => x.type === 'new').length;
  $('#mixTag').textContent = `교환 ${swapScenarios.length} · 신규 ${newCount}`;
  const guide = $('#selectionGuide'), setStep = (id, st) => { $('#' + id).className = 'flow__step' + (st ? ' ' + st : ''); };
  const target = byId(selectedId, work), counter = byId(swapTargetId, work), count = swapScenarios.length;
  $('#swapFlowCount').textContent = `${count}/${MAX_SWAPS}건`;
  if (limit) {
    guide.textContent = `교환안 ${MAX_SWAPS}건이 모두 찼습니다. 신규 ${newCount}건과 함께 실행할 수 있습니다.`;
    setStep('flowTarget', 'is-done'); setStep('flowCounterpart', 'is-done'); setStep('flowApply', 'is-done');
    $('#flowTargetName').textContent = '5건 완료'; $('#flowCounterpartName').textContent = '5건 완료'; $('#flowApplyState').textContent = '반영 완료';
  } else if (autoApplyPending && counter) {
    guide.textContent = `${count + 1}번 교환안 반영 중 · ${target.name} ⇄ ${counter.name}`;
    setStep('flowTarget', 'is-done'); setStep('flowCounterpart', 'is-done'); setStep('flowApply', 'is-active');
    $('#flowTargetName').textContent = target.name; $('#flowCounterpartName').textContent = counter.name; $('#flowApplyState').textContent = '반영 중…';
  } else if (selectionPhase === 'target') {
    guide.textContent = `교환안 ${count}/${MAX_SWAPS} · 다음 첫 채널을 선택하세요. 오른쪽 라인업에서 채널을 눌러도 됩니다.`;
    setStep('flowTarget', 'is-active'); setStep('flowCounterpart', ''); setStep('flowApply', '');
    $('#flowTargetName').textContent = '선택하세요'; $('#flowCounterpartName').textContent = '대기'; $('#flowApplyState').textContent = '선택 즉시';
  } else {
    guide.textContent = `교환안 ${count}/${MAX_SWAPS} · 첫 채널 ${target ? target.name : ''} — 맞바꿀 채널을 선택하면 별도 버튼 없이 즉시 반영됩니다.`;
    setStep('flowTarget', 'is-done'); setStep('flowCounterpart', 'is-active'); setStep('flowApply', '');
    $('#flowTargetName').textContent = target ? target.name : '선택됨'; $('#flowCounterpartName').textContent = '선택하세요'; $('#flowApplyState').textContent = '선택 즉시';
  }
}
function changeScenarioTarget(id) {
  if (!id || swapScenarios.length >= MAX_SWAPS) return;
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
  if (swapScenarios.length >= MAX_SWAPS) return;
  swapTargetId = id; queueSwapApply();
}
function selectScenarioChannel(id) {
  if (mode !== 'swap' || autoApplyPending) return;
  if (swapScenarios.length >= MAX_SWAPS) { toast(`교환안 ${MAX_SWAPS}건이 완료되었습니다. 시뮬레이션을 실행하세요.`); return; }
  if (selectionPhase === 'counterpart') {
    if (id === selectedId) { toast('첫 채널과 다른 채널을 선택하세요.'); return; }
    swapTargetId = id; queueSwapApply();
  } else { selectedId = id; swapTargetId = null; selectionPhase = 'counterpart'; renderBuilder(); renderScenario(); }
}
function applySwap() {
  if (swapScenarios.length >= MAX_SWAPS) { toast(`채널 교환은 한 시나리오에서 최대 ${MAX_SWAPS}건까지 가능합니다.`); return; }
  const source = byId(selectedId, work), target = byId(swapTargetId, work);
  if (!source || !target || source.id === target.id) { toast('첫 채널과 맞바꿀 채널을 선택하세요.'); return; }
  const a = source.no, b = target.no, swapNo = swapScenarios.length + 1;
  const pair = [{ id: source.id, before: a, after: b, type: 'swap', swapNo, swapRole: 'target' }, { id: target.id, before: b, after: a, type: 'swap', swapNo, swapRole: 'counterpart' }];
  source.no = b; target.no = a;
  changes.push(...pair);
  swapScenarios.push({ sourceId: source.id, targetId: target.id, sourceName: source.name, targetName: target.name, sourceBefore: a, sourceAfter: b, targetBefore: b, targetAfter: a });
  work.sort((x, y) => ord(x.no) - ord(y.no));
  recordHistory('채널 교환', pair, `${swapNo}. ${source.name} ${a}→${b} · ${target.name} ${b}→${a}`);
  swapTargetId = null; selectionPhase = 'target';
  renderBuilder(); renderScenario();
  toast(`${swapNo}번 교환이 반영되었습니다. 다음 첫 채널을 선택하세요.`);
}
function addNewChannel() {
  const name = $('#newName').value.trim(), g = $('#newGenre').value, posText = $('#newPosition').value.trim(), pos = Number(posText), similar = byId($('#similarChannel').value, work);
  if (!name || posText === '' || !Number.isInteger(pos) || pos < 0 || pos > 999 || !similar) { toast('채널명과 0~999 사이의 신규 채널 번호를 입력하세요.'); return; }
  const shifted = [], occupied = work.some(c => c.no === pos);
  if (occupied) {
    const chain = []; let cursor = pos, safety = 0;
    while (work.some(c => c.no === cursor) && safety < 1000) { chain.push(cursor); cursor = cursor === 999 ? 0 : cursor + 1; safety++; }
    if (safety >= 1000) { toast('추가 가능한 빈 채널 번호가 없습니다.'); return; }
    chain.reverse().forEach(no => { const c = work.find(x => x.no === no), before = c.no; c.no = before === 999 ? 0 : before + 1; shifted.push({ id: c.id, before, after: c.no, type: 'shift' }); });
  }
  const id = 'new-' + Date.now(), fresh = { id, g, name, no: pos, originalNo: null };
  /* 신규 채널 지표 = 유사 기준 채널 값의 보수적 추정(더미 계수) */
  const ratio = { svi: .92, cpi: .95, zsi: .9 };
  METRICS.forEach(m => { fresh[m.key] = +(similar[m.key] * (ratio[m.key] || .93)).toFixed(1); });
  fresh.composite = composite(fresh);
  work.push(fresh); work.sort((a, b) => ord(a.no) - ord(b.no));
  const entries = [{ id, before: '신규', after: pos, type: 'new' }, ...shifted];
  changes.push(...entries);
  selectedId = id; pageFor('scenario', id, work);
  recordHistory('신규 채널 추가', entries, `${name} 채널을 ${pos}번에 ${occupied ? '삽입' : '추가'} · ${similar.name} 유사 기준`);
  $('#newName').value = ''; $('#newPosition').value = '';
  renderBuilder(); renderScenario();
  toast(`${pos}번에 신규 채널을 추가했습니다. 교환 ${swapScenarios.length}건과 함께 누적되었습니다.`);
}
function clearScenario() {
  if (changes.length) recordHistory('변경 취소', changes, '임시 변경안 초기화', '취소');
  work = base.map(x => ({ ...x })); changes = []; swapScenarios = []; autoApplyPending = false; hasResults = false; resultRun = null;
  selectedId = DEFAULT_SELECTED; swapTargetId = null; selectionPhase = 'counterpart'; pages.scenario = pages.results = 1;
  renderBuilder(); renderScenario(); renderResults();
  toast('임시 변경안을 초기화했습니다.');
}
const scenarioCols = () => [['order', '순서'], ['no', '번호'], ['name', '채널명'], ['genre', '장르'], ['change', '변경 구분'], ...ALL_METRICS.map(m => [m.key, m.label])];
function renderScenario() {
  const yes = changes.length > 0;
  $('#runBtn').disabled = !yes;
  const list = work.slice().sort((a, b) => ord(a.no) - ord(b.no));
  const tableList = sortRows(list, 'scenario', (c, k) => channelSortVal(c, k, changeMeta(c)));
  const { start, end } = pageWindow('scenario', list.length);
  $('#scenarioChannelCount').textContent = `전체 ${list.length}개 · 변경 ${changes.filter(x => x.type !== 'shift').length}개`;
  $('#scenarioGrid').innerHTML = list.slice(start, end).map(c => tile(c, { scenario: true })).join('');
  const tb = $('#scenarioTable');
  tb.innerHTML = tableList.slice(start, end).map((c, i) => {
    const meta = changeMeta(c), role = scenarioRole(c);
    const label = role === 'is-role-target' ? '선택 중 · 첫 채널' : role === 'is-role-counterpart' ? '선택 중 · 맞바꿀 채널' : meta.label || '변경 없음';
    const cls = role ? 'is-role' : meta.badge || 'is-none';
    return `<tr data-id="${c.id}"><td>${start + i + 1}</td><td><b>${c.no}</b></td><td><b>${esc(c.name)}</b></td><td><i class="genre-dot" style="background:${genreColor(c.g)}"></i>${c.g}</td><td><span class="rolebadge ${cls}">${label}</span></td>${ALL_METRICS.map(m => `<td>${m.key === 'composite' ? `<b>${f1(c[m.key])}</b>` : f1(c[m.key])}</td>`).join('')}</tr>`;
  }).join('');
  renderHead('scenario', scenarioCols(), tb);
  setView('scenario', views.scenario);

  /* 변경안 목록 */
  const newItems = changes.filter(x => x.type === 'new');
  $('#changeMeta').textContent = yes ? `교환 ${swapScenarios.length}/${MAX_SWAPS} · 신규 ${newItems.length} · 실제 편성 미반영` : '아직 변경이 없습니다';
  $('#changeList').innerHTML = yes ? [
    ...swapScenarios.map((s, i) => `<div class="change pair-${i + 1}"><span class="change__no">${i + 1}</span><div class="change__body">
      <div class="change__row"><span class="change__role">첫 채널</span><b>${esc(s.sourceName)}</b><span class="arrow">${s.sourceBefore} → ${s.sourceAfter}</span></div>
      <div class="change__row"><span class="change__role">맞바꿀</span><b>${esc(s.targetName)}</b><span class="arrow">${s.targetBefore} → ${s.targetAfter}</span></div></div></div>`),
    ...newItems.map((x, i) => { const c = byId(x.id, work); return `<div class="change change--new"><span class="change__no">+</span><div class="change__body"><div class="change__row"><span class="change__role">신규 ${i + 1}</span><b>${esc(c ? c.name : '신규 채널')}</b><span class="arrow">${x.after}번${c && c.no !== x.after ? ` · 현재 ${c.no}번` : ''}</span></div></div></div>`; })
  ].join('') : '<div class="changes__empty">오른쪽 라인업에서 첫 채널을 선택하면 여기에 쌓입니다.</div>';
}

/* ══════════ 실행 (요청 → 진행 → 완료 / 실패) ══════════ */
const RUN_STAGES = [500, 700, 1500, 500];   /* 더미 소요 시간(ms). 실서비스는 서버 상태 폴링으로 대체 */
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
  recordHistory('시뮬레이션 실행', changes, `${changes.length}개 채널 · 모델 응답 시간 초과`, '실패');
}
function completeRun() {
  clearInterval(runTick);
  $$('#runStages li').forEach(li => { li.className = 'is-done'; }); $('#runBar').style.width = '100%';
  hasResults = true;
  resultRun = { time: Date.now(), baseDate: $('#baseDate').value, changes: changes.map(x => ({ ...x })), swapScenarios: swapScenarios.map(x => ({ ...x })), work: work.map(x => ({ ...x })) };
  const entry = recordHistory('시뮬레이션 실행', changes, `${changes.filter(x => x.type !== 'shift').length}개 채널 변경 · 기준일 ${fmtDate(resultRun.baseDate)}`, '완료', resultRun);
  resultRun.id = entry.id;
  setTimeout(() => { $('#runModal').hidden = true; renderResults(); showPanel('results'); renderEntryNotice(); toast('시뮬레이션이 완료되었습니다.'); }, 350);
}
function closeRun() { runToken++; clearInterval(runTick); $('#runModal').hidden = true; }

/* ══════════ ③ 결과 ══════════ */
function projection(c, run = resultRun) {
  const before = byId(c.id, base), ch = run.changes.find(x => x.id === c.id);
  const lift = ch ? (ch.type === 'shift' ? .35 : 1.3 + (hash(c.name) % 24) / 10) : 0;
  const after = {};
  METRICS.forEach(m => { after[m.key] = +(c[m.key] * (1 + lift * m.liftFactor)).toFixed(2); });
  after.composite = +METRICS.reduce((s, m) => s + after[m.key] * m.weight, 0).toFixed(2);
  return { c, src: before || c, beforeNo: before ? before.no : '신규', lift, ciLow: lift ? lift - .8 : 0, ciHigh: lift ? lift + 1 : 0, after, change: ch };
}
function lineupImpact(run = resultRun) {
  const direct = run.changes.filter(x => x.type !== 'shift');
  return Math.min(3.8, .7 + direct.length * .63 + Math.min(run.changes.length, 8) * .08);
}
function renderResults() {
  $('#noResults').hidden = hasResults; $('#resultsContent').hidden = !hasResults;
  if (!hasResults) return;
  const run = resultRun, impact = lineupImpact(run);
  $('#resultTitle').textContent = `시나리오 결과 · 교환 ${run.swapScenarios.length}건 · 신규 ${run.changes.filter(x => x.type === 'new').length}건`;
  $('#resultMeta').textContent = `기준일자 ${fmtDate(run.baseDate)} · 실행 ${fmtTime(run.time)} · 결과는 브라우저에 저장됩니다`;
  $('#totalLift').textContent = `+${f1(impact)}%`;
  $('#totalCi').textContent = `95% 신뢰구간 +${f1(impact - 1.1)}% ~ +${f1(impact + 1.3)}%`;
  const affected = run.changes.slice(0, 10).map((x, i) => { const c = byId(x.id, run.work); return { ...x, c, lift: x.type === 'shift' ? (.2 + (i % 4) * .14) : (1.3 + (hash(c.name) % 24) / 10) }; });
  $('#improvedCount').textContent = affected.length + '개';
  $('#declinedCount').textContent = '0개';
  $('#confidenceLevel').textContent = run.changes.length > 12 ? '낮음' : '중간';

  /* 전체 지표 변화 */
  const before = {}; ALL_METRICS.forEach(m => { before[m.key] = avg(m.key); });
  const lifts = {}; METRICS.forEach(m => { lifts[m.key] = impact * m.lineupLift; }); lifts.composite = impact;
  $('#compareBars').innerHTML = ALL_METRICS.map(m => {
    const b = before[m.key], a = Math.min(99, b * (1 + lifts[m.key] / 100)), lo = Math.max(0, a * (1 - .011)), hi = Math.min(100, a * (1 + .013));
    return `<div class="compare__row"><div class="compare__name">${m.label}<small>${m.desc}</small></div>
      <div class="compare__bars"><div class="compare__bar"><i style="width:${b}%"></i></div><div class="compare__bar after"><i style="width:${a}%"></i><span class="ci" style="left:${lo}%;width:${hi - lo}%"></span></div></div>
      <div class="compare__val">${f1(b)} → ${f1(a)}<b>+${f1(lifts[m.key])}%</b></div></div>`;
  }).join('');

  /* 채널별 변화 */
  $('#changeCountTag').textContent = affected.length + '개 영향';
  $('#impactList').innerHTML = affected.map(x => {
    const meta = changeMetaIn(x.c, run);
    return `<div class="impact__row ${meta.badge}"><div class="impact__name"><strong>${esc(x.c.name)}</strong><span>${x.c.g} · ${meta.label || '인접 영향'} · 95% CI ${f1(x.lift - .8)}~${f1(x.lift + 1)}%</span></div><div class="impact__pos">${x.before} → <b>${x.after}</b></div><span class="impact__lift">+${f1(x.lift)}%</span></div>`;
  }).join('');

  $('#trendMetric').innerHTML = ALL_METRICS.map(m => `<option value="${m.key}" ${m.key === trend.metric ? 'selected' : ''}>${m.label} · ${m.desc}</option>`).join('');
  renderTrend();
  renderResultsChannels();
}
/* 결과 스냅샷 기준의 변경 메타 — 현재 편집 중인 changes 와 분리 */
function changeMetaIn(c, run) {
  const saved = changes; changes = run.changes; const m = changeMeta(c); changes = saved; return m;
}
const resultCols = () => [['order', '순서'], ['before', '변경 전'], ['after', '변경 후'], ['name', '채널명'], ['genre', '장르'], ['change', '변경 구분'], ...ALL_METRICS.map(m => [m.key, `${m.label} 전→후`]), ['lift', 'Lift'], ['ci', '95% CI']];
function resultSortVal(row, key) {
  const { c, p } = row;
  if (key === 'order') return ord(c.no);
  if (key === 'before') return typeof p.beforeNo === 'number' ? p.beforeNo : -1;
  if (key === 'after') return c.no;
  if (key === 'name') return c.name;
  if (key === 'genre') return c.g;
  if (key === 'change') return changeGroupIn(c);
  if (key === 'lift') return p.lift;
  if (key === 'ci') return p.ciLow;
  return p.after[key] ?? '';
}
function changeGroupIn(c) { const saved = changes; changes = resultRun.changes; const g = changeGroup(c); changes = saved; return g; }
function renderResultsChannels() {
  if (!hasResults) return;
  const run = resultRun, list = run.work.slice().sort((a, b) => ord(a.no) - ord(b.no));
  const rows = list.map(c => ({ c, p: projection(c, run), meta: changeMetaIn(c, run) }));
  const tableRows = sortRows(rows, 'results', resultSortVal);
  const { start, end } = pageWindow('results', list.length);
  $('#resultsChannelCount').textContent = `전체 ${list.length}개 · 변경 ${run.changes.filter(x => x.type !== 'shift').length}개`;
  const saved = changes; changes = run.changes;
  $('#resultsGrid').innerHTML = rows.slice(start, end).map(({ c, p }) => tile(c, { scenario: true, readonly: true, after: p.after, lift: p.lift })).join('');
  changes = saved;
  const tb = $('#resultsTable');
  tb.innerHTML = tableRows.slice(start, end).map(({ c, p, meta }, i) => `<tr data-id="${c.id}"><td>${start + i + 1}</td><td>${p.beforeNo}</td><td><b>${c.no}</b></td><td><b>${esc(c.name)}</b></td><td><i class="genre-dot" style="background:${genreColor(c.g)}"></i>${c.g}</td><td><span class="rolebadge ${meta.badge || 'is-none'}">${meta.label || '변경 없음'}</span></td>${ALL_METRICS.map(m => `<td>${m.key === 'composite' ? '<b>' : ''}${f1(p.src[m.key])} → ${f1(p.after[m.key])}${m.key === 'composite' ? '</b>' : ''}</td>`).join('')}<td class="${p.lift > 0 ? 'is-up' : ''}">${p.lift ? signed(p.lift) : '—'}</td><td>${p.lift ? `${f1(p.ciLow)}~${f1(p.ciHigh)}%` : '—'}</td></tr>`).join('');
  renderHead('results', resultCols(), tb);
  setView('results', views.results);
}

/* 이벤트 전/후 추이 — AS-IS 실측선(더미)과 TO-BE 예측선. 이벤트(변경 적용 시점) 왼쪽은 둘이 같고 오른쪽부터 갈라진다 */
function renderTrend() {
  if (!hasResults) return;
  const el = $('#trendChart'), W = Math.max(480, el.clientWidth), H = 260, padL = 44, padR = 16, padT = 16, padB = 32;
  const N = trend.days, m = ALL_METRICS.find(x => x.key === trend.metric), baseV = avg(m.key), impact = lineupImpact() * (m.key === 'composite' ? 1 : METRICS.find(x => x.key === m.key).lineupLift);
  const seed = hash(m.key + N);
  const pts = [];
  for (let d = -N; d <= N; d++) {
    const noise = ((hash(String(seed + d)) % 100) / 100 - .5) * baseV * .008;
    const asis = baseV + noise + Math.sin(d / (N / 2.5)) * baseV * .006;
    const ramp = d <= 0 ? 0 : Math.min(1, d / Math.max(2, N * .3));
    const tobe = d <= 0 ? asis : asis * (1 + impact / 100 * ramp);
    pts.push({ d, asis, tobe, lo: tobe * (1 - .011 * ramp), hi: tobe * (1 + .013 * ramp) });
  }
  const vals = pts.flatMap(p => [p.asis, p.hi, p.lo]), vmin = Math.min(...vals), vmax = Math.max(...vals), span = (vmax - vmin) || 1;
  const x = d => padL + ((d + N) / (2 * N)) * (W - padL - padR);
  const y = v => padT + (1 - (v - (vmin - span * .15)) / (span * 1.3)) * (H - padT - padB);
  const path = key => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  const band = pts.filter(p => p.d >= 0);
  const bandPath = band.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(p.hi).toFixed(1)}`).join(' ') + ' ' + band.slice().reverse().map(p => `L${x(p.d).toFixed(1)},${y(p.lo).toFixed(1)}`).join(' ') + ' Z';
  const ticks = 4, yTicks = Array.from({ length: ticks + 1 }, (_, i) => vmin - span * .15 + (span * 1.3) * i / ticks);
  const step = N === 7 ? 1 : N === 30 ? 5 : 15;
  const xTicks = []; for (let d = -N; d <= N; d += step) xTicks.push(d);
  el.innerHTML = `<div class="trend__legend"><span><i></i>AS-IS 실측</span><span><i class="tobe"></i>TO-BE 예측</span><span><i class="event"></i>이벤트(변경 적용)</span><span>음영 = 95% 신뢰구간</span></div>
  <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="이벤트 전후 ${m.label} 추이">
    ${yTicks.map(v => `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="axis" x="${padL - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${v.toFixed(1)}</text>`).join('')}
    ${xTicks.map(d => `<text class="axis" x="${x(d).toFixed(1)}" y="${H - 10}" text-anchor="middle">${d === 0 ? '이벤트' : d > 0 ? `+${d}일` : `${d}일`}</text>`).join('')}
    <path class="tobe-band" d="${bandPath}"/>
    <line class="event" x1="${x(0).toFixed(1)}" x2="${x(0).toFixed(1)}" y1="${padT}" y2="${H - padB}"/>
    <text class="event-lbl" x="${(x(0) + 6).toFixed(1)}" y="${padT + 12}">변경 적용</text>
    <path class="asis" d="${path('asis')}"/>
    <path class="tobe" d="${path('tobe')}"/>
  </svg>`;
}

/* ══════════ 이력 (브라우저 로컬 50건) ══════════ */
function saveHistory() {
  history = history.slice(0, 50);
  try { localStorage.setItem(STORE.history, JSON.stringify(history)); } catch (e) { /* 저장 불가 환경 */ }
  renderHistory();
}
function recordHistory(type, entries, summary, status = '임시', run = null) {
  const details = entries.map(x => { const c = byId(x.id, work) || byId(x.id, base); return { name: c ? c.name : '미확인 채널', genre: c ? c.g : '', before: x.before, after: x.after, changeType: x.type }; });
  const item = { id: Date.now(), time: new Date().toISOString(), type, summary, status, details, run: run ? { time: run.time, baseDate: run.baseDate, changes: run.changes, swapScenarios: run.swapScenarios, work: run.work } : null };
  history.unshift(item); saveHistory();
  return item;
}
function renderHistory() {
  $('#historyBadge').textContent = history.length;
  const cls = s => s === '완료' ? 'is-done' : s === '실패' ? 'is-fail' : '';
  $('#historyList').innerHTML = history.length ? history.map(h => `<div class="history__item">
      <div><div class="history__type">${esc(h.type)}</div><div class="history__time">${fmtTime(h.time)}</div></div>
      <div class="history__body"><strong>${esc(h.summary)}</strong><span>${h.details.slice(0, 3).map(d => `${esc(d.name)} ${d.before}→${d.after}`).join(' · ')}${h.details.length > 3 ? ` 외 ${h.details.length - 3}건` : ''}</span></div>
      <div class="history__side"><span class="history__status ${cls(h.status)}">${esc(h.status)}</span>${h.status === '완료' && h.run ? `<button class="btn btn--sm" type="button" data-open="${h.id}">결과 보기</button><button class="btn btn--sm btn--ghost" type="button" data-csv="${h.id}">${ic('download')}결과 CSV</button>` : `<button class="btn btn--sm btn--ghost" type="button" data-item-csv="${h.id}">${ic('download')}이력 CSV</button>`}</div>
    </div>`).join('') : '<div class="history__empty">아직 실행 이력이 없습니다.</div>';
  $$('#historyList [data-open]').forEach(b => b.addEventListener('click', () => { openResult(+b.dataset.open); $('#historyModal').hidden = true; }));
  $$('#historyList [data-csv]').forEach(b => b.addEventListener('click', () => { const h = history.find(x => x.id === +b.dataset.csv); if (h && h.run) downloadReport(h.run); }));
  $$('#historyList [data-item-csv]').forEach(b => b.addEventListener('click', () => { const h = history.find(x => x.id === +b.dataset.itemCsv); if (h) downloadHistoryItem(h); }));
}
function openResult(id) {
  const h = history.find(x => x.id === id);
  if (!h || !h.run) return;
  resultRun = { ...h.run, id }; hasResults = true;
  renderResults(); showPanel('results');
}

/* 진입 안내 — 이전 실행 없음 / 최근 완료 결과 */
function renderEntryNotice() {
  const el = $('#entryNotice'), last = history.find(h => h.status === '완료' && h.run);
  el.hidden = false;
  if (last) {
    el.className = 'notice notice--result';
    el.innerHTML = `<span class="notice__ic">${ic('check', 'i i--lg')}</span><div class="notice__txt"><b>최근 완료된 시뮬레이션이 있습니다</b><span>${fmtTime(last.time)} · ${esc(last.summary)}</span></div>
      <div class="right"><button class="btn btn--sm btn--ghost" type="button" data-act="history">실행 이력</button><button class="btn btn--sm btn--primary" type="button" data-act="open">최근 결과 보기</button></div>`;
    $('[data-act="open"]', el).addEventListener('click', () => openResult(last.id));
  } else {
    el.className = 'notice';
    el.innerHTML = `<span class="notice__ic">${ic('info', 'i i--lg')}</span><div class="notice__txt"><b>처음 사용하시는군요 — 세 단계로 진행합니다</b><span>기준일자를 정한 뒤 현재 라인업에서 채널 가치를 확인하고, 변경 시나리오를 만들어 실행하면 전후 결과를 비교할 수 있습니다.</span></div>
      <div class="notice__steps"><span><i>1</i>기준일자 · 채널 확인</span><span><i>2</i>교환 · 신규 추가</span><span><i>3</i>실행 · 결과 비교</span></div>
      <div class="right"><button class="btn btn--sm btn--ghost" type="button" data-act="history">실행 이력</button><button class="btn btn--sm btn--ghost" type="button" data-act="close">${ic('x')}</button></div>`;
    $('[data-act="close"]', el).addEventListener('click', () => { el.hidden = true; });
  }
  $('[data-act="history"]', el).addEventListener('click', openHistory);
}
function openHistory() { renderHistory(); $('#historyModal').hidden = false; }

/* ══════════ CSV ══════════ */
const csvCell = v => `"${(v === null || v === undefined ? '' : String(v)).replace(/"/g, '""')}"`;
function downloadCsv(rows, name) {
  const csv = '\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  const a = document.createElement('a'), url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
function downloadHistoryItem(h) {
  const rows = [['변경 히스토리 상세'], ['일시', fmtTime(h.time)], ['유형', h.type], ['상태', h.status], ['요약', h.summary], [], ['채널명', '장르', '변경 전 번호', '변경 후 번호', '변경유형'], ...h.details.map(d => [d.name, d.genre, d.before, d.after, d.changeType])];
  downloadCsv(rows, `channel-change-history_${new Date(h.time).toISOString().slice(0, 16).replace(/[-T:]/g, '')}.csv`);
  toast('선택한 변경 이력을 CSV로 내려받았습니다.');
}
function downloadReport(run = resultRun) {
  if (!run) return;
  const projections = run.work.map(c => projection(c, run));
  const beforeAvg = {}, afterAvg = {};
  ALL_METRICS.forEach(m => { beforeAvg[m.key] = avg(m.key); afterAvg[m.key] = projections.reduce((s, p) => s + p.after[m.key], 0) / projections.length; });
  const overall = lineupImpact(run), rows = [];
  rows.push(['채널배치 시뮬레이션 전체 보고서'], ['기준일자', fmtDate(run.baseDate)], ['실행 일시', fmtTime(run.time)], ['다운로드 일시', new Date().toLocaleString('ko-KR')], ['채널 수', run.work.length], ['변경 채널 수', run.changes.length], ['전체 종합지수 Lift(%)', overall.toFixed(2)], []);
  rows.push(['[전체 지표 변화]'], ['지표', '변경 전', '변경 후 예상', '증감', 'Lift(%)', '95% CI 하한(%)', '95% CI 상한(%)']);
  ALL_METRICS.forEach(m => { const d = afterAvg[m.key] - beforeAvg[m.key], lift = beforeAvg[m.key] ? d / beforeAvg[m.key] * 100 : 0; rows.push([m.label, beforeAvg[m.key].toFixed(2), afterAvg[m.key].toFixed(2), d.toFixed(2), lift.toFixed(2), (lift - 1.1).toFixed(2), (lift + 1.3).toFixed(2)]); });
  rows.push([], ['[전체 채널 세부 지표]'], ['채널번호(변경 전)', '채널번호(변경 후)', '채널명', '장르', '변경유형', ...ALL_METRICS.flatMap(m => [`${m.label}(전)`, `${m.label}(후)`, `${m.label} 증감`]), '예상 Lift(%)', '95% CI 하한(%)', '95% CI 상한(%)']);
  projections.sort((a, b) => ord(a.c.no) - ord(b.c.no)).forEach(p => rows.push([p.beforeNo, p.c.no, p.c.name, p.c.g, p.change ? p.change.type : '변경없음', ...ALL_METRICS.flatMap(m => [p.src[m.key].toFixed(2), p.after[m.key].toFixed(2), (p.after[m.key] - p.src[m.key]).toFixed(2)]), p.lift.toFixed(2), p.ciLow.toFixed(2), p.ciHigh.toFixed(2)]));
  rows.push([], ['[변경 내역]'], ['채널명', '장르', '변경 전 번호', '변경 후 번호', '변경유형']);
  run.changes.forEach(x => { const c = byId(x.id, run.work); rows.push([c ? c.name : '', c ? c.g : '', x.before, x.after, x.type]); });
  rows.push([], ['[변경 히스토리]'], ['일시', '유형', '상태', '요약', '채널명', '장르', '변경 전 번호', '변경 후 번호', '변경유형']);
  history.forEach(h => h.details.forEach((d, i) => rows.push([i ? '' : fmtTime(h.time), i ? '' : h.type, i ? '' : h.status, i ? '' : h.summary, d.name, d.genre, d.before, d.after, d.changeType])));
  downloadCsv(rows, `channel-placement-report_${new Date(run.time).toISOString().slice(0, 16).replace(/[-T:]/g, '')}.csv`);
  toast(`전체 채널 ${run.work.length}개의 지표 변화와 변경 내역을 내려받았습니다.`);
}

/* ══════════ 이벤트 바인딩 · 초기화 ══════════ */
function bind() {
  $('#channelSearch').addEventListener('input', () => { pages.current = 1; renderChannels(); });
  $('#genreFilter').addEventListener('change', () => { pages.current = 1; renderChannels(); });
  $('#sortOrder').addEventListener('change', () => { pages.current = 1; renderChannels(); });
  $('#resetAllBtn').addEventListener('click', resetAll);
  $('#startScenarioBtn').addEventListener('click', () => startScenario('swap'));
  $('#channelGrid').addEventListener('click', e => { const t = e.target.closest('.tile'); if (t) selectChannel(t.dataset.id); });
  $('#channelTable').addEventListener('click', e => { const t = e.target.closest('tr'); if (t) selectChannel(t.dataset.id); });

  $$('.mode-tab').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  $('#targetChannelSelect').addEventListener('change', e => changeScenarioTarget(e.target.value));
  $('#swapChannel').addEventListener('change', e => changeSwapTarget(e.target.value));
  $('#applyBtn').addEventListener('click', addNewChannel);
  $('#clearScenarioBtn').addEventListener('click', clearScenario);
  $('#runBtn').addEventListener('click', runSimulation);
  $('#backToCurrentBtn').addEventListener('click', () => showPanel('current'));
  $('#scenarioGrid').addEventListener('click', e => { const t = e.target.closest('.tile'); if (t) selectScenarioChannel(t.dataset.id); });
  $('#scenarioTable').addEventListener('click', e => { const t = e.target.closest('tr'); if (t) selectScenarioChannel(t.dataset.id); });

  $('#emptyToScenarioBtn').addEventListener('click', () => showPanel('scenario'));
  $('#editScenarioBtn').addEventListener('click', () => showPanel('scenario'));
  $('#downloadBtn').addEventListener('click', () => downloadReport());
  $('#trendMetric').addEventListener('change', e => { trend.metric = e.target.value; renderTrend(); });
  $$('#trendPeriod button').forEach(b => b.addEventListener('click', () => { trend.days = +b.dataset.days; $$('#trendPeriod button').forEach(x => x.classList.toggle('is-on', x === b)); renderTrend(); }));
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(renderTrend, 120); });

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
  $('#baseDate').addEventListener('change', e => { toast(`기준일자를 ${fmtDate(e.target.value)} 로 바꿨습니다. 다음 실행부터 이 날짜의 채널 메타데이터를 사용합니다.`); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('#historyModal').hidden = true; } });
}
function init() {
  mountIcons();
  $('#genreFilter').innerHTML += GENRES.map(g => `<option value="${g}">${g}</option>`).join('');
  $('#newGenre').innerHTML = GENRES.map(g => `<option value="${g}">${g}</option>`).join('');
  bind();
  renderChannels(); renderBuilder(); renderScenario(); renderResults(); renderHistory(); renderEntryNotice();
  ['current', 'scenario', 'results'].forEach(s => setView(s, views[s]));
}
init();
})();
