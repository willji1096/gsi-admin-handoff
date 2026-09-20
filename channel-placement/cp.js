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
/* 26-09-16 약어 정식 명칭 확정 (KT 9/16 정정 메모).
   (옛 표기) ZSI·재핑시너지 → 정식은 ZPI(Zapping Power Index)·채널이동(재핑) 파워 지수.
   full 은 마우스를 올렸을 때 뜨는 정식 명칭이다 — 「약자만 있어서 아무도 모른다」는 9/14 요구. */
const METRICS = [
  { key: 'svi', label: 'SVI', desc: '채널번호 가치', full: 'Slot Value Index',    tip: '채널 번호(위치) 자체가 가진 가치입니다.', weight: .36, seed: [0, 60, 330], liftFactor: .009,  lineupLift: .9 },
  { key: 'cpi', label: 'CPI', desc: '콘텐츠 파워',   full: 'Content Power Index',  tip: '그 채널이 편성한 프로그램의 경쟁력입니다.', weight: .36, seed: [3, 57, 370], liftFactor: .0045, lineupLift: .45 },
  { key: 'zpi', label: 'ZPI', desc: '재핑 파워',     full: 'Zapping Power Index',  tip: '채널 이동(재핑) 흐름에서 받는 힘입니다.', weight: .28, seed: [6, 55, 390], liftFactor: .0118, lineupLift: 1.18 }
];
const COMPOSITE = { key: 'composite', label: '종합지수', desc: '가중 합산', full: '종합지수', tip: 'SVI·CPI·ZPI 를 가중 합산한 값입니다.' };
/* 약어에 정식 명칭을 붙여 보여준다 — 올리면 뜬다 */
const abbr = m => `<span class="abbr" data-tip="${esc(m.full)} · ${esc(m.tip)}">${m.label}</span>`;
const ALL_METRICS = [...METRICS, COMPOSITE];
const FORMULA = '종합지수 = ' + METRICS.map(m => `${m.label} ${Math.round(m.weight * 100)}%`).join(' + ');

const GENRE_COLORS = {
  '데이터홈쇼핑': 'var(--sec-purple)', '라이브홈쇼핑': 'var(--graph-03)', '지상파': 'var(--graph-04)', '종합편성': 'var(--graph-09)',
  '드라마/오락/음악': 'var(--graph-01)', '영화/시리즈': 'var(--graph-02)', '뉴스/경제': 'var(--graph-13)', '스포츠/레저': 'var(--graph-05)',
  '공공/공익/정보': 'var(--graph-10)', '다큐/교양': 'var(--graph-07)', '애니/유아/교육': 'var(--graph-06)', '종교/오픈': 'var(--graph-08)',
  '성인': 'var(--graph-15)', '오디오': 'var(--graph-12)'
};
/* 26-09-14 KT 자체 시안(9/7) 지표. 요구서의 SVI/CPI/ZPI 와 다른 체계라 지우지 않고 나란히 둔다.
   값은 종합지수 Lift 에서 파생시킨 자리표시 더미 — 실산식은 모델링 담당이 정한다 */
const MACRO = [
  { key: 'uv',   label: '총 시청 UV 합산',   unit: '만 UV',  base: 1284.6, factor: 1,   digits: 1 },
  { key: 'stay', label: '평균 체류시간',      unit: '분',     base: 18.4,   factor: .62, digits: 1 },
  { key: 'call', label: '홈쇼핑 대역 콜수',   unit: '천 건',  base: 96.2,   factor: 1.18, digits: 1 }
];
/* 등급 구간 — 종합지수(약 60~93) 기준. 구간이 바뀌면 여기만 고친다 */
const GRADES = [[85, 'S'], [78, 'A+'], [70, 'A-'], [0, 'B']];
const gradeOf = v => (GRADES.find(g => v >= g[0]) || GRADES[GRADES.length - 1])[1];

const PAGE_SIZE = 100;
/* 26-09-16 9/14 요구: 신규 채널 추가·채널 교환 모두 최대 10건. (옛 값) MAX_SWAPS = 5, 신규는 무제한.
   무제한이면 검증 때 「왜 제한을 안 걸었냐」는 지적이 들어온다는 것이 제한의 이유이고,
   한도에 걸리면 기존에 추가한 건을 지우고 다시 넣는다(기존 채널은 건드리지 않는다). */
const MAX_SWAPS = 10;
const MAX_NEW = 10;
/* 시나리오 1(홈쇼핑 인접 PP 변경)·2(채널 교환)·3(신규)은 각각 10건이다 — 셋을 합쳐 10건이 아니다 */
const MAX_PP = 10;
const ppCount = () => ppScenarios.length;
const swapCount = () => swapScenarios.length;
/* 적용한 변경을 「다시 재생할 수 있는 형태」로 쌓아 둔다 — 건별 취소의 근거 (26-09-16) */
let ops = [];
/* 시나리오 1(PP사 덮어쓰기) 기록 — 교환(swapScenarios)과 성격이 달라 따로 쌓는다 */
let ppScenarios = [];
const STORE = { history: 'cpHistory' };
const URL_STATE = new URLSearchParams(location.search).get('state') || '';
let valueView = 'compare';   /* 26-09-14 KT 시안 뷰 토글 — asis(현재값) · tobe(예측값) · compare(현재→미래) */

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
/* 「E채널 으로」처럼 어색하게 붙는 조사를 막는다 — 받침이 없거나 ㄹ 받침이면 「로」 */
const ro = w => {
  const c = String(w).charCodeAt(String(w).length - 1);
  if (c < 0xAC00 || c > 0xD7A3) return '로';
  const j = (c - 0xAC00) % 28;
  return j === 0 || j === 8 ? '로' : '으로';
};

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
  /* Lucide pencil-line — 시나리오 1(자리의 PP사를 덮어쓴다) 표시 */
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
/* 26-09-16 상태 어휘가 성공·실패 둘로 줄어, 예전 브라우저에 남은 이력을 맞춰 준다 (9/14 요구).
   임시·취소는 실행 기록이 아니므로 버린다 — 이력은 「한 번 돌린 결과」만 남긴다. */
history = history.filter(h => h.status === '완료' || h.status === '성공' || h.status === '실패')
                 .map(h => (h.status === '완료' ? { ...h, status: '성공' } : h));

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
  const ch = own.slice().reverse().find(x => x.type === 'swap') || own.find(x => x.type === 'new') || own.find(x => x.type === 'pp') || own[own.length - 1];
  if (!ch) return { cls: '', label: '', badge: '' };
  /* 26-09-16 시나리오 1 — 번호는 그대로고 그 자리의 PP사만 바뀐 채널 */
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
  const meta = opts.scenario ? changeMeta(c) : { cls: '', label: '' };
  const role = opts.scenario ? scenarioRole(c) : '';
  const roleLabel = role === 'is-role-target' ? '첫 채널 선택 중' : role === 'is-role-counterpart' ? '맞바꿀 채널' : '';
  const badge = roleLabel ? `<span class="tile__badge" style="--pair:var(--brand)">${roleLabel}</span>` : meta.label ? `<span class="tile__badge">${meta.label}</span>` : '';
  /* 26-09-14 KT 시안 뷰 토글 — 결과 카드만 값 표기를 바꾼다. asis=현재값 · tobe=예측값 · compare=현재→미래.
     (옛 동작) 언제나 예측값 + Lift 한 벌 */
  const vv = opts.after ? valueView : 'compare';
  const score = opts.after ? (vv === 'asis' ? (opts.before ?? c.composite) : opts.after.composite) : c.composite;
  /* 전후를 나란히 쓰는 건 값이 실제로 움직인 채널만 — 314개가 전부 「53.1 → 53.1」 이면 변경 채널이 묻힌다 */
  const dual = opts.after && vv === 'compare' && opts.before !== undefined && opts.lift
    ? `<span class="tile__dual">${f1(opts.before)} <i>→</i> ${f1(opts.after.composite)}</span>` : '';
  const lift = opts.lift !== undefined && vv !== 'asis' ? `<span class="tile__lift ${opts.lift > 0 ? 'is-up' : opts.lift < 0 ? 'is-down' : ''}">${opts.lift ? signed(opts.lift) : f1(score)}</span>` : '';
  const tag = opts.readonly ? 'div' : 'button';
  return `<${tag} ${opts.readonly ? '' : 'type="button"'} class="tile ${!opts.scenario && !opts.readonly && selectedId === c.id ? 'is-selected' : ''} ${meta.cls} ${role}" style="--genre:${genreColor(c.g)}" data-id="${c.id}" title="${esc(c.name)} · ${c.g}">
    <div class="tile__top"><span class="tile__no">${c.no}</span>${lift || `<span class="tile__score">${f1(score)}</span>`}</div>
    <div class="tile__name">${esc(c.name)}</div>
    <div class="tile__genre">${dual || c.g}</div>${badge}
  </${tag}>`;
}

