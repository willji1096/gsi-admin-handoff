/* ============================================================
   ours/ 편성표 · 분석 공용 스크립트
   데이터 기준 현재 = 2026.06.19(금) 09:20
   시청 배치 = 방송 종료 +4h (종료 +30분은 10초UV 대체 잠정)
   콜 배치   = 방송일 D+2 08:00
   ============================================================ */
(function () {
  'use strict';

  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const NOW = new Date(2026, 5, 19, 9, 20);
  /* 26-08-28 KT 요구 5번 — 「당일 조회 시 방송 중 프로그램을 첫 행에 고정」.
     조회 기본 기간이 어제까지라 당일을 아예 못 불러왔다(오늘 것은 집계 중이라 그렇게 잡아 뒀었다).
     오늘까지 넣어야 on air 가 나온다. 집계 중 상태는 화면이 이미 다룬다 */
  const TODAY = new Date(2026, 5, 19);
  const VIEW_BATCH = 240;   // 종료 +4h
  const UV_BATCH = 30;      // 종료 +30분 (10초UV 대체)

  /* 날짜를 분 좌표로 — 로컬 자정이 UTC 전날이 되는 문제를 피해 Y/M/D로 센다 */
  function dayAbs(d) { return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000) * 1440; }
  const NOW_ABS = dayAbs(NOW) + 560;
  const pad = n => String(n).padStart(2, '0');
  const hm = m => pad(Math.floor((m % 1440) / 60)) + ':' + pad(m % 60);
  const comma = n => Math.round(n).toLocaleString('ko-KR');
  /* 레일·게이지처럼 폭이 좁은 자리용 — 원수는 툴팁이 진다 */
  const compact = n => n >= 10000 ? Math.round(n / 10000).toLocaleString('ko-KR') + '만' : comma(n);
  const key = d => pad(d.getMonth() + 1) + pad(d.getDate());
  const shortDate = d => pad(d.getMonth() + 1) + '.' + pad(d.getDate()) + '(' + DOW[d.getDay()] + ')';
  const dotDate = d => d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate());
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967295;
  }

  /* ── 편성 원장 ───────────────────────────── */

  const PRICE = {
    '직화 불고기 정식 특가': 99000, '명품 선글라스 컬렉션': 189000, '프라임 에어컨 렌탈 라이브': 39900,
    '원피스 썸머 특집': 79000, '프리미엄 햄 세트': 89000, '쿨링 원피스': 59000, '캠핑용품 기획전': 129000,
    '더마 크림 세트': 69000, '브랜드 데님 특집': 79000, '로봇청소기 렌탈': 29900, '퍼퓸 바디케어': 49000,
    '유럽 침구 컬렉션': 159000, '한정판 백 컬렉션': 249000, '건강즙 패키지': 89000, '모던 팬츠 3종': 69000,
    '국내산 김치 세트': 49000, 'LED 마스크': 199000, '이지웨어 4종': 59000, '주방 정리 풀세트': 79000,
    '모바일 특가전': 119000,
    '홈밀 간편식 세트': 59000, '지역 특산 선물세트': 89000, '에어프라이어 특가': 139000, '기능성 베개 2입': 79000,
    '남성 이지 슬랙스': 49000, '천연 세제 대용량': 39000, '발효 홍삼 스틱': 129000, '스테인리스 냄비 세트': 99000,
    '여름 이불 커버': 69000, '무선 청소기 기획': 249000, '종합 비타민 6개월': 89000, '캐주얼 스니커즈': 79000
  };
  const MONTHLY = { '프라임 에어컨 렌탈 라이브': 1, '로봇청소기 렌탈': 1 };
  /* 공통카테고리 12종 (26-08-20 KT 수정안 #4 확정 명칭) — 상품 더미는 이 12종으로만 매핑 */
  const CAT = {
    '직화 불고기 정식 특가': '식품/건강', '명품 선글라스 컬렉션': '잡화', '프라임 에어컨 렌탈 라이브': '가전/디지털', '원피스 썸머 특집': '패션',
    '프리미엄 햄 세트': '식품/건강', '쿨링 원피스': '패션', '캠핑용품 기획전': '스포츠레저', '더마 크림 세트': '뷰티',
    '브랜드 데님 특집': '패션', '로봇청소기 렌탈': '가전/디지털', '퍼퓸 바디케어': '뷰티', '유럽 침구 컬렉션': '가구/홈데코',
    '한정판 백 컬렉션': '잡화', '건강즙 패키지': '식품/건강', '모던 팬츠 3종': '패션', '국내산 김치 세트': '식품/건강',
    'LED 마스크': '뷰티', '이지웨어 4종': '패션', '주방 정리 풀세트': '생활/주방', '모바일 특가전': '가전/디지털',
    '홈밀 간편식 세트': '식품/건강', '지역 특산 선물세트': '식품/건강', '에어프라이어 특가': '가전/디지털', '기능성 베개 2입': '가구/홈데코',
    '남성 이지 슬랙스': '패션', '천연 세제 대용량': '생활/주방', '발효 홍삼 스틱': '식품/건강', '스테인리스 냄비 세트': '생활/주방',
    '여름 이불 커버': '가구/홈데코', '무선 청소기 기획': '가전/디지털', '종합 비타민 6개월': '식품/건강', '캐주얼 스니커즈': '패션'
  };
  /* 6사 외 11개사 상품 풀 — 자사·주요 5사 상품명과 겹치지 않게 분리 */
  const EXTRA = ['홈밀 간편식 세트', '지역 특산 선물세트', '에어프라이어 특가', '기능성 베개 2입',
    '남성 이지 슬랙스', '천연 세제 대용량', '발효 홍삼 스틱', '스테인리스 냄비 세트',
    '여름 이불 커버', '무선 청소기 기획', '종합 비타민 6개월', '캐주얼 스니커즈'];

  /* 06:00–24:00 슬롯 길이 (합 1080). 정시 그리드를 깨는 20·40·75·80분을 섞는다 */
  const PLAN = {
    kt: [60, 60, 60, 60, 60, 75, 45, 60, 60, 60, 60, 60, 60, 60, 75, 45, 60, 40, 20],
    cj: [60, 60, 40, 60, 70, 70, 60, 60, 60, 45, 75, 60, 60, 60, 75, 45, 60, 60],
    lt: [60, 60, 60, 60, 60, 60, 40, 20, 60, 75, 45, 60, 60, 60, 60, 60, 60, 60, 60],
    hd: [75, 45, 60, 80, 60, 40, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60],
    gs: [60, 45, 75, 60, 60, 60, 60, 20, 40, 60, 60, 60, 60, 75, 45, 60, 60, 60, 60],
    ns: [60, 60, 60, 45, 75, 60, 60, 60, 40, 20, 60, 60, 60, 60, 75, 45, 60, 60, 60],
    /* 단편 편성(20분대) — 동시간대 30분 겹침 판정에서 빠지는 채널 */
    sh: [60, 60, 60, 20, 20, 20, 20, 20, 20, 20, 20, 20, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60]
  };
  /* 00:00–06:00 재방송 + 각 사 1건 8분 블록 (플로어 44px · 길이 왜곡 표식 시연) */
  const NIGHT = [[0, 120], [120, 120], [240, 112], [352, 8]];

  const CO = [
    { id: 'gs', logo: 'brand-gsshop.png', no: 3, name: 'GS SHOP', dm: 'gsshop.com', plan: 'gs', pool: ['프리미엄 햄 세트', '쿨링 원피스', '캠핑용품 기획전', '더마 크림 세트'] },
    { id: 'cj', logo: 'brand-cjonstyle-mark.png', no: 6, name: 'CJ ONSTYLE', dm: 'cjonstyle.com', plan: 'cj', pool: ['브랜드 데님 특집', '프리미엄 햄 세트', '로봇청소기 렌탈', '퍼퓸 바디케어'] },
    { id: 'hd', logo: 'brand-hyundai.png', no: 8, name: '현대홈쇼핑', dm: 'hmall.com', plan: 'hd', pool: ['유럽 침구 컬렉션', '한정판 백 컬렉션', '건강즙 패키지', '쿨링 원피스'] },
    { id: 'lt', logo: 'brand-lotte-mark.png', no: 12, name: '롯데홈쇼핑', dm: 'lotteimall.com', plan: 'lt', pool: ['국내산 김치 세트', 'LED 마스크', '캠핑용품 기획전', '모던 팬츠 3종'] },
    { id: 'ns', logo: 'brand-ns-mark.png', no: 15, name: 'NS홈쇼핑', dm: 'nsmall.com', plan: 'ns', pool: ['이지웨어 4종', '주방 정리 풀세트', '모바일 특가전', '더마 크림 세트'] },
    { id: 'kt', logo: 'brand-ktalpha-mark.png', no: 18, name: 'KT알파 쇼핑', dm: 'ktalpha.com', plan: 'kt', own: 1, pool: ['직화 불고기 정식 특가', '명품 선글라스 컬렉션', '프라임 에어컨 렌탈 라이브', '원피스 썸머 특집'] },
    { id: 'ha', no: 21, name: '홈앤쇼핑', dm: 'hnsmall.com', plan: 'cj', poolAt: 0 },
    { id: 'gg', logo: 'brand-gongyoung-circle.png', no: 24, name: '공영쇼핑', dm: 'gongyoungshop.kr', plan: 'lt', poolAt: 3 },
    { id: 'sk', logo: 'brand-skstoa.png', no: 27, name: 'SK스토아', dm: 'skstoa.com', plan: 'hd', poolAt: 6 },
    { id: 'ss', logo: 'brand-shinsegae.png', no: 30, name: '신세계쇼핑', dm: 'shinsegaetvshopping.com', plan: 'ns', poolAt: 9 },
    { id: 'st', no: 33, name: '쇼핑엔티', dm: 'shoppingntmall.com', plan: 'gs', poolAt: 1 },
    { id: 'ws', no: 36, name: 'W쇼핑', dm: 'w-shopping.co.kr', plan: 'kt', poolAt: 4 },
    { id: 'gm', logo: 'brand-gsmyshop.png', no: 39, name: 'GS MY SHOP', dm: 'gsshop.com', plan: 'sh', poolAt: 2 },
    { id: 'cp', logo: 'brand-cjonstyle-mark.png', no: 42, name: 'CJ ONSTYLE+', dm: 'cjonstyle.com', plan: 'lt', poolAt: 10 },
    { id: 'hp', logo: 'brand-hyundaiplus.jpeg', no: 45, name: '현대홈쇼핑+', dm: 'hmall.com', plan: 'sh', poolAt: 5 },
    { id: 'lo', logo: 'brand-lotte-mark.png', no: 48, name: '롯데원티비', dm: 'lotteimall.com', plan: 'cj', poolAt: 7 },
    { id: 'np', logo: 'brand-nsplus.png', no: 51, name: 'NS홈쇼핑+', dm: 'nsmall.com', plan: 'sh', poolAt: 8 }
  ];
  CO.forEach(c => { if (!c.pool) c.pool = [0, 1, 2, 3].map(i => EXTRA[(c.poolAt + i * 3) % EXTRA.length]); });
  const CO_BY_ID = {}, CO_BY_NAME = {};
  CO.forEach(c => { CO_BY_ID[c.id] = c; CO_BY_NAME[c.name] = c; });

  /* 브리프 지정 수치 — 생성값을 덮어쓴다 (화면 간 정합의 기준점) */
  const FIX = {
    '0617|kt|600': { v: 259978, c: 6740 },   // 대표 방송
    '0617|kt|900': { v: 146720, c: 3180 },
    '0618|kt|540': { v: 214300 },
    '0618|kt|1200': { v: 268450 },
    '0617|cj|580': { v: 312400 }, '0617|lt|600': { v: 274110 }, '0617|hd|620': { v: 241300 },
    '0617|gs|600': { v: 221450 }, '0617|ns|585': { v: 238900 }, '0617|ha|580': { v: 198300 },
    '0617|sk|620': { v: 176900 }, '0617|ss|585': { v: 152400 }, '0617|gg|600': { v: 134800 },
    '0617|st|600': { v: 118200 }, '0617|ws|600': { v: 96500 }, '0617|lo|580': { v: 78300 },
    '0617|cp|600': { v: 61400 },
    /* 직전 회차(1주 전 동일 슬롯) */
    '0610|kt|600': { v: 238512, c: 6210 }, '0610|kt|900': { v: 158900, c: 3460 },
    '0611|kt|540': { v: 205100, c: 5080 }, '0611|kt|1200': { v: 251300, c: 6390 }
  };

  const DAYPART = [[0, .14], [360, .38], [540, .86], [720, .70], [840, .60], [1020, .78], [1200, 1], [1380, .55]];
  function daypart(m) {
    let v = .14;
    for (const [s, k] of DAYPART) if (m >= s) v = k;
    return v;
  }

  function slots(co, d) {
    const dk = key(d), out = [];
    const plan = PLAN[co.plan];
    NIGHT.forEach(([s, dur], i) => {
      const base = co.pool[(i + 2) % 4];
      out.push(mk(co, d, dk, s, dur, dur === 8 ? '특가 미리보기' : base + ' 재방송', CAT[base]));
    });
    let t = 360;
    plan.forEach((dur, i) => {
      const title = co.pool[i % 4];
      out.push(mk(co, d, dk, t, dur, title, CAT[title]));
      t += dur;
    });
    return out;
  }

  function mk(co, d, dk, start, dur, title, cat) {
    const id = dk + '-' + co.id + '-' + start;
    const fx = FIX[dk + '|' + co.id + '|' + start] || {};
    const r = hash(id);
    const v = fx.v != null ? fx.v : Math.round((30000 + 240000 * daypart(start) * (0.70 + 0.45 * r)) / 10) * 10;
    const base = title.replace(' 재방송', '');
    const end = start + dur;
    const ab = dayAbs(d);
    const st = {
      onair: ab + start <= NOW_ABS && NOW_ABS < ab + end,
      view: ab + end + VIEW_BATCH <= NOW_ABS ? 'fixed' : (ab + end + UV_BATCH <= NOW_ABS ? 'interim' : 'pending'),
      call: ab + 2880 + 480 <= NOW_ABS ? 'fixed' : 'pending'
    };
    const c = st.call === 'fixed'
      ? (fx.c != null ? fx.c : Math.round(v / (34 + 12 * hash(id + 'c')) / 10) * 10)
      : null;
    return {
      id, co, date: d, dk, start, dur, end, title, cat: cat || CAT[base] || '기타',
      price: PRICE[base] || 79000, monthly: !!MONTHLY[base],
      view: st.view === 'pending' ? null : v, call: c, vs: st.view, cs: st.call, onair: st.onair,
      /* 26-08-20 KT #9·#10 — 시청가구 2값(분UV = view, 10초UV평균 = 더 작은 값: 10초 평균의 1분 SUM ÷ 6)과 웹반응고객수. 둘 다 화면 검증용 더미 */
      uv10: st.view === 'pending' ? null : Math.round(v * (0.50 + 0.20 * hash(id + 'u')) / 10) * 10,
      web: c == null ? null : Math.round(c * (0.25 + 0.35 * hash(id + 'w')) / 10) * 10,
      moved: hash(id + 'm') > 0.93,
      stay: Math.round((5.2 + 2.4 * hash(id + 's')) * 10) / 10
    };
  }
  const STAY_FIX = { '0617-kt-600': 6.8, '0618-kt-540': 6.2, '0618-kt-1200': 7.4, '0617-kt-900': 5.9 };

  function entryById(id) {
    const p = id.split('-');
    const co = CO_BY_ID[p[1]];
    if (!co) return null;
    const d = new Date(2026, +p[0].slice(0, 2) - 1, +p[0].slice(2));
    return slots(co, d).find(e => e.start === +p[2]) || null;
  }
  /* 미집계 블록엔 아예 찍지 않는다 — 상태는 채널 레일의 "콜 집계 중"이 이미 말한다 */
  function callDots(e) {
    if (e.cs !== 'fixed') return '';
    const n = e.call <= 2000 ? 1 : e.call <= 5000 ? 2 : 3;
    return '<span class="calldots">' + '<i></i>'.repeat(n) + '</span>';
  }
  /* ── 아이콘 (Lucide 24 그리드 원본 패스, 인라인 전용) ──
     CDN·스프라이트 없이 문서에 박고 색은 currentColor 로 부모 토큰을 상속한다.
     크기는 .i / .i--md / .i--lg 로만 준다. */
  const ICON = {
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    tv: '<rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/>',
    barChart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    loader: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>'
  };
  /* 스킨판(gsi-admin)이 같은 이름으로 아이콘을 갈아끼울 수 있게 — 없으면 아무 일도 없다 */
  Object.assign(ICON, window.GSI_ICONS || {});
  function ico(name, mod) {
    return '<svg class="i' + (mod ? ' i--' + mod : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
      ' stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[name] + '</svg>';
  }
  /* 섹션 타이틀 아이콘 — 마크업은 data-ico 이름만 갖고, 패스는 ICON 한 곳에서 온다 */
  document.querySelectorAll('.card__head h2[data-ico]').forEach(h =>
    h.insertAdjacentHTML('afterbegin', ico(h.dataset.ico, 'md')));

  /* 집계 상태 칩 — 확정/잠정/집계 중이 색 말고 형태로도 갈리게 */
  const STAT_ICON = { fixed: 'check', interim: 'warn', pending: 'loader' };
  function statChip(kind, label) {
    return '<span class="stat stat--' + kind + '">' + ico(STAT_ICON[kind]) + label + '</span>';
  }

  /* 상품 사진 — KT안과 같은 자산(assets/products). 카테고리당 한 장 */
  const CAT_IMG = { 패션: 'p1', 건강: 'p2', 잡화: 'p3', 식품: 'p4', 가전: 'p5', 리빙: 'p6', 주방: 'p7', 뷰티: 'p8' };
  function prodImg(e) { return 'assets/products/' + (CAT_IMG[e.cat] || 'p4') + '.jpg'; }

  /* 홈쇼핑사 로고 — GSI 피그마 공식 자산(Component_04 Logo). 없는 사는 파비콘, 그마저 막히면 이니셜 */
  function coLogo(co) {
    const src = co.logo ? 'assets/brand/' + co.logo
      : 'https://www.google.com/s2/favicons?domain=' + co.dm + '&sz=64';
    return '<span class="colog">' + co.name.slice(0, 1) +
      '<img src="' + src + '" alt="" loading="lazy"></span>';
  }
  const priceText = e => (e.monthly ? '월 ' : '') + comma(e.price) + '원';
  const timeText = e => hm(e.start) + ' – ' + hm(e.end);
  const callBatch = d => shortDate(addDays(d, 2)) + ' 08:00';

  /* ── 일반채널 ────────────────────────────── */

  const TV = [
    {
      id: 'KBS1', no: 9, week: 27300, day: 26850, marks: [[621, 980], [1267, 1120]],
      plan: [[0, 60, '뉴스라인'], [60, 120, '심야 다큐 재방송'], [180, 120, '클래식 오디세이'], [300, 60, '새벽 종합'],
        [360, 120, 'KBS 뉴스광장'], [480, 40, '인간극장'], [520, 40, '아침 드라마'], [560, 70, '아침마당'],
        [630, 60, '무엇이든 물어보세요'], [690, 90, 'KBS 뉴스 12'], [780, 60, '사랑의 가족'], [840, 120, '생방송 오늘'],
        [960, 120, '6시 내고향'], [1080, 60, 'KBS 뉴스 7'], [1140, 60, '저녁 드라마'], [1200, 90, 'KBS 뉴스 9'],
        [1290, 90, '다큐 인사이트'], [1380, 60, '뉴스라인 W']]
    },
    {
      id: 'KBS2', no: 7, week: 41200, day: 42380, marks: [[638, 1240], [794, 1080]],
      plan: [[0, 60, '뮤직뱅크 재방송'], [60, 120, '심야 영화'], [180, 120, '드라마 스페셜'], [300, 60, '굿모닝 대한민국'],
        [360, 90, 'KBS 뉴스타임'], [450, 120, '여유만만'], [570, 90, '아침 드라마 재방송'], [660, 90, '생생 정보통'],
        [750, 90, '2TV 저녁'], [840, 120, '예능 재방송'], [960, 60, '어게인 가요톱10'], [1020, 60, '저녁 뉴스타임'],
        [1080, 120, '살림하는 남자들'], [1200, 90, '수목 드라마'], [1290, 90, '해피투게더'], [1380, 60, '스포츠 하이라이트']]
    },
    {
      id: 'MBC', no: 11, week: 38600, day: 37940, marks: [[652, 1180], [1182, 1310]],
      plan: [[0, 60, '뉴스 24'], [60, 120, '심야 드라마'], [180, 120, '다큐 스페셜'], [300, 60, '새아침'],
        [360, 120, 'MBC 뉴스투데이'], [480, 120, '기분 좋은 날'], [600, 70, '생방송 오늘아침'], [670, 50, '이브닝 매거진'],
        [720, 60, 'MBC 뉴스 12'], [780, 60, '기분 좋은 날 앙코르'], [840, 120, '다큐프라임 재방송'], [960, 120, '오후의 영화'],
        [1080, 60, '뉴스 초점'], [1140, 60, '생방송 오늘저녁'], [1200, 90, 'MBC 뉴스데스크'], [1290, 90, '라디오스타'], [1380, 60, '심야 뉴스']]
    },
    {
      id: 'SBS', no: 5, week: 34900, day: 36110, marks: [[646, 1550], [1258, 1420]],
      plan: [[0, 60, '나이트라인'], [60, 120, '심야 영화'], [180, 120, '드라마 재방송'], [300, 60, '모닝와이드 1부'],
        [360, 180, '모닝와이드 2부'], [540, 110, '모닝와이드 3부'], [650, 70, '좋은 아침'], [720, 60, 'SBS 뉴스'],
        [780, 120, '오후 드라마'], [900, 120, '기분 좋은 오후'], [1020, 60, '뉴스 브리핑'], [1080, 60, '생방송 투데이'],
        [1140, 60, '저녁 드라마'], [1200, 90, 'SBS 8 뉴스'], [1290, 90, '런닝맨'], [1380, 60, '나이트라인 주말']]
    }
  ];

  /* ── 공통 UI ─────────────────────────────── */

  let tipEl = null;
  function tip(el, text) {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; document.body.appendChild(tipEl); }
    tipEl.textContent = text;
    tipEl.hidden = false;
    const r = el.getBoundingClientRect(), t = tipEl.getBoundingClientRect();
    tipEl.style.left = Math.max(8, Math.min(innerWidth - t.width - 8, r.left + r.width / 2 - t.width / 2)) + 'px';
    const above = r.top - t.height - 8 >= 8;
    tipEl.style.top = (above ? r.top - t.height - 8 : r.bottom + 8) + 'px';
    tipEl.classList.toggle('tip--above', above);
    tipEl.classList.toggle('tip--below', !above);
  }
  function hideTip() { if (tipEl) tipEl.hidden = true; }
  document.addEventListener('pointerover', ev => {
    const t = ev.target.closest && ev.target.closest('[data-tip]');
    if (t) tip(t, t.dataset.tip); else hideTip();
  });
  document.addEventListener('focusin', ev => {
    const t = ev.target.closest && ev.target.closest('[data-tip]');
    if (t) tip(t, t.dataset.tip);
  });
  document.addEventListener('focusout', hideTip);

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  const BASKET_KEY = 'gsi.basket';
  const DEFAULT_BASKET = ['0617-kt-600', '0618-kt-540', '0618-kt-1200', '0617-kt-900'];
  function readBasket() {
    try {
      const raw = sessionStorage.getItem(BASKET_KEY);
      if (raw) return JSON.parse(raw);
    } catch (err) { /* 세션 저장 불가 환경 — 기본 담김으로 시작 */ }
    return DEFAULT_BASKET.slice();
  }
  function writeBasket(list) {
    try { sessionStorage.setItem(BASKET_KEY, JSON.stringify(list)); } catch (err) { /* 저장 실패는 무시 */ }
  }

  /* ============================================================
     편성표
     ============================================================ */
  function initSchedule() {
    const $ = s => document.querySelector(s);
    /* 기본 조회 조건 — 초기화·요약 판정이 같은 값을 본다 (담을 때마다 사본을 준다) */
    const CO0 = CO.slice(0, 6).map(c => c.name);
    const TV0 = ['KBS1', 'KBS2', 'MBC', 'SBS'];
    /* 26-08-27 KT 요구 #2 — 8/20 에 5 → 9 로 올렸던 상한을 다시 5 로 내린다.
       편성표에서 5 개, 상세 페이지에서 5 개 → 분석 대상 총 10 개.
       상세 쪽 상한(X_MAX)은 analysis.html 에 있으니 둘을 함께 봐야 10 이 맞는다 */
    const BASKET_MAX = 5;   /* 26-08-20 KT #7 로 5 → 9, 26-08-27 KT 요구로 다시 9 → 5 */
    const CAT0 = ['패션', '잡화', '뷰티', '생활/주방', '스포츠레저', '식품/건강', '가구/홈데코', '유아/아동', '가전/디지털', '취미/펫', '여행/보험/렌탈/티켓', '기타'];
    /* 카테고리 색 = 공식 차트 팔레트(GRAPH light) 토큰만 — 신규 hex 0. 칩(on)과 편성 블록 틴트가 같은 변수를 쓴다 */
    const CAT_VAR = { '패션': '--graph-09', '잡화': '--graph-08', '뷰티': '--graph-03', '생활/주방': '--graph-04', '스포츠레저': '--graph-05', '식품/건강': '--graph-06',
      '가구/홈데코': '--graph-02', '유아/아동': '--graph-01', '가전/디지털': '--graph-10', '취미/펫': '--graph-07', '여행/보험/렌탈/티켓': '--graph-12', '기타': '--graph-11' };
    const catStyle = c => CAT_VAR[c] ? '--cat:var(' + CAT_VAR[c] + ')' : '';
    const S = {
      /* 26-08-20 KT #1 — 디폴트 = 최근 1달(어제까지 30일), 요일·시간대 미선택 = 전체 */
      from: addDays(TODAY, -30), to: TODAY, q: '',
      days: [0, 1, 2, 3, 4, 5, 6],
      /* 26-08-25 KT 요청 — 시간대는 구간 칩 배열이 아니라 시작~종료 한 구간. 디폴트 00~23 = 전체 */
      hFrom: 0, hTo: 23,
      day: null,   /* 타임라인이 펼쳐 보여주는 하루. null = 기간의 마지막 날(26-08-23) */
      cos: CO0.slice(), tvs: TV0.slice(), cats: CAT0.slice(),
      view: 'timeline', manual: false, mix: false, page: 1,
      basket: readBasket()
    };

    /* 조회 조건 */
    function rowNames(sel) {
      return [...$(sel).querySelectorAll('.chip:not(.chip--all)')].map(b => b.dataset.co || b.dataset.tv || b.dataset.cat);
    }
    function chipRow(sel, prop, max) {
      $(sel).addEventListener('click', ev => {
        const b = ev.target.closest('.chip');
        if (!b) return;
        /* 전체 선택 ↔ 전부 켜져 있으면 전체 해제 */
        if ('all' in b.dataset) {
          const names = rowNames(sel);
          S[prop] = S[prop].length === names.length ? [] : names.slice();
          paintChips(sel, prop, max); render(); return;
        }
        const v = b.dataset.co || b.dataset.tv || b.dataset.cat;
        const i = S[prop].indexOf(v);
        if (i >= 0) S[prop].splice(i, 1);
        else if (max && S[prop].length >= max) { toast('최대 ' + max + '개까지 선택'); return; }
        else S[prop].push(v);
        paintChips(sel, prop, max);
        render();
      });
    }
    function paintChips(sel, prop, max) {
      const full = max && S[prop].length >= max;
      $(sel).querySelectorAll('.chip:not(.chip--all)').forEach(b => {
        const v = b.dataset.co || b.dataset.tv || b.dataset.cat;
        const on = S[prop].includes(v);
        b.classList.toggle('is-on', on);
        b.classList.toggle('is-disabled', !on && full);
        if (!on && full) b.dataset.tip = '최대 ' + max + '개까지 선택'; else delete b.dataset.tip;
      });
      const allBtn = $(sel).querySelector('.chip--all');
      if (allBtn) allBtn.textContent = S[prop].length === rowNames(sel).length ? '전체 해제' : '전체 선택';
    }
    chipRow('#coRow', 'cos', 0);
    chipRow('#tvRow', 'tvs', 0);
    chipRow('#catRow', 'cats', 0);
    /* 요일·시간대 칩 — 값은 숫자(요일 0~6 · 시간대 인덱스). 전체 선택이 기본이고, 전부 끄면 전체와 같다 */
    function numRow(sel, prop, attr) {
      const paint = () => $(sel).querySelectorAll('.chip').forEach(b => b.classList.toggle('is-on', S[prop].includes(+b.dataset[attr])));
      $(sel).addEventListener('click', ev => {
        const b = ev.target.closest('.chip'); if (!b) return;
        const v = +b.dataset[attr], i = S[prop].indexOf(v);
        if (i >= 0) S[prop].splice(i, 1); else S[prop].push(v);
        paint(); render();
      });
      paint();
      return paint;
    }
    const paintDays = numRow('#dowRow', 'days', 'dow');
    /* 시간대 = 시작/종료 두 셀렉트. 0~23 을 코드로 채운다(정적 마크업이면 48줄이 늘어난다).
       시작이 종료를 넘어서면 넘어선 쪽을 끌고 간다 — 빈 결과가 나오는 조합을 아예 못 만들게(26-08-25) */
    const HH = h => String(h).padStart(2, '0') + '시';
    function fillHours(el) {
      el.innerHTML = Array.from({ length: 24 }, (_, h) => '<option value="' + h + '">' + HH(h) + '</option>').join('');
    }
    fillHours($('#hourFrom')); fillHours($('#hourTo'));
    const paintHours = () => { $('#hourFrom').value = S.hFrom; $('#hourTo').value = S.hTo; };
    $('#hourFrom').addEventListener('change', ev => {
      S.hFrom = +ev.target.value;
      if (S.hTo < S.hFrom) S.hTo = S.hFrom;
      paintHours(); render();
    });
    $('#hourTo').addEventListener('change', ev => {
      S.hTo = +ev.target.value;
      if (S.hFrom > S.hTo) S.hFrom = S.hTo;
      paintHours(); render();
    });
    paintHours();

    $('#q').addEventListener('input', ev => { S.q = ev.target.value.trim(); autoView(); render(); });
    $('#btnSearch').addEventListener('click', () => { autoView(); render(); });
    /* 26-08-20 KT #5 — 조회조건에 엑셀 다운로드. 실제 xlsx 생성은 서버(개발) 몫이라 여기선 조회 조건이 실린 파일명만 보여 준다 */
    $('#btnExcel').addEventListener('click', () => {
      const f = d => String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
      toast('종합편성표_' + f(S.from) + '_' + f(S.to) + '.xlsx 다운로드 — 조회 조건 그대로 생성(기존 편성표 다운로드 양식)');
    });
    $('#btnReset').addEventListener('click', () => {
      S.from = addDays(TODAY, -30); S.to = TODAY; S.q = ''; S.day = null;
      S.cos = CO0.slice(); S.tvs = TV0.slice(); S.cats = CAT0.slice();
      S.days = [0, 1, 2, 3, 4, 5, 6]; S.hFrom = 0; S.hTo = 23; paintDays(); paintHours();
      S.manual = false; S.page = 1;
      $('#q').value = '';
      paintChips('#coRow', 'cos', 17); paintChips('#tvRow', 'tvs', 8); paintChips('#catRow', 'cats', 0);
      /* 날짜 입력·기간 초과 경고까지 되돌린다 — 빠뜨리면 31일 초과 상태에서 조회 버튼이 잠긴 채 남는다 */
      syncDates(); autoView(); render();
    });

    /* 캘린더 */
    let calBox = null, calFor = null;
    function openCal(input, which) {
      closeCal();
      calFor = which;
      calBox = document.createElement('div');
      calBox.className = 'cal';
      const base = which === 'to' ? S.to : S.from;
      let ym = new Date(base.getFullYear(), base.getMonth(), 1);
      const draw = () => {
        calBox.textContent = '';
        const head = document.createElement('div'); head.className = 'cal__head';
        const prev = document.createElement('button'); prev.className = 'btn btn--xs'; prev.textContent = '‹';
        const next = document.createElement('button'); next.className = 'btn btn--xs'; next.textContent = '›';
        const t = document.createElement('span'); t.textContent = ym.getFullYear() + '.' + pad(ym.getMonth() + 1);
        prev.onclick = () => { ym = new Date(ym.getFullYear(), ym.getMonth() - 1, 1); draw(); };
        next.onclick = () => { ym = new Date(ym.getFullYear(), ym.getMonth() + 1, 1); draw(); };
        head.append(prev, t, next);
        const grid = document.createElement('div'); grid.className = 'cal__grid';
        DOW.forEach(d => { const s = document.createElement('span'); s.className = 'dow'; s.textContent = d; grid.appendChild(s); });
        const first = ym.getDay(), last = new Date(ym.getFullYear(), ym.getMonth() + 1, 0).getDate();
        for (let i = 0; i < first; i++) grid.appendChild(document.createElement('span'));
        for (let d = 1; d <= last; d++) {
          const b = document.createElement('button');
          b.textContent = d;
          const day = new Date(ym.getFullYear(), ym.getMonth(), d);
          if (+day === +S.from || +day === +S.to) b.className = 'is-sel';
          else if (day > S.from && day < S.to) b.className = 'is-range';
          /* 하루 선택 모드(스테퍼 라벨) — 기준일 이후는 잠근다. from/to 모드는 기존 그대로 */
          if (calFor === 'day' && day > NOW) b.disabled = true;
          b.onclick = () => {
            if (calFor === 'from') { S.from = day; if (S.to < day) S.to = day; }
            else if (calFor === 'to') { S.to = day; if (S.from > day) S.from = day; }
            else { S.from = day; S.to = day; }
            S.day = null;   /* 기간이 바뀌면 마지막 날부터 다시 본다 */
            closeCal(); syncDates(); autoView(); render();
          };
          grid.appendChild(b);
        }
        calBox.append(head, grid);
      };
      draw();
      document.body.appendChild(calBox);
      const r = input.getBoundingClientRect();
      calBox.style.left = Math.min(r.left, innerWidth - 320) + 'px';
      calBox.style.top = (r.bottom + 6) + 'px';
    }
    function closeCal() {
      if (calBox) { calBox.remove(); calBox = null; }
      $('#dayLabel').classList.remove('is-open');
    }
    /* 필 전체가 클릭 타깃 — 캘린더 아이콘을 눌러도 열린다 */
    $('#pillFrom').addEventListener('click', () => openCal($('#pillFrom'), 'from'));
    $('#pillTo').addEventListener('click', () => openCal($('#pillTo'), 'to'));
    document.addEventListener('pointerdown', ev => {
      if (calBox && !calBox.contains(ev.target) && !ev.target.closest('.pill') && !ev.target.closest('#dayLabel')) closeCal();
    });
    /* 달력은 fixed 라 스크롤하면 앵커에서 떨어져 떠 있게 된다 — 드롭다운 관례대로 스크롤 시작 시 닫는다 */
    addEventListener('scroll', () => { if (calBox) closeCal(); }, { passive: true });

    /* 기간을 유지한 채 타임라인이 보여줄 하루 — 기본은 마지막 날(최신), 스테퍼로 거슬러 올라간다 */
    function curDay() {
      const d = S.day || S.to;
      if (d < S.from) return S.from;
      if (d > S.to) return S.to;
      return d;
    }
    function days() {
      const out = [];
      const span = Math.round((S.to - S.from) / 86400000);
      for (let i = 0; i <= span; i++) {
        const d = addDays(S.from, i);
        out.push(d);
      }
      return out;
    }
    function syncDates() {
      $('#dateFrom').value = dotDate(S.from);
      $('#dateTo').value = dotDate(S.to);
      const span = Math.round((S.to - S.from) / 86400000) + 1;
      const over = span > 31;
      $('#rangeErr').hidden = !over;
      $('#pillTo').classList.toggle('is-error', over);
      $('#btnSearch').classList.toggle('is-disabled', over);
    }

    function autoView() {
      /* 26-08-23 — 기간이 길어도 타임라인이 기본이다. 기간 조회는 '마지막 날'을 펼쳐 보여주고
         날짜 스테퍼로 거슬러 올라간다(하루치를 시간축에 그리는 게 타임라인의 문법이므로).
         프로그램명 검색은 여러 날에 흩어진 결과를 모아 보는 것이라 여전히 리스트가 맞다 */
      const want = S.q ? 'list' : 'timeline';
      if (!S.manual) S.view = want;
      $('#viewNote').hidden = S.view === want;
      $('#viewNote').textContent = '조회 조건 기준 권장: ' + (want === 'list' ? '리스트' : '타임라인');
      document.querySelectorAll('.tabs [data-view]').forEach(b => b.classList.toggle('is-active', b.dataset.view === S.view));
    }
    document.querySelectorAll('.tabs [data-view]').forEach(b => b.addEventListener('click', () => {
      S.manual = true; S.view = b.dataset.view; autoView(); render();
    }));

    /* 조회일 스테퍼 — 날짜를 가운데 두고 좌우로 하루씩. 리스트 뷰에서도 같은 자리에 있다.
       멀리 갈 땐 ① 날짜 라벨 클릭 → 달력에서 바로 선택, ② ‹› 꾹 누르면 400ms 뒤부터 120ms 간격 연속 이동 */
    [['#dayPrev', -1], ['#dayNext', 1]].forEach(([sel, n]) => {
      const b = $(sel); let hold = null, rep = null, ran = false;
      const stop = () => { clearTimeout(hold); clearInterval(rep); hold = rep = null; };
      b.addEventListener('pointerdown', () => {
        stop(); ran = false;
        hold = setTimeout(() => { rep = setInterval(() => { ran = true; shiftDay(n); }, 120); }, 400);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, stop));
      /* 연속 이동이 돌았으면 손을 뗄 때 오는 click 은 삼킨다 — 한 칸 더 가지 않게 */
      b.addEventListener('click', () => { if (ran) { ran = false; return; } shiftDay(n); });
    });
    $('#dayLabel').addEventListener('click', () => {
      if (calBox && calFor === 'day') { closeCal(); return; }
      openCal($('#dayLabel'), 'day');
      $('#dayLabel').classList.add('is-open');
    });
    function shiftDay(n) {
      const d = addDays(curDay(), n);
      if (d > NOW || d < S.from || d > S.to) return;   /* 조회 기간 밖·기준일 이후로는 나가지 않는다 */
      S.day = d; render();
    }
    function renderDayStep(d) {
      $('#dayLabel').textContent = shortDate(d);
      const prev = addDays(d, -1), next = addDays(d, 1);
      const pb = $('#dayPrev'), nb = $('#dayNext');
      pb.classList.toggle('is-disabled', prev < S.from);
      pb.dataset.tip = prev < S.from ? '조회 기간의 첫날입니다' : '전날 ' + shortDate(prev);
      nb.classList.toggle('is-disabled', next > NOW || next > S.to);
      nb.dataset.tip = next > NOW ? '데이터 기준일(06.19) 이후는 조회할 수 없습니다'
        : next > S.to ? '조회 기간의 마지막 날입니다' : '다음날 ' + shortDate(next);
    }
    /* 표시 구간 미니맵 — 하루 24시간 폭 위에 지금 보고 있는 창을 되비추고, 그 창을 끌어 옮긴다 */
    const miniBar = $('#tlMiniBar');
    const hmCap = m => m >= 1440 ? '24:00' : hm(Math.round(m));
    /* 채널 열·성과 레일은 트랙 위에 고정으로 얹혀 있다 — 실제로 보이는 시간 폭은 그만큼 좁다 */
    function trackSpan(sc) {
      const ch = sc.querySelector('.tl__ch'), rail = sc.querySelector('.tl__rail');
      return Math.max(240, sc.clientWidth - (ch ? ch.offsetWidth : 0) - (rail ? rail.offsetWidth : 0));
    }
    function syncMini() {
      const sc = $('#tlScroll');
      if (S.view !== 'timeline' || !sc.clientWidth) return;
      const from = Math.min(1440, Math.max(0, sc.scrollLeft / 4));
      const to = Math.min(1440, from + trackSpan(sc) / 4);
      $('#tlMiniWin').style.left = (from / 1440 * 100) + '%';
      $('#tlMiniWin').style.width = ((to - from) / 1440 * 100) + '%';
      $('#tlMiniCap').textContent = hmCap(from) + ' – ' + hmCap(to) + ' 표시 중';
      miniBar.setAttribute('aria-valuenow', String(Math.round(from / 60)));
      miniBar.setAttribute('aria-valuetext', hmCap(from) + '부터 ' + hmCap(to) + '까지');
    }
    /* 창 밖을 누르면 그 지점이 창의 한가운데로 점프. 창 안을 잡으면 잡은 자리 그대로 끌린다(offset 유지) —
       창 안을 눌렀는데 창이 튀는 것이 가장 잡기 불편한 순간이었다 */
    let grabOff = null;   /* 잡은 지점 – 창 왼끝, 분 단위. null 이면 점프 모드 */
    /* 26-08-30 NOW 점프 — 현재 시각이 트랙 한가운데 오도록 스크롤.
       26-08-31 — 다른 날을 보고 있어도 버튼은 남고, 누르면 조회일을 오늘로 되돌린 뒤 즉시 이동 */
    function jumpNow() {
      /* 26-09-02 — 조회 기간에 오늘이 없으면 버튼을 숨기는 대신 기간을 통째로 오늘까지 당겨 온다.
         기간 길이는 그대로 둔다(31일 제한을 넘길 일이 없고, 하루 조회는 하루 조회로 남는다) */
      let dirty = false;
      if (!(dayAbs(S.from) <= dayAbs(NOW) && dayAbs(NOW) <= dayAbs(S.to))) {
        const span = Math.round((S.to - S.from) / 86400000);
        S.from = addDays(TODAY, -span); S.to = TODAY; S.day = null;
        syncDates(); autoView();
        toast('조회 기간을 ' + dotDate(S.from) + ' ~ ' + dotDate(S.to) + ' 로 되돌렸습니다');
        dirty = true;
      }
      if (dayAbs(curDay()) !== dayAbs(NOW)) { S.day = TODAY; dirty = true; }
      if (dirty) render();
      const sc = $('#tlScroll');
      const nowMin = NOW.getHours() * 60 + NOW.getMinutes();
      sc.scrollTo({ left: Math.max(0, nowMin * 4 - trackSpan(sc) / 2), behavior: 'smooth' });
    }
    $('#tlNowBtn').addEventListener('click', jumpNow);
    function miniSeek(clientX) {
      const sc = $('#tlScroll'), r = miniBar.getBoundingClientRect();
      const at = Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * 1440;
      const from = grabOff == null ? at - trackSpan(sc) / 8 : at - grabOff;
      sc.scrollLeft = Math.max(0, from * 4);
    }
    /* 채널 열(sticky)이 트랙 왼쪽을 덮는다 — 그 밑으로 들어가는 축 라벨과 블록 글자는
       조각으로 남기지 않고 통째로 감춘다. 좌표는 렌더 때 굳혀 두고 스크롤에선 비교만 한다 */
    let clipCache = [];
    function cacheBlocks() {
      clipCache = [...document.querySelectorAll('#tlRows .tl__blk, #laneRows .tl__blk')].map(el => ({
        el, left: parseFloat(el.style.left), right: parseFloat(el.style.left) + parseFloat(el.style.width), on: false
      }));
    }
    function syncClip() {
      const x = $('#tlScroll').scrollLeft;
      clipCache.forEach(b => {
        const on = b.left < x && b.right > x && b.right - x < 60;   /* 화면 밖으로 완전히 나간 블록은 건드리지 않는다 */
        if (on !== b.on) { b.on = on; b.el.classList.toggle('is-clipped', on); }
        /* 걸쳐 있는 블록은 글자를 가려진 폭만큼 밀어 준다 — 앞글자가 잘린 조각으로 남지 않게 */
        const over = b.left < x && b.right > x ? Math.round(x - b.left) : 0;
        const pad = over ? over + (b.el.classList.contains('tl__blk--tiny') ? 8 : 32) + 'px' : '';
        if (b.pad !== pad) { b.pad = pad; b.el.style.paddingLeft = pad; }
      });
      document.querySelectorAll('#tlAxis .tl__hour').forEach(l => {
        l.hidden = parseFloat(l.style.left) - x < 2;
      });
    }
    $('#tlScroll').addEventListener('scroll', () => { syncMini(); syncClip(); }, { passive: true });
    addEventListener('resize', syncMini);
    miniBar.addEventListener('pointerdown', ev => {
      miniBar.setPointerCapture(ev.pointerId);
      const w = $('#tlMiniWin').getBoundingClientRect(), r = miniBar.getBoundingClientRect();
      const inWin = ev.clientX >= w.left && ev.clientX <= w.right;
      grabOff = inWin ? (ev.clientX - w.left) / r.width * 1440 : null;
      miniBar.classList.add('is-dragging');
      miniSeek(ev.clientX);
    });
    miniBar.addEventListener('pointermove', ev => {
      if (miniBar.classList.contains('is-dragging')) miniSeek(ev.clientX);
    });
    const miniUp = () => { grabOff = null; miniBar.classList.remove('is-dragging'); };
    miniBar.addEventListener('pointerup', miniUp);
    miniBar.addEventListener('pointercancel', miniUp);
    /* 미니맵 위에서 휠 = 타임라인 가로 스크롤. 트랙패드 가로 제스처도 그대로 */
    miniBar.addEventListener('wheel', ev => {
      ev.preventDefault();
      const sc = $('#tlScroll');
      sc.scrollLeft = Math.max(0, sc.scrollLeft + (Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY) * 2);
    }, { passive: false });
    miniBar.addEventListener('keydown', ev => {
      const step = ev.key === 'ArrowLeft' ? -60 : ev.key === 'ArrowRight' ? 60 : 0;
      if (!step) return;
      ev.preventDefault();
      const sc = $('#tlScroll');
      sc.scrollLeft = Math.max(0, sc.scrollLeft + step * 4);
    });

    /* 위로가기 */
    const toTop = $('#toTop');
    if (toTop) {
      toTop.hidden = false;
      const showTop = () => toTop.classList.toggle('is-show', scrollY > 400);
      addEventListener('scroll', showTop, { passive: true });
      showTop();
      toTop.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
    }

    /* 채널 순서 — 구분 | 번호순 */
    $('#chOrder').addEventListener('click', ev => {
      const b = ev.target.closest('button[data-mix]');
      if (!b) return;
      S.mix = b.dataset.mix === '1';
      document.querySelectorAll('#chOrder button').forEach(x => x.classList.toggle('is-on', x === b));
      render();
    });

    /* 바구니 */
    function inBasket(id) { return S.basket.includes(id); }
    function toggleBasket(id) {
      const i = S.basket.indexOf(id);
      if (i >= 0) S.basket.splice(i, 1);
      else if (S.basket.length >= BASKET_MAX) { toast('분석 바구니는 최대 ' + BASKET_MAX + '개입니다'); return; }   /* 26-08-27 KT 요구: 9 → 5 (상세에서 5 개 더 담아 총 10) */
      else S.basket.push(id);
      writeBasket(S.basket); render();
    }
    $('#basketClear').addEventListener('click', () => { S.basket = []; writeBasket(S.basket); render(); });
    /* 상세 분석으로 — KT analysis 페이지가 읽는 형식(targets = 프로그램 객체 JSON 배열, channels = 일반채널 라벨 배열)으로 넘긴다.
       바구니 상한 5 = KT 바구니(4/5)·상세(targets.slice(0,5)) 상한과 동일 (26-08-27 재확인) */
    $('#btnAnalyze').addEventListener('click', () => {
      if (!S.basket.length) { toast('분석할 편성을 먼저 담아 주세요'); return; }
      const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      const targets = S.basket.map(entryById).filter(Boolean).slice(0, BASKET_MAX).map(e => ({
        id: e.id, date: iso(e.date), dateLabel: shortDate(e.date),
        companyName: e.co.name, platform: e.co.name,
        companyLogoUrl: e.co.logo ? 'assets/brand/' + e.co.logo : 'https://www.google.com/s2/favicons?domain=' + e.co.dm + '&sz=64',
        start: hm(e.start), end: hm(e.end), hour: Math.floor(e.start / 60),
        title: e.title, category: e.cat, price: e.price,
        expectedViewer: e.view == null ? 0 : e.view, expectedCall: e.cs === 'fixed' ? e.call : 0,
        status: '정상 종료'
      }));
      /* KT 정적 캡처는 URL 이 아니라 sessionStorage 에서 읽는다(원본 static-navigation.js 가 앵커 클릭 때 하던 일을 여기서 직접) */
      try {
        sessionStorage.setItem('gsi-program-analysis-cart', JSON.stringify(targets));
        sessionStorage.setItem('gsi-program-analysis-channel-labels', JSON.stringify(S.tvs));
      } catch (err) { /* 저장 불가 환경 — URL 파라미터로만 넘긴다 */ }
      location.href = 'analysis.html?targets=' + encodeURIComponent(JSON.stringify(targets)) +
        '&channels=' + encodeURIComponent(JSON.stringify(S.tvs));
    });
    $('#basketList').addEventListener('click', ev => {
      const b = ev.target.closest('[data-del]');
      if (b) toggleBasket(b.dataset.del);
    });

    /* 팝오버 */
    let pop = null, popTimer = 0, popFor = null;   /* 코드 정리 26-08-30 — blkMax 제거(대입만 있고 읽는 곳 0건). 원래: …, blkMax = 1; */
    function showPop(blk, e) {
      hidePop();
      popFor = e.id;
      pop = document.createElement('div');
      pop.className = 'pop';
      /* 26-08-30 미집계 표기 통일 — 값 자리는 "—", 상태는 옆 칩(집계 중)이 말한다. 4칸이 같은 꼴.
         원래: const vTxt = e.view == null ? '집계 중' : comma(e.view);  (값·칩에 "집계 중"이 두 번 찍혔다) */
      const vTxt = e.view == null ? '—' : comma(e.view);
      const vStat = e.vs === 'fixed' ? statChip('fixed', '확정')
        : e.vs === 'interim' ? statChip('interim', '잠정') : statChip('pending', '집계 중');
      const vWhen = e.vs === 'fixed' ? '시청 ' + shortDate(NOW).slice(0, 5) + ' 05:20 기준'
        : e.vs === 'interim' ? '시청 ' + hm(e.end + 30) + ' 기준 (10초 이상 시청 기준 대체 집계)'
          : '시청 ' + hm(e.end) + ' 종료 +4시간 후 반영';
      const cTxt = e.cs === 'fixed' ? comma(e.call) : '—';
      const cStat = e.cs === 'fixed' ? statChip('fixed', '확정') : statChip('pending', '집계 중');
      const cWhen = e.cs === 'fixed' ? '콜 ' + shortDate(addDays(e.date, 2)).slice(0, 5) + ' 08:00 반영' : '콜 ' + callBatch(e.date) + ' 예정';
      const wTxt = e.cs === 'fixed' && e.web != null ? comma(e.web) : '—';
      /* 메타는 뱃지 대신 한 줄 문장 — 카테고리·날짜·시간·가격이 같은 무게로 읽힌다 */
      const meta = [e.cat, shortDate(e.date), timeText(e) + ' (' + e.dur + '분)', priceText(e)].join(' · ');
      /* 동시간대 순위("동시간대 N편 중 M위") — 26-08-17 클라이언트가 제공하지 않는 지표로 확인되어 숨김.
         판정 로직(30분 이상 겹침 · 시청 내림차순 · 17개사 기준)은 아래 블록에 남겨 둔다 — 제공 시 주석만 풀면 된다
      let rankLine = '';
      if (e.view != null) {
        const peers = CO.flatMap(c => slots(c, e.date)).filter(x =>
          x.view != null && (x.id === e.id || Math.min(x.end, e.end) - Math.max(x.start, e.start) >= 30));
        if (peers.length > 1) {
          const rank = peers.filter(x => x.view > e.view).length + 1;
          rankLine = '<div class="pop__rank">동시간대 ' + peers.length + '편 중 <b>' + rank + '위</b></div>';
        }
      } */
      const rankLine = '';
      pop.innerHTML =
        '<div class="pop__body">' +
        '<img class="pop__img" src="' + prodImg(e) + '" alt="">' +
        '<div class="pop__title">' + e.title +
        (inBasket(e.id) ? '<span class="tl__in">담김 ✓</span>' : '') + '</div>' +
        '<div class="pop__meta">' + meta +
        (e.moved ? '<span class="pop__moved">편성 이동</span>' : '') + '</div>' +
        (e.moved ? '<div class="pop__note">원 편성시간 ' + hm((e.start + 1380) % 1440) + ' – ' + hm((e.end + 1380) % 1440) + '</div>' : '') +
        rankLine +
        /* 시청가구는 항상 2값(26-08-20 KT #9 확정) — 장시간 방송일수록 분UV 가 커지는 편향을 10초UV평균이 보정한다. 정의는 툴팁 */
        '<div class="pop__stats pop__stats--4">' +
        '<div><div class="k" data-tip="해당 채널에서 1분간 고유 시청자수 집계">시청가구(분UV) ' + (e.vs === 'interim' ? '(잠정)' : '') + '</div><div class="v">' + vTxt + ' ' + vStat + '</div></div>' +
        '<div><div class="k" data-tip="해당 채널 10초 평균값을 1분간 SUM 한 뒤 6으로 나눈 값">시청가구(10초UV평균)</div><div class="v">' + (e.uv10 == null ? '—' : comma(e.uv10)) + ' ' + vStat + '</div></div>' +  /* 26-08-30 칩 추가·"—" 통일. 원래: (e.uv10 == null ? '집계 중' : comma(e.uv10)) 칩 없음 */
        '<div><div class="k">콜 수</div><div class="v">' + cTxt + ' ' + cStat + '</div></div>' +
        /* 26-08-28 KT 요구 5번 — 「호버 시 콜수 옆에 웹반응 수 추가」.
           콜에서 파생되는 값이라 집계 시점도 콜과 같다(콜이 집계 중이면 웹도 집계 중).
           리스트 뷰가 이미 쓰던 e.web 을 그대로 쓴다 — 같은 화면에서 두 숫자가 다르면 안 된다 */
        '<div><div class="k" data-tip="TV 를 보고 모바일로 해당 홈쇼핑사 웹에 들어간 고객 수">웹 반응수</div><div class="v">' + wTxt + ' ' + cStat + '</div></div>' +
        '</div>' +
        '<div class="pop__when">' + vWhen + ' · ' + cWhen + '</div>' +
        '</div>';
      document.body.appendChild(pop);
      const r = blk.getBoundingClientRect(), pr = pop.getBoundingClientRect();
      pop.style.left = Math.max(8, Math.min(innerWidth - pr.width - 8, r.left)) + 'px';
      pop.style.top = (r.top - pr.height - 8 < 8 ? r.bottom + 8 : r.top - pr.height - 8) + 'px';
    }
    function hidePop() { if (pop) { pop.remove(); pop = null; popFor = null; } }
    document.addEventListener('pointerover', ev => {
      const blk = ev.target.closest && ev.target.closest('.tl__blk[data-id]');
      clearTimeout(popTimer);
      if (!blk) {
        if (pop && !ev.target.closest('.pop')) popTimer = setTimeout(hidePop, 120);
        return;
      }
      const e = entryById(blk.dataset.id);
      if (!e || popFor === e.id) return;
      popTimer = setTimeout(() => showPop(blk, e), 250);   /* 클릭(담기)과 겹치지 않을 만큼만 늦춘다 */
    });
    /* 키보드로 탭 이동해도 같은 상세가 뜬다 — 마우스 hover 로만 보이면 초점 사용자는 수치를 못 본다.
       탭은 의도적 이동이라 지연 없이 바로 띄운다 */
    document.addEventListener('focusin', ev => {
      const blk = ev.target.closest && ev.target.closest('.tl__blk[data-id]');
      clearTimeout(popTimer);
      if (!blk) { if (pop) hidePop(); return; }
      const e = entryById(blk.dataset.id);
      if (!e || popFor === e.id) return;
      showPop(blk, e);
    });

    /* 렌더 */
    /* 요일·시간대 필터(26-08-20 KT #1) — 시간대는 프로그램 시작 시간 기준. 전부 꺼져 있으면 "미선택 = 전체"로 본다 */
    const ZAP_TH = 5;   /* 재핑 임계 % — 판정은 서버 몫이라 화면은 고정값으로 선만 그린다(26-08-23) */
    /* 26-08-25 KT 요청 — 구간 칩(6시간 4구간 → 3시간 8구간)을 걷어내고 시작~종료 한 구간으로.
       되돌릴 땐 schedule.html #bandRow 주석과 함께 아래 두 줄을 살린다
       const BANDS = [[0, 3, '00–03'], [3, 6, '03–06'], [6, 9, '06–09'], [9, 12, '09–12'],
                      [12, 15, '12–15'], [15, 18, '15–18'], [18, 21, '18–21'], [21, 24, '21–24']]; */
    const dayOn = d => !S.days.length || S.days.includes(d.getDay());
    /* 종료 시각은 포함 — KT 가 말한 디폴트 "00시에서 23시" 가 하루 전체를 뜻하려면 23시대가 들어와야 한다 */
    const bandOn = e => { const h = Math.floor(e.start / 60); return h >= S.hFrom && h <= S.hTo; };
    function filtered(d) {
      if (!dayOn(d)) return [];
      const cos = CO.filter(c => S.cos.includes(c.name));
      return cos.map(co => ({
        co,
        /* 카테고리 칩은 거르지 않는다 — 전 프로그램을 두고 켜진 카테고리만 색을 입힌다(26-08-20 KT #4, 기존 편성표 경험 유지) */
        list: slots(co, d).filter(e => bandOn(e) && (!S.q || e.title.includes(S.q)))
      }));
    }

    /* 결과 헤더 한 줄 유지 — 좁아지면 보조 정보부터 물러난다: ① 미니맵 캡션 ② 권장 뷰 안내.
       컨트롤(채널 순서·재핑 임계)과 미니맵 본체는 끝까지 남긴다. 고정선(--res-line)도 같이 갱신 */
    function fitHeader() {
      /* 세로 스크롤바 실측 — 바구니 바가 100vw(스크롤바 포함) 로 넘치지 않게 하는 보정값 */
      document.documentElement.style.setProperty('--sbw', (window.innerWidth - document.documentElement.clientWidth) + 'px');
      const tabs = document.querySelector('.card--clip .tabs');
      if (!tabs) return;
      tabs.classList.remove('is-tight', 'is-tighter');
      if (tabs.scrollWidth > tabs.clientWidth) tabs.classList.add('is-tight');
      /* 코드 정리 26-08-30 — ①을 접은 뒤 다시 재서 그래도 넘칠 때만 ②. 원래는 같은 조건을 두 번 검사해 항상 둘이 같이 붙었다:
         if (tabs.scrollWidth > tabs.clientWidth) tabs.classList.add('is-tighter'); */
      if (tabs.classList.contains('is-tight') && tabs.scrollWidth > tabs.clientWidth) tabs.classList.add('is-tighter');
      document.documentElement.style.setProperty('--res-line', Math.round(60 + tabs.offsetHeight) + 'px');
    }
    function render() {
      const ds = days();
      const single = ds.length === 1;
      const rowsAll = ds.map(d => filtered(d));
      const total = rowsAll.reduce((a, rs) => a + rs.reduce((b, r) => b + r.list.length, 0), 0);
      const DOWN = ['일', '월', '화', '수', '목', '금', '토'];
      const fDays = S.days.length && S.days.length < 7 ? ' · ' + [1, 2, 3, 4, 5, 6, 0].filter(i => S.days.includes(i)).map(i => DOWN[i]).join('') + '요일' : '';
      const fBands = S.hFrom === 0 && S.hTo === 23 ? '' : ' · ' + HH(S.hFrom) + '–' + HH(S.hTo);
      $('#resCount').textContent = S.cos.length + '사 · ' + total + '편' + (ds.length > 1 ? ' · ' + ds.filter(dayOn).length + '일' : '') + fDays + fBands;

      const d0 = curDay();
      const callFixed = dayAbs(d0) + 2880 + 480 <= NOW_ABS;
      const isToday = single && dayAbs(d0) === dayAbs(NOW);
      /* 집계 상태는 이 줄에 한 번만 — 아래 범례·레일에서 다시 말하지 않는다 */
      $('#aggLine').innerHTML =
        ico(isToday ? 'loader' : 'check') +
        '시청 ' + (isToday ? '일부 집계 중 · 종료 +4시간 순차 반영' : '확정 ' + shortDate(NOW).slice(0, 5) + ' 05:20') +
        '<i class="sep"></i>' + ico(callFixed ? 'check' : 'loader') +
        '콜 ' + (callFixed ? '확정 ' + shortDate(addDays(d0, 2)).slice(0, 5) + ' 08:00' : callBatch(d0) + ' 예정');

      $('#viewTimeline').hidden = S.view !== 'timeline';
      $('#viewList').hidden = S.view === 'timeline';
      /* 줄2 는 통째로 타임라인용 보조 컨트롤(행 정렬·채도 범례·표시 구간) — 리스트에서는 내린다 */
      $('#tlMini').hidden = S.view !== 'timeline';
      $('#chOrder').hidden = S.view !== 'timeline';
      renderDayStep(d0);
      if (S.view === 'timeline') renderTimeline(d0, filtered(d0));
      else renderList(ds, rowsAll);
      fitHeader();
      renderBasket();
    }

    function renderTimeline(d, rows) {
      const axis = document.getElementById('tlAxis');
      axis.textContent = '';
      for (let h = 0; h <= 24; h++) {
        if (h < 24) {
          const lb = document.createElement('span');
          lb.className = 'tl__hour'; lb.style.left = (h * 240) + 'px';
          lb.textContent = pad(h) + ':00';
          axis.appendChild(lb);
        }
        const tk = document.createElement('span');
        tk.className = 'tl__tick'; tk.style.left = (h * 240) + 'px';
        axis.appendChild(tk);
        if (h < 24) {
          const half = document.createElement('span');
          half.className = 'tl__tick'; half.style.left = (h * 240 + 120) + 'px';
          axis.appendChild(half);
        }
      }
      const b0 = document.createElement('span');
      b0.className = 'tl__date'; b0.style.left = '8px';
      b0.textContent = (d.getMonth() + 1) + '.' + d.getDate();
      axis.appendChild(b0);
      const b1 = document.createElement('span');
      b1.className = 'tl__date tl__date--next'; b1.style.left = (24 * 240 - 52) + 'px';
      const nx = addDays(d, 1);
      b1.textContent = (nx.getMonth() + 1) + '.' + nx.getDate();
      axis.appendChild(b1);
      /* 26-08-30 NOW — 표시일이 오늘이면 09:20 자리에 세로선(.tl__now, .tl__inner 안 고정 요소) + 축 배지 + 미니맵 눈금 + 점프 버튼 */
      const isToday = dayAbs(d) === dayAbs(NOW);
      const nowMin = NOW.getHours() * 60 + NOW.getMinutes();
      const nowLine = document.getElementById('tlNow');
      nowLine.hidden = !isToday;
      nowLine.style.left = 'calc(var(--tl-ch) + ' + (nowMin * 4) + 'px)';
      if (isToday) {
        const cap = document.createElement('span');
        cap.className = 'tl__now-cap'; cap.style.left = (nowMin * 4) + 'px';
        cap.textContent = 'NOW ' + pad(NOW.getHours()) + ':' + pad(NOW.getMinutes());
        axis.appendChild(cap);
      }
      const miniNow = document.getElementById('tlMiniNow');
      miniNow.hidden = !isToday; miniNow.style.left = (nowMin / 1440 * 100) + '%';
      /* 26-09-02 — NOW 버튼은 어떤 날짜·기간에서도 항상 둔다.
         오늘이 조회 기간 밖이면 jumpNow 가 기간을 오늘까지 당겨 오므로 숨길 이유가 없다
         (26-08-31 의 '기간 밖이면 숨김'은 폐기) */
      document.getElementById('tlNowBtn').hidden = false;

      const sums = rows.map(r => {
        const done = r.list.filter(e => e.view != null);
        return {
          co: r.co, list: r.list,
          view: done.reduce((a, e) => a + e.view, 0),
          call: done.every(e => e.cs === 'fixed') && done.length ? done.reduce((a, e) => a + e.call, 0) : null,
          n: done.length
        };
      });
      /* 채널 번호 순. 자사 행은 맨 위 — 나머지 행에만 정렬이 걸린다 */
      sums.sort((a, b) => a.co.no - b.co.no);
      const ownAt = sums.findIndex(s => s.co.own);
      if (ownAt > 0) sums.unshift(sums.splice(ownAt, 1)[0]);

      /* 게이지 폭의 기준 — 그날 화면에 깔린 블록 중 최대 시청 */
      /* 코드 정리 26-08-30 — 미사용: blkMax = Math.max(1, ...sums.map(s => Math.max(0, ...s.list.map(x => x.view || 0)))); */
      const host = document.getElementById('tlRows');
      host.textContent = '';
      /* 일반채널 행 — 기본은 홈쇼핑 아래 회색 밴드(.lane), 번호순 섞기(S.mix)면 홈쇼핑 행 사이에 번호 순서로 끼운다 */
      function laneRow(t) {
        const row = document.createElement('div');
        row.className = 'tl__row lane__row';
        row.innerHTML =
          '<div class="tl__ch"><span class="no">' + t.no + '</span><span class="colog">' + t.id.slice(0, 1) +
          '<img src="assets/brand/brand-' + t.id.toLowerCase() + '.png" alt="" loading="lazy"></span>' +
          '<span class="name">' + t.id + '</span></div>' +
          '<div class="tl__track"></div>' +
          '<div class="tl__rail"><span class="m">편성 정보</span></div>';
        const track = row.querySelector('.tl__track');
        t.plan.forEach(([s2, dur, title]) => {
          const b = document.createElement('div');
          b.className = 'tl__blk' + (dur * 4 < 120 ? ' tl__blk--tiny' : dur * 4 < 160 ? ' tl__blk--mid' : '');
          b.style.left = (s2 * 4 + 6) + 'px';
          b.style.width = (dur * 4 - 12) + 'px';
          b.innerHTML = '<span class="t"><span class="nm">' + title + '</span></span><span class="h">' + hm(s2) + ' – ' + hm(s2 + dur) + '</span>';
          track.appendChild(b);
          zapMarks(track, b, t.id + '|' + s2, s2, s2 + dur, title);
        });
        return row;
      }
      const lanes = TV.filter(t => S.tvs.includes(t.id)).sort((a, b) => a.no - b.no);
      /* 번호순 섞기 — 자사는 여전히 맨 위, 그 아래는 홈쇼핑·일반채널 구분 없이 채널 번호 순 */
      /* [시안] 채널 하루 시청 추이 스파크라인 — 시청 합계 아래, 그 채널만의 스케일(채널 간 비교 아님).
         데모는 블록 시청자수를 방송 시간에 고르게 펴서 시간대별로 묶은 값. 실서비스는 채널별 시간대 시청 시계열이 있어야 한다 */
      function sparkline(s) {
        const W = 136, H = 22, buckets = new Array(24).fill(0);
        s.list.forEach(e => {
          if (e.view == null) return;
          const per = e.view / e.dur;
          for (let m = e.start; m < e.end; m++) buckets[Math.floor((m % 1440) / 60)] += per;
        });
        const max = Math.max(...buckets);
        if (!max) return '';
        const pts = buckets.map((v, i) => [(i / 23 * W).toFixed(1), (H - 1 - v / max * (H - 3)).toFixed(1)]);
        const line = pts.map(([x, y], i) => (i ? 'L' : 'M') + x + ' ' + y).join(' ');
        const gid = 'sp-' + s.co.id;
        return '<svg class="tl__rail-sp" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' +
          '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#6941FF" stop-opacity=".28"/><stop offset="1" stop-color="#6941FF" stop-opacity="0"/></linearGradient></defs>' +
          '<path d="' + line + ' L' + W + ' ' + H + ' L0 ' + H + ' Z" fill="url(#' + gid + ')"/>' +
          '<path d="' + line + '" fill="none" stroke="#6941FF" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>';
      }
      const merged = S.mix
        ? [...sums.map(x => ({ no: x.co.no, own: !!x.co.own, co: x })), ...lanes.map(t => ({ no: t.no, tv: t }))]
            .sort((a, b) => (b.own - a.own) || (a.no - b.no))
        : sums.map(x => ({ co: x }));
      merged.forEach(m => {
        if (m.tv) { host.appendChild(laneRow(m.tv)); return; }
        const s = m.co;
        const row = document.createElement('div');
        row.className = 'tl__row' + (s.co.own ? ' is-own' : '');
        row.innerHTML =
          '<div class="tl__ch"><span class="no">' + s.co.no + '</span>' + coLogo(s.co) +
          '<span class="name">' + s.co.name + '</span>' +
          (s.co.own ? '<span class="tag">자사</span>' : '') + '</div>' +
          '<div class="tl__track"></div>' +
          /* 채널 하루 성과의 "N사 중 M위" 순위·상대비교 게이지·툴팁 — 26-08-17 클라이언트 미제공 지표로 확인되어 숨김(시청 합계·콜만 남김).
             제공되면 되살릴 마크업(순위 = 시청 합계 내림차순, 게이지 폭 = min-max 정규화 24~100%):
             data-tip="N사 중 시청 합계 상대 비교 · 시청 {comma(view)}명 · {편수} 중 {집계 완료 편수}편 시청 집계 완료"
             '<span class="rk">N사 중 M위</span>'  (tl__rail-v 안, 시청 b 뒤)
             '<span class="tl__rail-g"><span class="minibar"><i style="width:{24~100}%"></i></span></span>'  (tl__rail-v 다음 줄) */
          '<div class="tl__rail">' +
          /* 줄1 = 시청 합계 · (우측) 콜 합계 한 줄, 줄2 = 추이. 미집계 콜은 자리 자체를 비운다 — 전역 상태는 줄1 캡션이 이미 말했다 */
          /* 26-08-20 KT #8 — 채널 하루 지표는 분UV(집계 빠르고 최신 반영) 하나로, 정의는 툴팁 */
          '<span class="tl__rail-v"><span data-tip="채널별 시청가구(분UV) 하루 합계 — 1분간 고유 시청자수 기준. 10초UV평균 대비 집계가 빠르고 최신 데이터를 먼저 반영">분UV</span> <b class="num">' + compact(s.view) + '</b>' +
          (s.call == null ? '' : '<span class="tl__rail-c">콜 ' + comma(s.call) + '</span>') + '</span>' +
          sparkline(s) + '</div>';
        const track = row.querySelector('.tl__track');
        /* 26-08-25 KT 요청 — 타임라인 재핑 표시는 홈쇼핑 채널에서 빼고 일반 채널(KBS~MBC)에만 둔다.
           되돌릴 땐 아래 주석 줄로 교체하고 laneRow 의 zapMarks 호출을 지운다
           s.list.forEach(e => { const bk = block(e); track.appendChild(bk); zapMarks(track, bk, e); }); */
        s.list.forEach(e => track.appendChild(block(e)));
        host.appendChild(row);
      });

      const laneHost = document.getElementById('laneRows');
      laneHost.textContent = '';
      laneHost.parentElement.hidden = S.mix;
      if (!S.mix) lanes.forEach(t => laneHost.appendChild(laneRow(t)));

      const scroll = document.getElementById('tlScroll');
      if (!scroll.dataset.init) { scroll.scrollLeft = 9 * 240; scroll.dataset.init = '1'; }
      cacheBlocks();
      syncMini();
      syncClip();
    }

    /* 26-08-20 KT #11 (위치 정정 26-08-23 · 대상 정정 26-08-25) — 재핑 = 직전 1분 대비 시청자 감소율이 임계 이상인 시점.
       26-08-25 KT 요구: 타임라인 재핑은 홈쇼핑사가 아니라 일반 채널만 → 그리는 대상을 일반채널 레인으로 옮겼다.
       홈쇼핑 블록 쪽에 있던 폭 보정(has-zap 자리 확보 · 좁으면 시청자수 숫자 제거)은 같이 걷어냈다 —
       일반채널 블록엔 숫자가 없어 선과 겹칠 것이 없다. 되돌릴 땐 render 의 주석 줄을 살린다.
       프로그램 종료 직전 3분 각각에 감소율 후보(−3.0~−9.9%)를 두고 임계(ZAP_TH) 이상인 분만 그린다.
       임계 판정은 서버 몫이므로 화면에 조절 컨트롤은 두지 않는다(26-08-23).
       값은 더미 — 실제 재핑 테이블 1일치로 재검증 필요 */
    /* 26-08-27 KT #1 — 같은 재핑을 타임라인과 리스트 두 곳에서 그리게 됐다.
       두 화면이 다른 숫자를 말하면 안 되므로 후보 계산은 여기 한 곳에서만 한다 */
    function zapList(key, start, end, title) {
      const out = [];
      for (let k = 3; k >= 1; k--) {
        const m = end - k;
        if (m <= start) continue;
        const drop = -(3 + Math.round(hash(key + ':z' + m) * 69) / 10);
        if (drop > -ZAP_TH) continue;
        out.push({ m: m, drop: drop,
          tip: title + ' ' + hm(m) + ' 재핑 · 직전 1분 대비 ' + drop.toFixed(1) + '%' });
      }
      return out;
    }
    function zapMarks(track, blk, key, start, end, title) {
      const zs = zapList(key, start, end, title);
      const drawn = zs.length;
      zs.forEach(function (zp) {
        const z = document.createElement('i');
        z.className = 'tl__zap';
        /* 블록 우측 라운드(8px) 안쪽으로 들인다 — 모서리에 걸치면 선이 밖으로 삐져나온 것처럼 보인다(26-08-23) */
        z.style.left = (zp.m * 4 - 14) + 'px';
        z.dataset.tip = zp.tip;
        track.appendChild(z);
      });
      /* 줄이 선 만큼 블록 오른쪽에 자리를 비운다 — 프로그램명이 선 위로 올라오지 않게(26-08-23) */
      if (!drawn) return;
      blk.classList.add('has-zap');
      blk.style.setProperty('--zapw', (drawn * 4 + 12) + 'px');
    }

    function block(e) {
      const w = e.dur * 4;
      const tiny = w < 120;                       /* 30분 미만 — 프로그램명만, 나머지는 팝오버 */
      const b = document.createElement('div');
      const cls = ['tl__blk'];
      if (e.view == null) cls.push('tl__blk--pending');
      /* 성과(상위 25/10%) 틴트는 26-08-20 KT #4 로 삭제 — 블록 색 = 카테고리, 켜진 카테고리만 */
      if (S.cats.includes(e.cat)) cls.push('tl__blk--cat');
      if (tiny) cls.push('tl__blk--tiny');
      else if (w < 160) cls.push('tl__blk--mid');
      if (w < 56) cls.push('tl__blk--floor');
      b.className = cls.join(' ');
      b.dataset.id = e.id;
      b.dataset.cat = e.cat;
      b.style.cssText = catStyle(e.cat);
      /* 담기가 되는 블록만 초점을 받는다 — 집계 중 블록은 눌러도 할 일이 없어 탭 순서만 늘린다.
         마우스는 클릭, 키보드는 Enter/Space 로 같은 토글(아래 keydown) */
      if (e.view != null) {
        b.tabIndex = 0;
        b.setAttribute('role', 'button');
        b.setAttribute('aria-pressed', inBasket(e.id) ? 'true' : 'false');
      }
      /* 좌우 6px 씩 물려 블록 사이에 12px 거터를 낸다 — 붙어 있으면 한 판으로 읽힌다 */
      b.style.left = (e.start * 4 + 6) + 'px';
      b.style.width = Math.max(56, w - 12) + 'px';
      const inb = inBasket(e.id);
      b.innerHTML =
        callDots(e) +
        '<span class="t">' + (e.onair ? '<span class="tl__onair">ON AIR</span>' : '') + '<span class="nm">' + e.title + '</span>' +
        (inb ? '<span class="tl__in">담김 ✓</span>' : '') + '</span>' +
        /* 시간 줄 우측에 축약 시청자수(21.4만 꼴) — 미집계면 같은 자리에 "집계 중".
           세 줄로 쌓으면 64px 블록에서 위아래가 잘린다(ON AIR 뱃지·시간 줄이 잘려 보이던 원인) */
        '<span class="h">' + timeText(e) +
        (tiny ? '' : e.view == null ? '<span class="st">집계 중</span>' : '<span class="vw">' + compact(e.view) + '</span>') + '</span>';
      /* 담기 UI 는 따로 없다 — 블록 클릭이 곧 담기 토글 */
      if (e.view != null) {
        b.addEventListener('click', () => toggleBasket(e.id));
        b.addEventListener('keydown', ev => {
          if (ev.key !== 'Enter' && ev.key !== ' ') return;
          ev.preventDefault();   /* Space 로 화면이 스크롤되는 것 막기 */
          toggleBasket(e.id);
          /* 담기는 전체 재렌더라 눌린 블록이 새로 그려진다 — 초점을 같은 자리로 되돌리지 않으면
             키보드 사용자가 탭 순서 처음으로 튕긴다 */
          const back = document.querySelector('.tl__blk[data-id="' + e.id + '"]');
          if (back) back.focus();
        });
      }
      return b;
    }

    /* KT 리스트 UX — 자사 편성이 축. 시간대마다 [시각 + 일반채널 편성] 밴드 아래
       그 시간의 자사 방송 한 행. 타사 비교는 타임라인이 담당한다 */
    function renderList(ds, rowsAll) {
      let all = [];
      ds.forEach((d, i) => rowsAll[i].forEach(r => { all = all.concat(r.list); }));
      /* 26-08-28 KT 요구 5번 — 「당일 조회 시 방송 중인 프로그램을 리스트 첫 행에 고정하고 on air 표시」.
         시각 밴드는 행마다 자기 묶음(.plist__grp)을 갖고 있어서, 행이 앞으로 나오면 그 시각 헤더도
         함께 따라 올라간다 — 22시 방송이 맨 위면 「22:00」 밴드가 먼저 오고 그 아래 00:00 부터 이어진다.
         조회 날짜가 오늘이 아니면 onair 가 아무 데도 안 붙으니 정렬은 예전 그대로다 */
      all = all.filter(e => e.co.own).sort((a, b) => {
        if (!!a.onair !== !!b.onair) return a.onair ? -1 : 1;
        return (+a.date + a.start) - (+b.date + b.start);
      });
      const per = 24, pages = Math.max(1, Math.ceil(all.length / per));
      if (S.page > pages) S.page = 1;
      const body = document.getElementById('listBody');
      body.textContent = '';
      const tvs = TV.filter(t => S.tvs.includes(t.id));
      all.slice((S.page - 1) * per, S.page * per).forEach(e => {
        const h = Math.floor(e.start / 60);
        const band = document.createElement('div');
        band.className = 'plist__hour';
        band.innerHTML =
          '<span class="hh num">' + String(h).padStart(2, '0') + ':00</span>' +
          /* 26-08-27 KT #1 — 타임라인 재핑 표시처럼 리스트에도 표시.
             방식: 시각 축에 앉히지 않고 일반채널 칸을 늘려 그 공간에 눈금을 세운다.
             그래서 이 밴드의 일반채널 칸 안에, 그 프로그램 종료 직전 재핑이 몇 번이었는지를 눈금으로만 보인다.
             값·색은 타임라인의 재핑 세로줄과 같은 계산(zapList)·같은 적색이다 */
          tvs.map(t => {
            const p = t.plan.find(p => p[0] <= h * 60 && h * 60 < p[0] + p[1]);
            if (!p) return '';
            const zs = zapList(t.id + '|' + p[0], p[0], p[0] + p[1], t.id + ' ' + p[2]);
            return '<span class="plist__tv"><b>' + t.id + '</b><i></i>' + p[2] +
              '<i></i><span class="num">' + hm(p[0]) + ' – ' + hm(p[0] + p[1]) + '</span>' +
              (zs.length ? '<i></i><span class="plist__zap"><em>재핑</em>' +
                zs.map(z => '<span class="zk" data-tip="' + z.tip + '"></span>').join('') + '</span>' : '') +
              '</span>';
          }).join('');
        /* 26-08-23 KT #6 — 시간 밴드를 sticky 로 붙이려면 밴드마다 자기 구역이 있어야 한다
           (평평한 형제 나열이면 지나간 밴드들이 고정선에 겹쳐 쌓인다) */
        const grp = document.createElement('div');
        grp.className = 'plist__grp';
        grp.appendChild(band);
        body.appendChild(grp);
        const row = document.createElement('div');
        row.className = 'plist__row' + (e.onair ? ' is-onair' : '');
        const inb = inBasket(e.id);
        row.innerHTML =
          '<img class="plist__thumb" src="' + prodImg(e) + '" alt="" loading="lazy">' +
          '<div class="plist__id">' +
          '<div class="plist__chips">' +
          /* 방송 중 표시는 날짜보다 앞 — 지금 켜져 있다는 게 그 줄에서 가장 먼저 읽혀야 한다.
             모양은 타임라인의 ON AIR(.tl__onair)와 같은 것을 쓴다. 한 화면에서 같은 뜻이 두 모양이면 안 된다 */
          (e.onair ? '<span class="tl__onair">ON AIR</span>' : '') +
          '<span class="pchip pchip--em num">' + shortDate(e.date) + '</span>' +
          '<span class="pchip">' + coLogo(e.co) + e.co.name + '</span>' +
          '<span class="pchip num">' + timeText(e) + '</span>' +
          '<span class="pchip pchip--em">' + e.cat + '</span>' + '</div>' +
          '<div class="plist__title">' + e.title + '</div>' +
          '<div class="plist__price">' + priceText(e) + '</div>' +
          '</div>' +
          '<div class="plist__stats">' +
          '<div><span class="k">' + ico('users') + '시청가구(분UV)</span><b class="num">' + (e.view == null ? '집계 중' : comma(e.view)) + '</b></div>' +
          '<div><span class="k">' + ico('phone') + '콜</span><b class="num">' + (e.cs === 'fixed' ? comma(e.call) : '집계 중') + '</b></div>' +
          '</div>' +
          (e.view == null ? '' :
            '<button class="btn plist__add' + (inb ? '' : ' btn--primary') + '">' +
            (inb ? '담김 ✓' : ico('plus') + '담기') + '</button>');
        /* 행 클릭도, 버튼 클릭도 같은 토글 — 버튼은 어포던스일 뿐 동작은 하나다 */
        if (e.view != null) {
          row.classList.add('is-pickable');
          row.addEventListener('click', () => toggleBasket(e.id));
        }
        grp.appendChild(row);
      });
      const pager = document.getElementById('listPager');
      pager.textContent = '';
      for (let p = 1; p <= pages; p++) {
        const b = document.createElement('button');
        b.textContent = p;
        if (p === S.page) b.className = 'is-on';
        b.onclick = () => { S.page = p; render(); };
        pager.appendChild(b);
      }
    }

    function renderBasket() {
      /* 빈 바구니는 바 자체를 내린다 — 담긴 게 없으면 안내할 것도 없다 */
      document.querySelector('.basket').hidden = !S.basket.length;
      document.getElementById('basketCount').innerHTML = ico('cart', 'md') + '분석 바구니 ' + S.basket.length + ' / ' + BASKET_MAX;
      const host = document.getElementById('basketList');
      host.textContent = '';
      S.basket.forEach(id => {
        const e = entryById(id);
        if (!e) return;
        const s = document.createElement('span');
        s.className = 'basket__item';
        s.innerHTML = '<span class="nm">' + e.title + '</span><span>' + shortDate(e.date) + '</span>' +
          '<button class="delbtn" data-del="' + id + '" aria-label="' + e.title + ' 제거">' + ico('close') + '</button>';
        host.appendChild(s);
      });
      renderCompareSheet();
    }

    /* 분석 진입 전 훑어보기 — 바 위로 펼쳐지는 비교 시트. 담는 동안 계속 열어 둘 수 있다 */
    let cmpOpen = false, cmpSort = { k: 'view', dir: -1 };
    function renderCompareSheet() {
      const sheet = document.getElementById('cmpSheet');
      sheet.hidden = !cmpOpen || !S.basket.length;
      document.getElementById('basketCompare').textContent = sheet.hidden ? '비교 보기' : '비교 닫기';
      if (sheet.hidden) return;
      document.getElementById('cmpCount').textContent = S.basket.length + '건 · 막대 = 최대 대비';
      /* 표 헤더 고정선 = 시트 제목 행 아래. 제목 행 높이가 바뀌어도 따라가게 변수로 넘긴다(26-08-23) */
      sheet.style.setProperty('--cmp-head', sheet.querySelector('.card__head').offsetHeight + 'px');
      const body = document.getElementById('cmpBody');
      body.textContent = '';
      /* 담은 순이 아니라 성과순으로 세워야 비교가 된다. 정렬 축은 헤더 클릭으로 바꾼다 */
      /* 컬럼 = 26-08-20 KT #10 확정 명칭 11개(채널·프로그램명·카테고리·방송일·방송시작·방송종료·가격·시청가구 2종·콜반응고객수·웹반응고객수) */
      const keyf = {
        co: x => x.e.co.name, title: x => x.e.title, cat: x => x.e.cat,
        date: x => +x.e.date, start: x => x.e.start, end: x => x.e.end, price: x => x.e.price || 0,
        uv10: x => x.e.uv10 || 0, view: x => x.e.view || 0,
        call: x => x.e.cs === 'fixed' ? x.e.call : -1, web: x => x.e.web == null ? -1 : x.e.web
      }[cmpSort.k];
      const list = S.basket.map(entryById).filter(Boolean)
        .map(e => ({ e, per: e.view == null ? null : Math.round(e.view * (STAY_FIX[e.id] || e.stay) / e.dur) }))
        .sort((a, b) => {
          const va = keyf(a), vb = keyf(b);
          return cmpSort.dir * (typeof va === 'string' ? va.localeCompare(vb) : va - vb);
        });
      document.querySelectorAll('#cmpSheet .sortable').forEach(th => {
        th.removeAttribute('aria-sort');
        if (th.dataset.sort === cmpSort.k) th.setAttribute('aria-sort', cmpSort.dir === 1 ? 'ascending' : 'descending');
      });
      const mv = Math.max(1, ...list.map(x => x.e.view || 0));
      const mu = Math.max(1, ...list.map(x => x.e.uv10 || 0));
      const mc = Math.max(1, ...list.map(x => x.e.cs === 'fixed' ? x.e.call : 0));
      const mw = Math.max(1, ...list.map(x => x.e.web || 0));
      const cell = (v, max) => v == null ? '<td class="num is-pending">집계 중</td>'
        : '<td class="num' + (v === max ? ' is-top' : '') + '">' + comma(v) +
          '<span class="minibar"><i style="width:' + Math.round(v / max * 100) + '%"></i></span></td>';
      list.forEach(({ e, per }) => {
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td><span class="co">' + coLogo(e.co) + e.co.name + '</span></td>' +
          '<td>' + e.title + '</td><td>' + e.cat + '</td>' +
          '<td>' + shortDate(e.date) + '</td><td>' + hm(e.start) + '</td><td>' + hm(e.end) + '</td>' +
          '<td class="num">' + priceText(e) + '</td>' +
          cell(e.uv10, mu) + cell(e.view, mv) +
          (e.cs === 'fixed' ? cell(e.call, mc) : '<td class="num is-pending">집계 중</td>') +
          (e.web != null ? cell(e.web, mw) : '<td class="num is-pending">집계 중</td>');
        body.appendChild(tr);
      });
    }
    document.getElementById('basketCompare').addEventListener('click', () => {
      if (!S.basket.length) { toast('담긴 편성이 없습니다'); return; }
      cmpOpen = !cmpOpen; renderCompareSheet();
    });
    document.getElementById('cmpClose').addEventListener('click', () => { cmpOpen = false; renderCompareSheet(); });
    document.querySelectorAll('#cmpSheet .sortable').forEach(th => th.addEventListener('click', () => {
      if (cmpSort.k === th.dataset.sort) cmpSort.dir *= -1;
      else cmpSort = { k: th.dataset.sort, dir: ['co', 'title', 'cat'].includes(th.dataset.sort) ? 1 : -1 };
      renderCompareSheet();
    }));

    /* 26-08-20 KT #6 — 스크롤 상하 이동 시 조회결과 영역 고정.
       탭 행(구분·날짜 스테퍼)은 CSS sticky(GNB 아래 60px). 시간축(.tl__axis)은 가로 스크롤 컨테이너 안이라 페이지 기준 sticky 가 불가 →
       축이 탭 행 밑으로 사라지는 동안만 같은 폭의 복제본을 fixed 로 띄우고 가로 스크롤을 따라 붙인다 */
    (function stickyAxis() {
      const tabs = document.querySelector('.card--clip .tabs');
      let ghost = null, src = null;
      function update() {
        const axis = document.querySelector('#tlScroll .tl__axis');
        const scroll = axis && axis.closest('.tl__scroll');
        if (!axis || !scroll || S.view !== 'timeline' || scroll.offsetParent === null) { if (ghost) { ghost.remove(); ghost = null; } return; }
        const line = tabs.getBoundingClientRect().bottom;                 /* 탭 행 아래 = 고정선 */
        const a = axis.getBoundingClientRect(), sc = scroll.getBoundingClientRect();
        const show = a.top < line && sc.bottom > line + a.height;
        if (!show) { if (ghost) { ghost.remove(); ghost = null; } return; }
        if (!ghost || src !== axis) {
          if (ghost) ghost.remove();
          src = axis; ghost = axis.cloneNode(true); ghost.classList.add('tl__axis--ghost'); ghost.setAttribute('aria-hidden', 'true');
          document.body.appendChild(ghost);
        }
        ghost.style.top = line + 'px'; ghost.style.left = sc.left + 'px'; ghost.style.width = sc.width + 'px';
        ghost.style.setProperty('--gx', -scroll.scrollLeft + 'px');
      }
      addEventListener('scroll', update, { passive: true });
      addEventListener('resize', update);
      document.addEventListener('scroll', ev => { if (ev.target && ev.target.classList && ev.target.classList.contains('tl__scroll')) update(); }, true);
      new MutationObserver(update).observe(document.getElementById('tlRows'), { childList: true });
    })();

    /* 26-08-23 KT #6 — 리스트 뷰의 '기준 시간'(시간 밴드)이 결과 헤더 아래에 붙도록 고정선을 유지한다.
       폭이 바뀌면 헤더 한 줄 규칙(fitHeader)도 함께 다시 맞춘다 */
    addEventListener('resize', fitHeader);

    syncDates(); autoView(); render();
  }

  if (document.getElementById('tlRows')) initSchedule();
})();
