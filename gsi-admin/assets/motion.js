/* ============================================================
   모션 — reveal 스태거 + 숫자 카운트업
   사용법:
     <div data-reveal>                → 뷰포트 진입 시 fade-rise
     <div data-reveal style="--d:80ms"> → 지연 스태거
     <span data-count="259978">0</span> → 카운트업 (콤마 포맷)
     <span data-count="10.5" data-count-fmt="fixed1">
   ============================================================ */
(function () {
  'use strict';
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* reveal — threshold는 타깃 높이 비례라 뷰포트보다 큰 카드는 비율 조건이
     영영 안 차므로, 진입 픽셀 기준(1% + 하단 60px 마진)으로 판정 */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.01, rootMargin: '0px 0px 120px 0px' });

  const seen = new WeakSet();
  const hook = root => {
    root.querySelectorAll('[data-reveal]').forEach(n => {
      if (seen.has(n)) return; seen.add(n); io.observe(n);
    });
    /* 같은 그룹 내 자동 스태거: data-reveal-group 자식들에 60ms 간격 부여 */
    root.querySelectorAll('[data-reveal-group]').forEach(g => {
      [...g.children].forEach((c, i) => {
        if (seen.has(c)) return; seen.add(c);
        c.setAttribute('data-reveal', '');
        c.style.setProperty('--d', (i * 60) + 'ms');
        io.observe(c);
      });
    });
    root.querySelectorAll('[data-count]').forEach(n => {
      if (seen.has(n)) return; seen.add(n); cio.observe(n);
    });
  };

  /* JS로 뒤늦게 렌더되는 노드도 자동 관찰 */
  new MutationObserver(() => hook(document.body)).observe(document.body, { childList: true, subtree: true });

  /* count-up */
  const fmt = (v, mode) => {
    if (mode === 'fixed1') return v.toFixed(1);
    if (mode === 'time') { // 631 → 10:31 (분:초 아님, 시각표시는 정적 권장)
      return Math.round(v).toLocaleString('ko-KR');
    }
    return Math.round(v).toLocaleString('ko-KR');
  };
  const ease = t => 1 - Math.pow(1 - t, 3);

  const cio = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      cio.unobserve(e.target);
      const node = e.target;
      const target = parseFloat(node.dataset.count);
      const mode = node.dataset.countFmt;
      if (REDUCED || isNaN(target)) { node.textContent = fmt(target || 0, mode); return; }
      const dur = 900;
      const t0 = performance.now();
      const step = now => {
        const p = Math.min(1, (now - t0) / dur);
        node.textContent = fmt(target * ease(p), mode);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.4 });

  hook(document.body);
})();