/* ══════════ ① 현재 채널 가치 ══════════ */
function renderKpis() {
  const list = filtered();
  $('#kpiRow').innerHTML = [
    `<div class="card kpi"><div class="kpi__lbl">조회 채널</div><div class="kpi__val">${Math.min(PAGE_SIZE, list.length)}<small>개 / 화면</small></div><div class="kpi__cap">전체 ${base.length}개 · 현재 조건 ${list.length}개</div></div>`,
    `<div class="card kpi"><div class="kpi__lbl">평균 ${COMPOSITE.label}</div><div class="kpi__val">${f1(avg('composite'))}</div><div class="kpi__cap">${FORMULA}</div></div>`,
    ...METRICS.map(m => `<div class="card kpi"><div class="kpi__lbl">평균 ${abbr(m)} <small>${m.desc}</small></div><div class="kpi__val">${f1(avg(m.key))}</div><div class="kpi__cap">전체 채널 기준</div></div>`)
  ].join('');
}
/* ══════════ ① 라인업 지표 추이 — 26-09-16 9/14 요구 ══════════
   ③에만 있던 일주일·한 달·90일 추이를 ①에도 둔다. 여기는 변경 전 화면이라 예측선(TO-BE)이 없고
   모델이 매일 저장해 둔 실측 한 줄만 그린다. 모델 배치가 새벽에 돌아 오늘치는 아직 없으므로
   오른쪽 끝(기준일)은 「전날」이다. 숫자는 자리표시 더미 — 실값은 지표 DB 에서 온다. */
let baseTrend = { days: 7, metric: 'composite' };
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d; };
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/* 한 줄치 좌표. 끝값(전날)을 그 선의 현재 값에 맞추고 뒤로 거슬러 완만한 계절성 + 잔진동을 얹는다.
   tag 가 시드라 채널마다 다른 흔들림이 나온다. 라인업 평균선은 tag='' 로 옛 모양을 그대로 쓴다.
   26-09-16 선택 채널 패널의 미니 추이와 나눠 쓰려고 renderBaseTrend 안에서 꺼냈다 */
function trendSeries(endV, tag, metricKey, N) {
  const seed = hash('base' + tag + metricKey + N), out = [];
  for (let d = -N; d <= 0; d++) {
    const noise = ((hash(String(seed + d)) % 100) / 100 - .5) * endV * .01;
    out.push({ d, v: endV + noise + Math.sin(d / (N / 2.2)) * endV * .008 });
  }
  return out;
}
/* 26-09-16 renderBaseTrend() 를 걷어냈다.
   KPI 아래 폭 전체를 쓰던 「선택 채널 지표 추이」 카드가 채널 그리드 위에 있어, 뒤쪽 채널을 고르면
   차트를 보려고 되올라가야 했다(디자이너 지적). 같은 차트를 오른쪽 「선택 채널」 패널로 옮기고
   (sparkline · sparkControls) 이 함수는 지웠다. 기간 3종·지표 선택은 그대로 따라갔다 — 요구 B-1 유지.
   되살릴 땐 index.html 같은 날짜 주석 자리에 카드를 두고, 이 함수를 sparkline 과 같은 방식으로
   (trendSeries 로 두 줄을 얻어) 다시 쓰면 된다. 축·눈금 그리는 코드만 더 붙으면 된다. */
function filtered() {
  const q = $('#channelSearch').value.trim().toLowerCase(), g = $('#genreFilter').value, sort = $('#sortOrder').value;
  const list = base.filter(c => (g === 'all' || c.g === g) && (!q || c.name.toLowerCase().includes(q) || String(c.no).includes(q)));
  return list.sort((a, b) => sort === 'scoreDesc' ? b.composite - a.composite : sort === 'scoreAsc' ? a.composite - b.composite : ord(a.no) - ord(b.no));
}
const currentCols = () => [['order', '순서'], ['no', '번호'], ['name', '채널명'], ['genre', '장르'], ...ALL_METRICS.map(m => [m.key, abbr(m)])];
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
  /* 26-09-16 (옛 코드) $('#totalChannelLabel').textContent = `전체 ${base.length}개 · 현재 조건 ${list.length}개 · 100개씩 조회`;
     — KPI 「조회 채널」 카드와 같은 말이라 마크업째 뺐다(index.html 같은 날짜 주석). */
  renderKpis();
  renderDetail();
}
/* 26-09-16 상세 패널의 산식 칸 — 요구는 「이런 단어는 지워야 될 것 같다」라 문장을 통째로 뺐다.
   (옛 문구) 「※ 가중치는 운영 정책에 따라 설정 가능」. 한 번 「모델이 산출한 값을 그대로 씁니다」로
   바꿔 넣었으나 그것도 요구 범위 초과라 되돌렸다. 산식 줄(FORMULA)은 지우라고 한 적이 없어 남긴다. */
/* ── 선택 채널 패널의 미니 추이 (26-09-16) ──
   그리드 아래쪽 채널(96번 등)을 고르면 위 큰 차트까지 되올라가야 보였다(디자이너 지적).
   이 패널은 .side 라 스크롤을 따라다니므로 같은 두 줄(선택 채널 실선 · 라인업 평균 점선)을
   작게 겹쳐 둔다. 기간·지표는 위 차트의 설정을 그대로 따라가 두 곳이 어긋나지 않는다.
   되돌릴 땐 이 함수와 renderDetail 의 ${sparkline(c)} 한 곳만 지우면 된다. */
/* 기간 3종·지표 선택 — 옛 큰 카드의 오른쪽에 있던 컨트롤을 그대로 옮겨 왔다(요구 B-1).
   패널은 renderDetail 이 innerHTML 로 다시 그리므로 리스너도 거기서 매번 건다 */
