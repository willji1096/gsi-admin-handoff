/* ══════════════════════════════════════════════════════════════════════
   26-09-20 ③ KT 킷 셸 동작 — 시험판(ds.html) 전용

   KT 킷의 LNB 는 ui_common.js 가 움직이는데 그 파일이 아직 안 왔다
   (_ds-kt/resource/js/ 는 빈 폴더 · 9/16 이후 미수령).
   킷 CSS 가 기대하는 클래스만 똑같이 붙였다 붙였다 하는 최소 구현이다 —
   KT JS 가 오면 이 파일은 통째로 버린다.

   킷이 쓰는 약속:
     li.open   … 2차 메뉴 펼침
     li.on     … 현재 메뉴
     .layout.lnb-off … LNB 접힘
   cp.js 는 건드리지 않는다(라이브와 같은 파일).
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ── 1차 메뉴 펼침/접기 ── */
  $$('#lnb .lnb-dep1 > li').forEach(li => {
    const open = () => {
      const was = li.classList.contains('open');
      $$('#lnb .lnb-dep1 > li').forEach(x => x.classList.remove('open'));
      li.classList.toggle('open', !was);
    };
    const a = li.querySelector(':scope > a'), arrow = li.querySelector(':scope > .ico-lnb-arrow');
    [a, arrow].forEach(el => el && el.addEventListener('click', e => { e.preventDefault(); open(); }));
  });

  /* ── LNB 접기 ── */
  const toggle = $('#lnb .btn-lnb-toggle');
  if (toggle) toggle.addEventListener('click', () => {
    const layout = $('#layout');
    layout.classList.toggle('lnb-off');
    toggle.setAttribute('aria-expanded', String(!layout.classList.contains('lnb-off')));
  });

  /* ── 페이지 머리의 오늘 날짜 — 킷 화면이 「Today 2023-10-11 13:25」 꼴로 쓴다 ── */
  const stamp = $('#todayStamp');
  if (stamp) {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    stamp.textContent = `Today ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  /* ── 단계 탭이 <a> 가 되면서 기본 동작(#으로 점프)이 생겼다. cp.js 의 클릭 처리는 그대로 두고 점프만 막는다 ── */
  $$('.cm-tab.ty-main .step').forEach(a => a.addEventListener('click', e => e.preventDefault()));

  /* ── 활성 탭 표시를 킷에게 넘긴다 ──
     cp.js:246 은 <a class="step"> 에 is-active 를 건다. 킷은 바깥 <li> 의 on 으로 모양을 준다
     (ui_common.css:3144 — 700 · #111). 둘을 잇지 않으면 우리가 킷 색을 흉내 내야 하고,
     KT 가 탭 모양을 바꿔 보내면 우리 흉내만 옛날 값으로 남는다. 그래서 클래스만 옮겨 붙인다.
     cp.js 는 건드리지 않는다(라이브와 같은 파일). */
  const 탭들 = $$('.cm-tab.ty-main .tab-list');
  const 탭동기화 = () => 탭들.forEach(li => li.classList.toggle('on', !!li.querySelector('.step.is-active')));
  탭동기화();
  $$('.cm-tab.ty-main .step').forEach(a =>
    new MutationObserver(탭동기화).observe(a, { attributes: true, attributeFilter: ['class'] }));
})();