function sparkControls() {
  const per = [[7, '일주일'], [30, '한 달'], [90, '90일']];
  return `<div class="spark__ctl">
    <select class="select select--sm" id="baseTrendMetric" aria-label="추이 지표">${ALL_METRICS.map(x => `<option value="${x.key}" ${x.key === baseTrend.metric ? 'selected' : ''}>${x.label} · ${x.desc}</option>`).join('')}</select>
    <div class="seg seg--sm" id="baseTrendPeriod" role="tablist">${per.map(([d, l]) => `<button class="${baseTrend.days === d ? 'is-on' : ''}" data-days="${d}" type="button">${l}</button>`).join('')}</div>
  </div>`;
}
function sparkline(c) {
  const m = ALL_METRICS.find(x => x.key === baseTrend.metric), N = baseTrend.days, avgV = avg(m.key);
  const pts = trendSeries(c[m.key], c.name, m.key, N), avgPts = trendSeries(avgV, '', m.key, N);
  /* 폭은 패널에 맞춰 늘어난다(preserveAspectRatio=none) — 실제 폭을 모르는 채 그리기 때문이다.
     그래서 선 굵기는 non-scaling-stroke 로 지키고, 값 라벨은 SVG 가 아니라 HTML 로 얹는다
     (SVG text 를 쓰면 글자가 가로로 늘어난다). 세로는 viewBox 그대로라 % 로 위치를 잡을 수 있다.
     26-09-16 높이 (옛 값) 56 → 120 → 104. 90일을 읽을 만큼은 되고 패널이 길어지지는 않는 선. */
  const W = 240, H = 104, padY = 10;
  const vals = [...pts, ...avgPts].map(p => p.v), vmin = Math.min(...vals), vmax = Math.max(...vals), span = (vmax - vmin) || 1;
  const x = d => ((d + N) / N) * W;
  const y = v => padY + (1 - (v - (vmin - span * .18)) / (span * 1.36)) * (H - padY * 2);
  const line = ps => ps.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const per = N === 7 ? '최근 일주일' : N === 30 ? '최근 한 달' : '최근 90일';
  /* 26-09-16 (옛 배치) 두 값을 선 끝에 절대배치로 붙이고 그 자리로 차트 오른쪽을 42px 비웠다.
     그만큼 차트만 짧아져 바로 위 지표 select·기간 버튼과 오른쪽 끝이 어긋나 보였다(디자이너 지적).
     값은 차트 위 한 줄로 올리고 차트는 카드 폭을 끝까지 쓴다. 값이 겹칠 일도 없어졌다.
     되돌릴 땐 .spark__plot 에 padding-right 를 주고 .spark__val 두 개를 top % 로 앉히면 된다. */
  const selV = c[m.key], diff = +(selV - avgV).toFixed(1);
  return `<div class="spark">
    <div class="spark__head">
      <b class="spark__now">${f1(selV)}</b>
      <span class="spark__gap ${diff >= 0 ? 'is-up' : 'is-down'}">평균 ${f1(avgV)} 대비 ${diff >= 0 ? '↑' : '↓'} ${f1(Math.abs(diff))}</span>
    </div>
    <div class="spark__plot">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(c.name)}의 ${per} ${esc(m.label)} 추이 ${f1(selV)} · 라인업 평균 ${f1(avgV)}">
        <defs><linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-opacity=".16"/><stop offset="1" stop-opacity="0"/></linearGradient></defs>
        <path class="spark__area" d="${line(pts)} L${W},${H} L0,${H} Z"/>
        <path class="avgline" d="${line(avgPts)}" vector-effect="non-scaling-stroke"/>
        <path class="asis" d="${line(pts)}" vector-effect="non-scaling-stroke"/>
      </svg>
    </div>
    <div class="spark__cap"><span><i></i>이 채널</span><span><i class="avg"></i>라인업 평균</span></div>
    <div class="spark__note">기준일 ${fmtDate(ymd(yesterday()))} · 전날</div>
  </div>`;
}
function renderDetail() {
  const c = byId(selectedId);
  $('#channelDetail').innerHTML = !c
    ? `<div class="empty-side">${ic('compass', 'i i--lg')}<strong>채널을 선택하세요</strong><span>채널의 가치 지표가 표시됩니다.</span></div>`
    : `<div class="detail">
        <div><div class="detail__kicker">선택 채널</div><div class="detail__title"><b>${esc(c.name)}</b><span class="detail__no">${c.no}</span></div><div class="detail__genre"><i style="background:${genreColor(c.g)}"></i>${c.g}</div></div>
        <div class="trendbox">${sparkControls()}${sparkline(c)}</div>
        <div class="scores">${ALL_METRICS.map(m => `<div class="score ${m.key === 'composite' ? 'score--composite' : ''}"><div class="score__lbl"><span>${abbr(m)} · ${m.desc}</span><b>${f1(c[m.key])}</b></div><div class="score__track"><i style="width:${c[m.key]}%"></i></div></div>`).join('')}</div>
        <div class="formula">${FORMULA}</div>
        <button class="btn btn--primary btn--block" type="button" id="detailToScenario">이 채널로 시나리오 만들기</button>
      </div>`;
  const b = $('#detailToScenario'); if (b) b.addEventListener('click', () => startScenario('swap'));
  const ms = $('#baseTrendMetric'); if (ms) ms.addEventListener('change', e => { baseTrend.metric = e.target.value; renderDetail(); });
  $$('#baseTrendPeriod button').forEach(x => x.addEventListener('click', () => { baseTrend.days = +x.dataset.days; renderDetail(); }));
}
function selectChannel(id) { selectedId = id; renderChannels(); }
function resetAll() {
  /* 26-09-16 (옛 코드) ops 를 비우지 않아 초기화 뒤에도 옛 작업이 재생 대상으로 남았다 */
  selectedId = DEFAULT_SELECTED; work = base.map(x => ({ ...x })); changes = []; swapScenarios = []; ppScenarios = []; ops = []; autoApplyPending = false; hasResults = false; resultRun = null;
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
  if (m === 'new' || m === 'pp') { autoApplyPending = false; swapTargetId = null; }
  else if (prev !== 'swap') { swapTargetId = null; selectionPhase = 'counterpart'; }
  $$('.mode-tab').forEach(x => x.classList.toggle('is-on', x.dataset.mode === m));
  $('#swapFields').hidden = m !== 'swap';
  $('#newFields').hidden = m !== 'new';
  $('#ppFields').hidden = m !== 'pp';                 /* 26-09-16 시나리오 1 */
  renderBuilder(); renderScenario();
}
/* 빌더의 select · 진행 3단계 · 안내 문구 */
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
  /* 26-09-16 몇 건 넣었는지 한도와 함께 읽히게 한다 (옛 표기) `교환 N · 신규 N` */
  /* 26-09-16 세 시나리오의 한도가 각각 10건이라 세 숫자를 따로 센다 (옛 표기) `교환 N/10 · 신규 N/10` */
  $('#mixTag').textContent = `PP사 변경 ${ppCount()}/${MAX_PP} · 교환 ${swapCount()}/${MAX_SWAPS} · 신규 ${newCount}/${MAX_NEW}`;
  const guide = $('#selectionGuide'), setStep = (id, st) => { $('#' + id).className = 'flow__step' + (st ? ' ' + st : ''); };
  const target = byId(selectedId, work), counter = byId(swapTargetId, work), count = swapCount();
  $('#swapFlowCount').textContent = `${count}/${MAX_SWAPS}건`;
  if (limit) {
    guide.textContent = `교환안 ${MAX_SWAPS}쌍이 모두 찼습니다. 신규 ${newCount}건과 함께 실행할 수 있습니다.`;
    setStep('flowTarget', 'is-done'); setStep('flowCounterpart', 'is-done'); setStep('flowApply', 'is-done');
    $('#flowTargetName').textContent = `${MAX_SWAPS}건 완료`; $('#flowCounterpartName').textContent = `${MAX_SWAPS}건 완료`; $('#flowApplyState').textContent = '반영 완료';
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
/* ══════════ 시나리오 1 — 채널 PP사 변경 (26-09-16 전면 수정) ══════════
   요구서의 내용은 「기존 PP사를 다른 PP사로 업데이트」 한 줄이고, 예시도 한 자리만 바뀐다 —
   27번 Mnet 을 1번에 넣으면 「ENA 삭제 · 27번 Mnet · 1번 Mnet」. 즉 고른 채널 번호의
   PP사(채널명·장르·지표)를 통째로 덮어쓰는 단독 업데이트이고, 번호는 하나도 움직이지 않는다.
   (옛 구현) 「기준 홈쇼핑 + 인접 채널 + 새 PP사」 세 칸을 받아 두 채널을 맞바꿨다 —
   되돌리려면 이 파일의 26-09-16 이전 판(primSwap 을 부르던 applyPpChange)을 보면 된다.
   홈쇼핑 인접이라는 제약은 9/14 요구 정리에서 빠졌다. 대신 바꾼 자리 옆에 홈쇼핑이 있으면
   결과에서 그 채널을 1순위로 앞세운다 — 그것이 이 시나리오가 원래 보려던 것이다. */
const HOME_GENRES = ['데이터홈쇼핑', '라이브홈쇼핑'];
const isHome = c => HOME_GENRES.includes(c.g);
/* 그 번호의 바로 앞뒤 이웃 중 홈쇼핑 한 곳 — 번호가 꼭 ±1 이어야 하는 것은 아니다(빈 번호가 있다) */
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
  const slot = byId(ss.value, work), home = slot ? homeNeighbor(slot.no) : null;
  $('#ppHint').innerHTML = limit
    ? `채널 PP사 변경은 최대 ${MAX_PP}건입니다. 왼쪽 변경안에서 한 건을 지우고 다시 넣으세요.`
    : home
      ? `고른 채널 번호의 PP사만 바뀝니다. 옆이 홈쇼핑(<b>${esc(home.no)}번 ${esc(home.name)}</b>)이라 결과에서 그 채널의 변화를 가장 먼저 보여줍니다.`
      : '고른 채널 번호의 PP사만 바뀝니다. 원래 있던 PP사는 라인업에서 빠지고, 가져온 PP사는 원래 번호에도 그대로 남습니다.';
}
/* PP사 덮어쓰기 한 건의 원시 동작 — 껍데기(applyPpChange)와 분리한 이유는 「변경 건별 취소」다.
   번호(no)와 내부 id 는 그대로 두고 PP사의 내용만 갈아 끼운다: 결과 화면의 전→후 비교가
   같은 자리의 옛 PP 대 새 PP 로 읽힌다. */
function primPp(slotId, srcId) {
  const slot = byId(slotId, work), src = byId(srcId, work);
  if (!slot || !src || slot.id === src.id) return null;
  const oldName = slot.name, oldG = slot.g, ppNo = ppScenarios.length + 1;
  slot.name = src.name; slot.g = src.g;
  ALL_METRICS.forEach(m => { slot[m.key] = src[m.key]; });
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
  selectedId = r.slot.id; pageFor('scenario', r.slot.id, work);
  renderBuilder(); renderScenario();
  toast(`${r.slot.no}번을 ${r.oldName} 에서 ${r.src.name}${ro(r.src.name)} 바꿨습니다.`);
}

/* 26-09-16 교환 한 건을 실제로 적용하는 원시 동작. 껍데기(applySwap)와 분리한 이유는
   「변경 건별 취소」 때문이다 — 건을 하나 빼고 나머지를 base 부터 다시 재생해야 순서가 얽히지 않는다. */
/* ══════════ 시나리오 2 — 채널 교환 (26-09-16 오후 전면 수정) ══════════
   요구 정본(26-09-16): 「시나리오 2 = 채널끼리의 번호 교환 · 채널번호는 동일, 채널서비스ID 교환」.
   즉 자리(채널번호)는 못 박혀 있고 그 자리에 앉은 채널서비스ID(채널명·장르·지표)가 서로 건너간다.
   시나리오 1·3 과 같은 모델이다 — 세 시나리오 모두 번호는 하나도 움직이지 않는다.
   (옛 구현) 채널 객체의 no 를 맞바꿨다(source.no = b; target.no = a). 화면에 보이는 결과는 같았지만
   변경 내역이 「GS SHOP 8 → 999」처럼 **채널이 이사한 것으로** 읽혀 원문과 반대로 표기됐다.
   되돌릴 땐 위 두 줄과 work.sort 를 되살리고 before/after 에 번호를 넣으면 된다. */
function primSwap(aId, bId) {
  const slotA = byId(aId, work), slotB = byId(bId, work);
  if (!slotA || !slotB || slotA.id === slotB.id) return null;
  const swapNo = swapScenarios.length + 1;
  const nameA = slotA.name, gA = slotA.g, nameB = slotB.name, gB = slotB.g;
  slotA.name = nameB; slotA.g = gB;
  slotB.name = nameA; slotB.g = gA;
  ALL_METRICS.forEach(m => { const t = slotA[m.key]; slotA[m.key] = slotB[m.key]; slotB[m.key] = t; });
  /* before·after 는 이제 번호가 아니라 그 자리에 앉았던·앉은 채널서비스ID 다 */
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
  /* 26-09-16 (옛 코드) 교환 한 건마다 '임시' 이력을 남겼다. 9/14 요구 정리에서 이력은 실행 결과만,
     상태는 성공·실패 둘뿐으로 정리됐다 — 작업중·취소·임시는 넣지 않는다. 변경 누적은 왼쪽 「변경안」이 보여준다. */
  swapTargetId = null; selectionPhase = 'target';
  renderBuilder(); renderScenario();
  toast(`${a}번과 ${b}번의 채널서비스ID를 맞바꿨습니다(교환 ${swapNo}). 다음 첫 채널을 선택하세요.`);
}
function addNewChannel(preset, opId) {
  /* 26-09-16 신규 채널도 한도 10건 — 넘으면 이미 추가한 신규 건을 지우고 다시 넣는다 */
  if (!preset && changes.filter(x => x.type === 'new').length >= MAX_NEW) {
    toast(`신규 채널 추가는 한 시나리오에서 최대 ${MAX_NEW}건까지 가능합니다. 추가한 신규 채널을 지우고 다시 넣으세요.`); return;
  }
  const name = preset ? preset.name : $('#newName').value.trim(),
        g = preset ? preset.g : $('#newGenre').value,
        posText = preset ? String(preset.pos) : $('#newPosition').value.trim(),
        pos = Number(posText),
        similar = byId(preset ? preset.similarId : $('#similarChannel').value, work);
  /* 26-09-16 (옛 코드) 네 가지 상황에 같은 문구 하나를 띄웠다 — 채널명을 제대로 넣고 번호만 틀려도
     「채널명과 …」가 떠서 어디를 고쳐야 할지 알 수 없었다. 거부하는 조건은 그대로 두고 문구만 나눈다. */
  if (!name || posText === '' || !Number.isInteger(pos) || pos < 0 || pos > 999 || !similar) {
    if (!preset) {
      toast(!name ? '신규 채널명을 입력하세요.'
        : posText === '' ? '신규 채널 번호를 입력하세요.'
        : !Number.isInteger(pos) ? `채널 번호는 숫자로 입력하세요. (입력값 「${posText}」)`
        : (pos < 0 || pos > 999) ? `채널 번호는 0~999 사이여야 합니다. (입력값 ${pos})`
        : '가장 유사한 기준 채널을 선택하세요.');
    }
    return;
  }
  /* 26-09-16 KT 확인 — 이미 쓰는 번호에 신규를 넣으면 그 자리 채널을 「바꾼다」. 뒤를 밀지 않는다.
     (옛 동작) 19번에 넣으면 19번 신규 · 20번 옛채널 · 21번… 으로 뒤 채널이 전부 한 칸씩 밀렸다.
     요구 정정(26-09-16): 밀어내지 않고 그 자리 채널을 바꾼다.
     9/16 정정 메모의 「19번 신세계쇼핑 · 20번 TV조선」 예시도 이 최신 요구로 덮인다.
     되살릴 땐 여기서 빈 번호까지 올라가며 c.no 를 +1 하고 type:'shift' 를 쌓으면 된다 —
     그 기록을 읽는 쪽(changeMeta · renderCond · 영향도)은 건드리지 않고 그대로 뒀다. */
  const rmIdx = work.findIndex(c => c.no === pos), replaced = rmIdx >= 0 ? work[rmIdx] : null;
  if (replaced) {
    work.splice(rmIdx, 1);
    /* 지워진 자리에 앞선 시나리오 기록이 걸려 있으면 같이 걷어낸다 — 없는 채널을 찾다 결과 화면이 깨진다 */
    changes = changes.filter(x => x.id !== replaced.id);
    ppScenarios = ppScenarios.filter(s => s.slotId !== replaced.id);
    swapScenarios = swapScenarios.filter(s => s.sourceId !== replaced.id && s.targetId !== replaced.id);
  }
  const id = opId || ('new-' + Date.now()), fresh = { id, g, name, no: pos, originalNo: null };
  /* 신규 채널 지표 = 유사 기준 채널 값의 보수적 추정(더미 계수) */
  const ratio = { svi: .92, cpi: .95, zpi: .9 };
  METRICS.forEach(m => { fresh[m.key] = +(similar[m.key] * (ratio[m.key] || .93)).toFixed(1); });
  fresh.composite = composite(fresh);
  work.push(fresh); work.sort((a, b) => ord(a.no) - ord(b.no));
  /* 26-09-16 (옛 형태) before:'신규', after: pos(번호). 세 시나리오의 기록을
     「no = 자리 번호 · before/after = 그 자리의 채널서비스ID」로 통일하면서 바꿨다 */
  const entries = [{ id, no: pos, before: replaced ? replaced.name : '신규', after: name, type: 'new', replacedName: replaced ? replaced.name : '' }];
  changes.push(...entries);
  selectedId = id; pageFor('scenario', id, work);
  if (preset) return;                                   /* 재생 중 — 기록·안내 없이 상태만 되살린다 */
  ops.push({ kind: 'new', id, name, g, pos, similarId: similar.id });
  $('#newName').value = ''; $('#newPosition').value = '';
  renderBuilder(); renderScenario();
  toast(replaced ? `${pos}번을 ${replaced.name} 에서 신규 채널 「${name}」${ro(name)} 바꿨습니다.`
    : `${pos}번에 신규 채널 「${name}」을 추가했습니다.`);
}

/* ══════════ 변경 건별 취소 — 26-09-16 9/14 요구 ══════════
   한도(교환 10 · 신규 10)에 걸리면 이미 넣은 건을 X 로 지우고 다시 넣는다. 기존 채널은 건드리지 않는다.
   한 건만 빼서 되돌리면 뒤 건들의 번호가 얽히므로, base 부터 남은 작업을 순서대로 다시 재생한다. */
function rebuildFromOps() {
  const list = ops.slice();
  work = base.map(x => ({ ...x })); changes = []; swapScenarios = []; ppScenarios = []; ops = [];
  list.forEach(op => {
    if (op.kind === 'pp') { if (primPp(op.slotId, op.srcId)) ops.push(op); }
    else if (op.kind === 'swap') { if (primSwap(op.aId, op.bId)) ops.push(op); }
    else { addNewChannel({ name: op.name, g: op.g, pos: op.pos, similarId: op.similarId }, op.id); ops.push(op); }
  });
  if (!byId(selectedId, work)) selectedId = DEFAULT_SELECTED;
  swapTargetId = null; selectionPhase = 'counterpart'; autoApplyPending = false;
  hasResults = false; resultRun = null;
}
function removeOp(index) {
  if (index < 0 || index >= ops.length) return;
  const gone = ops[index];
  ops.splice(index, 1);
  rebuildFromOps();
  renderBuilder(); renderScenario(); renderResults();
  /* 26-09-16 (옛 코드) kind 가 'pp' 인 시나리오 1 항목까지 신규로 읽어 「신규 채널 「undefined」」 가 떴다 */
  toast(gone.kind === 'swap' ? '교환 한 건을 취소했습니다.'
    : gone.kind === 'pp' ? 'PP사 변경 한 건을 취소했습니다.'
    : `신규 채널 「${gone.name}」을 취소했습니다.`);
}
function clearScenario() {
  work = base.map(x => ({ ...x })); changes = []; swapScenarios = []; ppScenarios = []; ops = []; autoApplyPending = false; hasResults = false; resultRun = null;
  selectedId = DEFAULT_SELECTED; swapTargetId = null; selectionPhase = 'counterpart'; pages.scenario = pages.results = 1;
  renderBuilder(); renderScenario(); renderResults();
  toast('임시 변경안을 초기화했습니다.');
}
const scenarioCols = () => [['order', '순서'], ['no', '번호'], ['name', '채널명'], ['genre', '장르'], ['change', '변경 구분'], ...ALL_METRICS.map(m => [m.key, abbr(m)])];
function renderScenario() {
  const yes = changes.length > 0;
  $('#runBtn').disabled = !yes;
  const list = work.slice().sort((a, b) => ord(a.no) - ord(b.no));
  const tableList = sortRows(list, 'scenario', (c, k) => channelSortVal(c, k, changeMeta(c)));
  const { start, end } = pageWindow('scenario', list.length);
  /* 26-09-16 (옛 코드) $('#scenarioChannelCount').textContent = `전체 ${list.length}개 · 변경 …개`; — 마크업째 뺐다 */
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
  $('#changeMeta').textContent = yes ? `PP사 변경 ${ppCount()}/${MAX_PP} · 교환 ${swapCount()}/${MAX_SWAPS} · 신규 ${newItems.length}/${MAX_NEW} · 실제 편성 미반영` : '아직 변경이 없습니다';
  /* 26-09-16 적용한 순서(ops) 그대로 세우고 건마다 취소 버튼을 붙인다 — 9/14 요구 「X 로 지우고 다시 넣는다」.
     (옛 코드) 교환 목록과 신규 목록을 따로 이어 붙여 실제 적용 순서가 보이지 않았고, 건별 취소도 없었다. */
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
  }).join('') : '<div class="changes__empty">오른쪽 라인업에서 첫 채널을 선택하면 여기에 쌓입니다.</div>';
  $$('#changeList [data-undo]').forEach(b => b.addEventListener('click', () => removeOp(+b.dataset.undo)));
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
  resultRun = { time: Date.now(), baseDate: $('#baseDate').value, changes: changes.map(x => ({ ...x })), swapScenarios: swapScenarios.map(x => ({ ...x })), ppScenarios: ppScenarios.map(x => ({ ...x })), work: work.map(x => ({ ...x })) };
  const entry = recordHistory('시뮬레이션 실행', changes, `${changes.filter(x => x.type !== 'shift').length}개 채널 변경 · 기준일 ${fmtDate(resultRun.baseDate)}`, '성공', resultRun);
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
  return { c, src: before || c, beforeNo: before ? before.no : '신규', beforeName: before ? before.name : '신규 입점', lift, ciLow: lift ? lift - .8 : 0, ciHigh: lift ? lift + 1 : 0, after, change: ch };
}
function lineupImpact(run = resultRun) {
  const direct = run.changes.filter(x => x.type !== 'shift');
  return Math.min(3.8, .7 + direct.length * .63 + Math.min(run.changes.length, 8) * .08);
}
function renderResults() {
  $('#noResults').hidden = hasResults; $('#resultsContent').hidden = !hasResults;
  if (!hasResults) return;
  const run = resultRun, impact = lineupImpact(run);
  $('#resultTitle').textContent = `시나리오 결과 · PP사 변경 ${(run.ppScenarios || []).length}건 · 교환 ${run.swapScenarios.length}쌍 · 신규 ${run.changes.filter(x => x.type === 'new').length}건`;
  $('#resultMeta').textContent = `기준일자 ${fmtDate(run.baseDate)} · 실행 ${fmtTime(run.time)} · 결과는 브라우저에 저장됩니다`;
  renderCond(run);
  $('#totalLift').textContent = `+${f1(impact)}%`;
  $('#totalCi').textContent = `95% 신뢰구간 +${f1(impact - 1.1)}% ~ +${f1(impact + 1.3)}%`;
  /* 26-09-16 (옛 코드) run.changes.slice(0, 10) — 앞 10건만 그렸다. 직접 변경이 12건이면 2건이
     말없이 빠지고 「10개 영향」이라는 틀린 숫자가 떴다. 교환은 한 쌍이 2건이라 10쌍이면 절반이 사라진다.
     자를 이유가 없어 전부 그린다(최대 40건 = PP 10 + 교환 10쌍 20 + 신규 10).
     byId 가 못 찾는 기록은 건너뛴다 — 시나리오 3 으로 지워진 자리를 가리킬 수 있다. */
  const affected = run.changes.map((x, i) => { const c = byId(x.id, run.work); return c ? { ...x, c, lift: x.type === 'shift' ? (.2 + (i % 4) * .14) : (1.3 + (hash(c.name) % 24) / 10) } : null; }).filter(Boolean);
  $('#improvedCount').textContent = affected.length + '개';
  $('#declinedCount').textContent = '0개';
  /* 26-09-14 0개일 때는 색을 빼고 회색으로 — 하락이 없는데 빨갛게 강조돼 읽는 사람이 멈칫한다 */
  $('#improvedCount').classList.toggle('is-up', affected.length > 0);
  $('#declinedCount').classList.remove('is-down');
  $('#confidenceLevel').textContent = run.changes.length > 12 ? '낮음' : '중간';

  /* 전체 지표 변화 */
  const before = {}; ALL_METRICS.forEach(m => { before[m.key] = avg(m.key); });
  const lifts = {}; METRICS.forEach(m => { lifts[m.key] = impact * m.lineupLift; }); lifts.composite = impact;
  $('#compareBars').innerHTML = ALL_METRICS.map(m => {
    const b = before[m.key], a = Math.min(99, b * (1 + lifts[m.key] / 100)), lo = Math.max(0, a * (1 - .011)), hi = Math.min(100, a * (1 + .013));
    return `<div class="compare__row"><div class="compare__name">${abbr(m)}<small>${m.desc}</small></div>
      <div class="compare__bars"><div class="compare__bar"><i style="width:${b}%"></i></div><div class="compare__bar after"><i style="width:${a}%"></i><span class="ci" style="left:${lo}%;width:${hi - lo}%"></span></div></div>
      <div class="compare__val">${f1(b)} → ${f1(a)}<b>+${f1(lifts[m.key])}%</b></div></div>`;
  }).join('');

  /* 채널별 변화 */
  $('#changeCountTag').textContent = affected.length + '개 영향';
  $('#impactList').innerHTML = affected.map(x => {
    const meta = changeMetaIn(x.c, run);
    const v = viewDelta(x.c, x.lift);
    return `<div class="impact__row ${meta.badge}"><div class="impact__name"><strong>${esc(x.c.name)}</strong><span>${x.c.g} · ${meta.label || '인접 영향'} · 95% CI ${f1(x.lift - .8)}~${f1(x.lift + 1)}%</span>
      <span class="impact__view">시청자수 +${v.viwr}% · 시청초시간 +${v.stm}%</span></div><div class="impact__pos">${x.no ?? x.c.no}번 · ${esc(String(x.before))} → <b>${esc(String(x.after))}</b></div><span class="impact__lift">+${f1(x.lift)}%</span></div>`;
  }).join('');

  renderZones(run);
  renderMacro(impact);
  renderGrades(run);

  $('#trendMetric').innerHTML = ALL_METRICS.map(m => `<option value="${m.key}" ${m.key === trend.metric ? 'selected' : ''}>${m.label} · ${m.desc}</option>`).join('');
  renderTrend();
  renderResultsChannels();
}

/* 26-09-16 요구서 G-5 — 「관련된 채널 각각에 대해」 시청 지표 변화를 낸다.
   모델 입출력 명세 v0.1(9/16) 기준 모델이 내는 시청 지표는 둘뿐이다 —
   VIWR_NUM(시청자수 예측값) · VUING_STM(시청초시간 예측값), 각각 _LOWER · _UPPER 예측구간이 붙는다.
   (옛 구성) 「UV · PV · 체류시간」 세 칸을 냈는데 PV(시청 횟수)에 해당하는 출력 컬럼이 명세에 없어
   화면에만 존재하는 값이 됐다. 되살릴 땐 pv: +(uv * (.72 + seed * .5)).toFixed(1) 한 줄이면 된다.
   숫자는 자리표시 더미 — Lift 를 씨앗 삼아 채널마다 다른 비율로 흩뜨린 값이고, 실산식은 모델링 담당이 정한다. */
function viewDelta(c, lift) {
  const seed = (hash(c.name + 'uv') % 100) / 100;
  const viwr = +(lift * (.78 + seed * .5)).toFixed(1);
  return { viwr, stm: +(viwr * (.62 + seed * .5)).toFixed(1) };
}

/* ══════════ 주위 ±5 채널 영향 (26-09-16 신설) ══════════
   KT 원문이 세 시나리오 모두에 요구하는 결과 3순위 항목이다 —
   「변경으로 인한 주위 채널 ±5개 채널 변화」(시나리오 2 예시: 994번~4번, 36번~46번).
   변경이 일어난 자리마다 앞뒤 5칸을 구간으로 잡고, 그 안의 채널이 재핑으로 받는 영향을 낸다.
   지표는 모델 출력(VIWR_NUM 시청자수 · VUING_STM 시청초시간)에 맞춘다 — 명세 v0.1(9/16) 확인.
   숫자는 전부 자리표시 더미 — 거리(가까울수록 큼)와 변경 채널의 체급으로 만들었고, 실산식은 모델링 담당이 정한다. */
const ZONE_SPAN = 5;
function zoneRows(anchorNo, run, excludeIds) {
  const list = run.work.slice().sort((a, b) => ord(a.no) - ord(b.no));
  const i = list.findIndex(c => c.no === anchorNo);
  if (i < 0) return [];
  const rows = [];
  for (let d = -ZONE_SPAN; d <= ZONE_SPAN; d++) {
    const c = list[i + d];
    if (!c || d === 0 || excludeIds.has(c.id)) continue;
    /* 가까울수록 크게, 멀수록 작게. 앞뒤 방향은 재핑 흐름이 달라 계수를 다르게 둔다 */
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
  /* 구간 기준점 = 직접 바뀐 자리(교환 양쪽 · 신규 입점 번호). 번호가 밀리기만 한 채널은 기준점이 아니다 */
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
      /* 시나리오 1 이 원래 보려던 것은 「옆 홈쇼핑이 어떻게 됐나」다 — 그 채널을 표 맨 위로 올린다 */
      homeId: pp ? pp.homeId : null,
      rows: zoneRows(c.no, run, excludeIds)
    });
  });
  $('#zoneCountTag').textContent = `${zones.length}개 구간`;
  /* 기준 홈쇼핑을 맨 위로 (시나리오 1 의 결과 1순위) */
  zones.forEach(z => { if (z.homeId) z.rows.sort((a, b) => (b.c.id === z.homeId) - (a.c.id === z.homeId)); });
  el.innerHTML = zones.length ? zones.map(z => `<div class="zone">
    <div class="zone__head"><b>${z.no}번 ${esc(z.name)}</b><span>${esc(z.why)}</span><span class="zone__range">${z.rows.length ? `${z.rows[0].c.no}번 ~ ${z.rows[z.rows.length - 1].c.no}번` : '인접 채널 없음'}</span></div>
    <table class="zone__tbl"><thead><tr><th>번호</th><th>채널명</th><th>거리</th><th>시청자수</th><th>시청초시간</th></tr></thead>
    <tbody>${z.rows.map(r => `<tr class="${r.c.id === z.homeId ? 'is-home' : ''}"><td>${r.c.no}</td><td>${esc(r.c.name)}${r.c.id === z.homeId ? '<span class="zone__tag">기준 홈쇼핑</span>' : ''}</td><td>${r.d > 0 ? '+' : ''}${r.d}</td>
      <td class="is-up">+${r.viwr}%</td><td class="is-up">+${r.stm}%</td></tr>`).join('')}</tbody></table>
  </div>`).join('') : '<div class="changes__empty">직접 바뀐 채널이 없어 주위 영향을 낼 구간이 없습니다.</div>';
}

/* 테스트 조건 한 줄 — KT 자체 시안(9/7) 상단 표기.
   번호 이동(shift)은 교환·신규의 결과라 조건에 넣지 않는다 */
function renderCond(run) {
  const el = $('#resultCond'); if (!el) return;
  const label = id => { const c = byId(id, run.work); return c ? `${c.no}번 ${c.name}` : '채널'; };
  const parts = [];
  /* 26-09-16 (옛 문구) `${sc.sourceBefore}번 ${sc.sourceName} ↔ …` — sourceBefore 가 번호이던 시절 표기다.
     이제 번호는 sourceNo·targetNo 가 들고, before/after 는 그 자리의 채널서비스ID 다 */
  run.swapScenarios.forEach(sc => { parts.push(`${sc.sourceNo}번 ↔ ${sc.targetNo}번 채널서비스ID 교환 (${sc.sourceName} ↔ ${sc.targetName})`); });
  run.changes.filter(x => x.type === 'new').forEach(x => { parts.push(`${label(x.id)} 신규 편성`); });
  const shifts = run.changes.filter(x => x.type === 'shift').length;
  el.innerHTML = parts.length
    ? `<b>테스트 조건</b> ${parts.map(esc).join(' · ')}${shifts ? ` <small>(번호 순차 이동 ${shifts}개 포함)</small>` : ''}`
    : '<b>테스트 조건</b> 변경 없음';
}

/* 거시 총량 가치 비교 — KT 자체 시안(9/7)의 Macro Summary.
   라인업 전체 합산값을 AS-IS / TO-BE / 변동분 세 칸으로 본다 */
function renderMacro(impact) {
  $('#macroTable').innerHTML = MACRO.map(m => {
    const before = m.base, after = +(before * (1 + impact * m.factor / 100)).toFixed(m.digits), diff = +(after - before).toFixed(m.digits);
    const pct = +(diff / before * 100).toFixed(2);
    return `<tr><td><b>${m.label}</b></td><td>${before.toFixed(m.digits)}<small> ${m.unit}</small></td><td><b>${after.toFixed(m.digits)}</b><small> ${m.unit}</small></td>
      <td class="${diff > 0 ? 'is-up' : diff < 0 ? 'is-down' : ''}">${diff > 0 ? '+' : ''}${diff.toFixed(m.digits)} <small>(${pct > 0 ? '+' : ''}${pct}%)</small></td></tr>`;
  }).join('');
}

/* 주요 채널 가치 등급 변동 — KT 자체 시안(9/7)의 Asset Value.
   변경 영향 채널만 종합지수 전→후로 등급을 다시 매긴다 */
function renderGrades(run) {
  const rows = run.changes.slice(0, 8).map(x => {
    const c = byId(x.id, run.work); if (!c) return null;
    const p = projection(c, run), gb = gradeOf(p.src.composite), ga = gradeOf(p.after.composite);
    const moved = gb !== ga;
    const note = x.type === 'new' ? `신규 편성 · ${x.no}번 진입, 유사 채널 대비 보수 추정`
      : x.type === 'shift' ? `번호 이동 ${x.before} → ${x.after} · 인접 재핑 흐름 변화`
      : x.type === 'pp' ? `PP사 변경 ${x.before} → ${x.after} · 자리는 그대로, 채널서비스ID 교체`
      : `채널 교환 ${x.before} → ${x.after} · 번호는 그대로, 채널서비스ID 교환`;
    return { c, gb, ga, moved, note, lift: p.lift };
  }).filter(Boolean);
  $('#gradeCountTag').textContent = rows.length + '개';
  $('#gradeList').innerHTML = rows.length ? rows.map(r =>
    `<div class="grade ${r.moved ? 'is-moved' : ''}">
      <div class="grade__ch"><strong>${esc(r.c.name)}</strong><span>${r.c.g} · ${r.c.no}번</span></div>
      <div class="grade__move"><span class="grade__tag is-before">${r.gb}</span><i>→</i><span class="grade__tag ${r.moved ? 'is-after' : 'is-before'}">${r.ga}</span></div>
      <p class="grade__note">${r.note}</p>
    </div>`).join('') : '<p class="empty-line">변경된 채널이 없습니다.</p>';
}
/* 결과 스냅샷 기준의 변경 메타 — 현재 편집 중인 changes 와 분리 */
function changeMetaIn(c, run) {
  const saved = changes; changes = run.changes; const m = changeMeta(c); changes = saved; return m;
}
/* 26-09-16 (옛 구성) ['before','변경 전'] ['after','변경 후'] 는 **채널번호** 두 칸이었다.
   세 시나리오 모두 번호를 고정하고 채널서비스ID 만 바꾸게 되면서 두 칸이 늘 같은 값이 돼
   「번호 한 칸 + 변경 전 채널 / 변경 후 채널」로 바꿨다. */
const resultCols = () => [['order', '순서'], ['no', '번호'], ['before', '변경 전 채널'], ['name', '변경 후 채널'], ['genre', '장르'], ['change', '변경 구분'], ...ALL_METRICS.map(m => [m.key, `${abbr(m)} 전→후`]), ['lift', 'Lift'], ['ci', '95% CI']];
function resultSortVal(row, key) {
  const { c, p } = row;
  if (key === 'order') return ord(c.no);
  if (key === 'no') return ord(c.no);
  if (key === 'before') return p.beforeName;
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
  /* 26-09-16 (옛 코드) $('#resultsChannelCount').textContent = `전체 ${list.length}개 · 변경 …개`; — 마크업째 뺐다 */
  const saved = changes; changes = run.changes;
  $('#resultsGrid').innerHTML = rows.slice(start, end).map(({ c, p }) => tile(c, { scenario: true, readonly: true, after: p.after, before: p.src.composite, lift: p.lift })).join('');
  changes = saved;
  const tb = $('#resultsTable');
  tb.innerHTML = tableRows.slice(start, end).map(({ c, p, meta }, i) => `<tr data-id="${c.id}"><td>${start + i + 1}</td><td><b>${c.no}</b></td><td>${esc(p.beforeName)}</td><td><b>${esc(c.name)}</b></td><td><i class="genre-dot" style="background:${genreColor(c.g)}"></i>${c.g}</td><td><span class="rolebadge ${meta.badge || 'is-none'}">${meta.label || '변경 없음'}</span></td>${ALL_METRICS.map(m => `<td>${m.key === 'composite' ? '<b>' : ''}${f1(p.src[m.key])} → ${f1(p.after[m.key])}${m.key === 'composite' ? '</b>' : ''}</td>`).join('')}<td class="${p.lift > 0 ? 'is-up' : ''}">${p.lift ? signed(p.lift) : '—'}</td><td>${p.lift ? `${f1(p.ciLow)}~${f1(p.ciHigh)}%` : '—'}</td></tr>`).join('');
  renderHead('results', resultCols(), tb);
  setView('results', views.results);
}

/* 이벤트 전/후 추이 — AS-IS 실측선(더미)과 TO-BE 예측선. 이벤트(변경 적용 시점) 왼쪽은 둘이 같고 오른쪽부터 갈라진다 */
function renderTrend() {
  if (!hasResults) return;
  /* 26-09-14 오른쪽 여백 16 은 카드 안 패딩 24 보다 좁아 마지막 날 신뢰구간 음영이 카드 끝에 닿았다: (옛 값) padR = 16 */
  const el = $('#trendChart'), W = Math.max(480, el.clientWidth), H = 260, padL = 44, padR = 28, padT = 16, padB = 32;
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
/* 26-09-16 상태는 성공·실패 둘뿐 (9/14 요구). scenario 는 실패 건을 그대로 다시 돌리기 위한 재생 정보다. */
function recordHistory(type, entries, summary, status = '성공', run = null) {
  const details = entries.map(x => { const c = byId(x.id, work) || byId(x.id, base); return { no: x.no ?? (c ? c.no : ''), name: c ? c.name : '미확인 채널', genre: c ? c.g : '', before: x.before, after: x.after, changeType: x.type }; });
  const item = { id: Date.now(), time: new Date().toISOString(), type, summary, status, details, scenario: ops.map(o => ({ ...o })), run: run ? { time: run.time, baseDate: run.baseDate, changes: run.changes, swapScenarios: run.swapScenarios, work: run.work } : null };
  history.unshift(item); saveHistory();
  return item;
}
function renderHistory() {
  $('#historyBadge').textContent = history.length;
  /* 26-09-16 9/16 정정 메모 — 이력 버튼은 상태별로 딱 정해져 있다.
     완료 = 「결과 보기」 + 「CSV 다운로드」, 실패 = 「재배치」.
     (옛 코드) 실패 건에도 결과 CSV 를 달아 뒀는데, 실패한 실행은 낼 결과가 없어 빈 파일이 나간다.
     그 버튼만 쓰던 downloadHistoryItem() 도 함께 걷어냈다 — 되살릴 땐 details 를 그대로 CSV 로 내리면 된다. */
  const cls = s => s === '성공' ? 'is-done' : 'is-fail';
  $('#historyList').innerHTML = history.length ? history.map(h => `<div class="history__item">
      <div><div class="history__type">${esc(h.type)}</div><div class="history__time">${fmtTime(h.time)}</div></div>
      <div class="history__body"><strong>${esc(h.summary)}</strong><span>${h.details.slice(0, 3).map(d => `${d.no}번 ${esc(String(d.before))}→${esc(String(d.after))}`).join(' · ')}${h.details.length > 3 ? ` 외 ${h.details.length - 3}건` : ''}</span></div>
      <div class="history__side"><span class="history__status ${cls(h.status)}">${esc(h.status)}</span>${h.status === '성공' && h.run
        ? `<button class="btn btn--sm" type="button" data-open="${h.id}">결과 보기</button><button class="btn btn--sm btn--ghost" type="button" data-csv="${h.id}">${ic('download')}결과 CSV</button>`
        : `<button class="btn btn--sm btn--primary" type="button" data-rerun="${h.id}">${ic('reset')}재배치</button>`}</div>
    </div>`).join('') : '<div class="history__empty">아직 실행 이력이 없습니다.</div>';
  $$('#historyList [data-open]').forEach(b => b.addEventListener('click', () => { openResult(+b.dataset.open); $('#historyModal').hidden = true; }));
  $$('#historyList [data-csv]').forEach(b => b.addEventListener('click', () => { const h = history.find(x => x.id === +b.dataset.csv); if (h && h.run) downloadReport(h.run); }));
  $$('#historyList [data-rerun]').forEach(b => b.addEventListener('click', () => rerunFromHistory(+b.dataset.rerun)));
}
/* 26-09-16 실패한 실행을 그대로 다시 돌린다 — 9/14 요구 「실패 시 재배치」 */
function rerunFromHistory(id) {
  const h = history.find(x => x.id === id);
  if (!h || !h.scenario || !h.scenario.length) { toast('다시 돌릴 변경안이 남아 있지 않습니다.'); return; }
  ops = h.scenario.map(o => ({ ...o }));
  rebuildFromOps();
  $('#historyModal').hidden = true;
  renderBuilder(); renderScenario(); showPanel('scenario');
  runSimulation();
}
function openResult(id) {
  const h = history.find(x => x.id === id);
  if (!h || !h.run) return;
  resultRun = { ...h.run, id }; hasResults = true;
  renderResults(); showPanel('results');
}

/* 진입 안내 — 이전 실행 없음 / 최근 완료 결과 */
function renderEntryNotice() {
  const el = $('#entryNotice'), last = history.find(h => h.status === '성공' && h.run);
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
function downloadReport(run = resultRun) {
  if (!run) return;
  const projections = run.work.map(c => projection(c, run));
  const beforeAvg = {}, afterAvg = {};
  ALL_METRICS.forEach(m => { beforeAvg[m.key] = avg(m.key); afterAvg[m.key] = projections.reduce((s, p) => s + p.after[m.key], 0) / projections.length; });
  const overall = lineupImpact(run), rows = [];
  rows.push(['채널배치 시뮬레이션 전체 보고서'], ['기준일자', fmtDate(run.baseDate)], ['실행 일시', fmtTime(run.time)], ['다운로드 일시', new Date().toLocaleString('ko-KR')], ['채널 수', run.work.length], ['변경 채널 수', run.changes.length], ['전체 종합지수 Lift(%)', overall.toFixed(2)], []);
  rows.push(['[전체 지표 변화]'], ['지표', '변경 전', '변경 후 예상', '증감', 'Lift(%)', '95% CI 하한(%)', '95% CI 상한(%)']);
  ALL_METRICS.forEach(m => { const d = afterAvg[m.key] - beforeAvg[m.key], lift = beforeAvg[m.key] ? d / beforeAvg[m.key] * 100 : 0; rows.push([m.label, beforeAvg[m.key].toFixed(2), afterAvg[m.key].toFixed(2), d.toFixed(2), lift.toFixed(2), (lift - 1.1).toFixed(2), (lift + 1.3).toFixed(2)]); });
  rows.push([], ['[전체 채널 세부 지표]'], ['채널번호', '변경 전 채널', '변경 후 채널', '장르', '변경유형', ...ALL_METRICS.flatMap(m => [`${m.label}(전)`, `${m.label}(후)`, `${m.label} 증감`]), '예상 Lift(%)', '95% CI 하한(%)', '95% CI 상한(%)']);
  projections.sort((a, b) => ord(a.c.no) - ord(b.c.no)).forEach(p => rows.push([p.c.no, p.beforeName, p.c.name, p.c.g, p.change ? p.change.type : '변경없음', ...ALL_METRICS.flatMap(m => [p.src[m.key].toFixed(2), p.after[m.key].toFixed(2), (p.after[m.key] - p.src[m.key]).toFixed(2)]), p.lift.toFixed(2), p.ciLow.toFixed(2), p.ciHigh.toFixed(2)]));
  rows.push([], ['[변경 내역]'], ['채널번호', '장르', '변경 전 채널', '변경 후 채널', '변경유형']);
  run.changes.forEach(x => { const c = byId(x.id, run.work); rows.push([x.no ?? (c ? c.no : ''), c ? c.g : '', x.before, x.after, x.type]); });
  rows.push([], ['[변경 히스토리]'], ['일시', '유형', '상태', '요약', '채널번호', '장르', '변경 전 채널', '변경 후 채널', '변경유형']);
  history.forEach(h => h.details.forEach((d, i) => rows.push([i ? '' : fmtTime(h.time), i ? '' : h.type, i ? '' : h.status, i ? '' : h.summary, d.no, d.genre, d.before, d.after, d.changeType])));
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
  /* 26-09-16 (옛 코드) 여기서 #baseTrendMetric 의 option 을 채우고 #baseTrendPeriod 와 함께 리스너를 한 번 걸었다.
     두 컨트롤이 선택 채널 패널 안으로 들어가 renderDetail 이 매번 다시 그리므로 option·리스너 모두 sparkControls 쪽에서 맡는다. */
  $('#trendMetric').addEventListener('change', e => { trend.metric = e.target.value; renderTrend(); });
  $$('#trendPeriod button').forEach(b => b.addEventListener('click', () => { trend.days = +b.dataset.days; $$('#trendPeriod button').forEach(x => x.classList.toggle('is-on', x === b)); renderTrend(); }));
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { renderTrend(); }, 120); });

  $$('.step').forEach(b => b.addEventListener('click', () => showPanel(b.dataset.step)));
  $$('.pager').forEach(p => {
    const scope = p.dataset.scope;
    $$('.pager__btn', p).forEach(b => b.addEventListener('click', () => { pages[scope] = (pages[scope] || 1) + (+b.dataset.dir); renderScope(scope); }));
    $('select', p).addEventListener('change', e => { pages[scope] = +e.target.value || 1; renderScope(scope); });
  });
  $$('.seg[data-view-scope] button').forEach(b => b.addEventListener('click', () => setView(b.closest('.seg').dataset.viewScope, b.dataset.view)));
  /* 26-09-14 KT 시안 뷰 토글 — 결과 카드의 값 표기만 바꾼다 */
  $$('#valueView button').forEach(b => b.addEventListener('click', () => {
    valueView = b.dataset.vv;
    $$('#valueView button').forEach(x => x.classList.toggle('is-on', x === b));
    renderResultsChannels();
  }));

  $('#historyBtn').addEventListener('click', openHistory);
  $('#historyCloseBtn').addEventListener('click', () => { $('#historyModal').hidden = true; });
  $('#historyOkBtn').addEventListener('click', () => { $('#historyModal').hidden = true; });
  $('#historyModal').addEventListener('click', e => { if (e.target.id === 'historyModal') $('#historyModal').hidden = true; });
  $('#runRetryBtn').addEventListener('click', runSimulation);
  $('#runFailEditBtn').addEventListener('click', () => { closeRun(); showPanel('scenario'); });
  /* 26-09-16 기준일자 초기값 = 전날. (옛 값) index.html 에 value="2026-08-19" 로 박혀 있어
     날이 갈수록 과거로 벌어졌고, 같은 화면의 추이 차트(전날 기준)와 날짜가 어긋났다.
     요구서 F-1 「전날까지의 지표를 본다」와 맞춘다. 기준일자는 기록·표기용이라 지표 계산에는 쓰이지 않는다. */
  $('#baseDate').value = ymd(yesterday());
  $('#baseDate').max = ymd(yesterday());
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
