/* ============================================================
   KTC — KT 홈쇼핑 어드민 공용 차트 엔진 (SVG, 의존성 없음)
   - lineChart   : 멀티 라인/에어리어 + 크로스헤어 툴팁
   - columnChart : 그룹/스택 컬럼 + per-mark 툴팁
   - mirrorChart : 유입(위)/유출(아래) 미러 바 + 순유입 라인
   - spark       : KPI 타일용 스파크라인
   모든 차트: 뷰포트 진입 시 드로우인 모션, reduced-motion 존중
   ============================================================ */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 유틸 ─────────────────────────────────── */
  const el = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  const fmtComma = n => Math.round(n).toLocaleString('ko-KR');
  const fmtCompact = n => {
    const a = Math.abs(n);
    if (a >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, '') + '억';
    if (a >= 10000)     return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만';
    /* 천 단위 영문 k 금지 — 억·만 한글 표기와 혼재돼 콤마 원값으로 (표기 통일, 26-08-04) */
    return fmtComma(n);
  };

  function niceTicks(min, max, count = 4) {
    if (min === max) max = min + 1;
    const span = max - min;
    const step0 = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const norm = step0 / mag;
    const step = (norm >= 5 ? 10 : norm >= 2.2 ? 5 : norm >= 1.2 ? 2 : 1) * mag;
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step * 0.001; v += step) ticks.push(v);
    return { lo, hi, ticks };
  }

  /* ── 툴팁 싱글턴 ──────────────────────────── */
  let tt = null;
  function tooltip() {
    if (!tt) { tt = document.createElement('div'); tt.className = 'viz-tooltip'; document.body.appendChild(tt); }
    return tt;
  }
  function showTT(x, y, title, rows) {
    const t = tooltip();
    t.textContent = '';
    const h = document.createElement('div'); h.className = 'tt-title'; h.textContent = title; t.appendChild(h);
    rows.forEach(r => {
      const row = document.createElement('div'); row.className = 'tt-row';
      const k = document.createElement('span'); k.className = 'k'; k.style.background = r.color; row.appendChild(k);
      const name = document.createElement('span'); name.textContent = r.name; row.appendChild(name);
      const v = document.createElement('span'); v.className = 'v'; v.textContent = r.value; row.appendChild(v);
      if (r.delta != null) { const d = document.createElement('span'); d.className = 'tt-d ' + (r.deltaDir || ''); d.textContent = r.delta; row.appendChild(d); }
      t.appendChild(row);
    });
    const pad = 14, W = t.offsetWidth || 150;
    let px = x + pad; if (px + W > innerWidth - 8) px = x - W - pad;
    t.style.left = px + 'px';
    t.style.top = Math.max(8, y - 10) + 'px';
    t.classList.add('is-on');
  }
  function hideTT() { if (tt) tt.classList.remove('is-on'); }

  /* ── 뷰포트 진입 애니메이션 ───────────────── */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.__ktcEnter && e.target.__ktcEnter(); io.unobserve(e.target); }
    });
  }, { threshold: 0.25 });

  function animateOnEnter(container, fn) {
    if (REDUCED) return;
    container.__ktcEnter = fn;
    io.observe(container);
  }

  /* ── 공통 프레임 (grid + y ticks + x labels) ── */
  function frame(svg, o) {
    const { padL, padR, padT, padB, W, H, lo, hi, ticks, xLabels, xEvery } = o;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const y = v => padT + plotH - ((v - lo) / (hi - lo)) * plotH;
    const g = el('g', {}, svg);
    ticks.forEach(t => {
      el('line', { x1: padL, x2: W - padR, y1: y(t), y2: y(t), stroke: 'var(--grid)', 'stroke-width': 1 }, g);
      el('text', {
        x: padL - 8, y: y(t) + 4, 'text-anchor': 'end',
        fill: 'var(--tick)', 'font-size': 11, style: 'font-variant-numeric:tabular-nums'
      }, g).textContent = o.yFmt(t);
    });
    // baseline
    el('line', { x1: padL, x2: W - padR, y1: y(lo), y2: y(lo), stroke: 'var(--axis)', 'stroke-width': 1 }, g);
    // x labels
    if (xLabels) {
      const n = xLabels.length;
      const xPos = i => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
      xLabels.forEach((lb, i) => {
        if (i % (xEvery || 1) !== 0 && i !== n - 1) return;
        el('text', {
          x: o.xBand ? padL + ((i + 0.5) / n) * plotW : xPos(i),
          y: H - padB + 18, 'text-anchor': 'middle',
          fill: 'var(--tick)', 'font-size': 11, style: 'font-variant-numeric:tabular-nums'
        }, g).textContent = lb;
      });
    }
    return { y, plotW, plotH };
  }

  function baseSVG(container, hOpt) {
    container.classList.add('chart-box');
    container.textContent = '';
    const W = Math.max(320, container.clientWidth || 600);
    const H = hOpt || 260;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H });
    svg.style.width = '100%'; svg.style.height = 'auto';
    container.appendChild(svg);
    return { svg, W, H };
  }

  /* ============================================================
     lineChart(container, opts)
     opts: { xLabels, series:[{name,color,values,area?,dash?,emph?}],
             height?, yFmt?, xEvery?, endLabel? }
     ============================================================ */
  function lineChart(container, opts) {
    const render = () => {
      const { svg, W, H } = baseSVG(container, opts.height || 280);
      const padL = opts.padL != null ? opts.padL : 46, padR = opts.padR != null ? opts.padR : (opts.endLabel ? 74 : 18), padT = 14, padB = 30;
      const all = opts.series.flatMap(s => s.values);
      let { lo, hi, ticks } = niceTicks(Math.min(0, ...all), Math.max(...all));
      if (opts.min != null) lo = opts.min;
      const yFmt = opts.yFmt || fmtCompact;
      const { y, plotW } = frame(svg, { padL, padR, padT, padB, W, H, lo, hi, ticks, xLabels: opts.xLabels, xEvery: opts.xEvery || Math.ceil(opts.xLabels.length / 8), yFmt });
      const n = opts.xLabels.length;
      const x = i => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);

      const paths = [];
      opts.series.forEach((s, si) => {
        const d = s.values.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
        if (s.area) {
          const a = el('path', {
            d: d + ` L ${x(n - 1)} ${y(lo)} L ${x(0)} ${y(lo)} Z`,
            fill: s.color, opacity: 0.09
          }, svg);
          paths.push({ node: a, type: 'area', si });
        }
        const p = el('path', {
          d, fill: 'none', stroke: s.color,
          'stroke-width': s.emph === false ? 1.5 : 2,
          'stroke-linejoin': 'round', 'stroke-linecap': 'round',
          ...(s.dash ? { 'stroke-dasharray': s.dash } : {})
        }, svg);
        paths.push({ node: p, type: 'line', dashOrig: s.dash, si });
        // 끝점 마커 + 엔드 라벨 (선택 직접 라벨)
        el('circle', { cx: x(n - 1), cy: y(s.values[n - 1]), r: 4, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2 }, svg);
        if (opts.endLabel) {
          el('text', {
            x: x(n - 1) + 9, y: y(s.values[n - 1]) + 4,
            fill: 'var(--ink-2)', 'font-size': 11, 'font-weight': 700,
            style: 'font-variant-numeric:tabular-nums'
          }, svg).textContent = yFmt(s.values[n - 1]);
        }
      });

      // 드로우인
      if (!REDUCED) {
        paths.forEach(p => {
          if (p.type === 'line' && !p.dashOrig) {
            const L = p.node.getTotalLength();
            p.node.style.strokeDasharray = L;
            p.node.style.strokeDashoffset = L;
          } else { p.node.style.opacity = 0; }
        });
        animateOnEnter(container, () => {
          paths.forEach((p, i) => {
            p.node.style.transition = `stroke-dashoffset .9s ${i * 90}ms cubic-bezier(.22,.8,.36,1), opacity .7s ${i * 90}ms ease`;
            if (p.type === 'line' && !p.dashOrig) p.node.style.strokeDashoffset = 0;
            else p.node.style.opacity = p.type === 'area' ? '' : 1;
            if (p.type === 'area') p.node.style.opacity = 0.09;
          });
        });
      }

      // 크로스헤어 + 툴팁
      const cross = el('line', { y1: padT, y2: H - padB, stroke: 'var(--axis)', 'stroke-width': 1, opacity: 0 }, svg);
      const hit = el('rect', { x: padL, y: padT, width: plotW, height: H - padT - padB, fill: 'transparent' }, svg);
      hit.addEventListener('pointermove', e => {
        const r = svg.getBoundingClientRect();
        const sx = (e.clientX - r.left) * (W / r.width);
        const i = Math.max(0, Math.min(n - 1, Math.round(((sx - padL) / plotW) * (n - 1))));
        cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i));
        cross.setAttribute('opacity', 1);
        showTT(e.clientX, e.clientY, opts.xLabels[i],
          opts.series.map(s => {
            const row = { name: s.name, color: s.color, value: (opts.ttFmt || fmtComma)(s.values[i]) };
            if (opts.tooltipDelta && i > 0) {
              const dv = s.values[i] - s.values[i - 1];
              row.delta = (dv >= 0 ? '+' : '−') + (opts.ttFmt ? opts.ttFmt(Math.abs(dv)) : fmtComma(Math.abs(dv)));
              row.deltaDir = dv >= 0 ? 'up' : 'down';
            }
            return row;
          }));
      });
      hit.addEventListener('pointerleave', () => { cross.setAttribute('opacity', 0); hideTT(); });

      /* 레전드 hover 포커스 (추가만 — 기존 호출부 무영향, 05 chipLegend에서 사용) */
      container.__ktcFocus = function (idx) {
        paths.forEach(p => {
          if (p.type === 'area') p.node.style.opacity = (p.si === idx) ? 0.14 : 0.02;
          else { p.node.style.opacity = (idx == null || p.si === idx) ? 1 : 0.16; p.node.style.strokeWidth = (p.si === idx) ? 2.6 : ''; }
        });
      };
      container.__ktcClear = function () {
        paths.forEach(p => {
          if (p.type === 'area') p.node.style.opacity = 0.09;
          else { p.node.style.opacity = 1; p.node.style.strokeWidth = ''; }
        });
      };
    };
    render();
    watchResize(container, render);
  }

  /* ============================================================
     columnChart(container, opts)
     opts: { xLabels, series:[{name,color,values}], stacked?,
             height?, yFmt?, xEvery?, maxBar? }
     ============================================================ */
  function columnChart(container, opts) {
    const render = () => {
      const { svg, W, H } = baseSVG(container, opts.height || 260);
      const padL = opts.padL != null ? opts.padL : 46, padR = opts.padR != null ? opts.padR : 12, padT = 14, padB = 30;
      const n = opts.xLabels.length;
      const sums = opts.stacked
        ? opts.xLabels.map((_, i) => opts.series.reduce((a, s) => a + s.values[i], 0))
        : opts.series.flatMap(s => s.values);
      const { lo, hi, ticks } = niceTicks(0, Math.max(...sums));
      const yFmt = opts.yFmt || fmtCompact;
      const { y, plotW, plotH } = frame(svg, { padL, padR, padT, padB, W, H, lo, hi, ticks, xLabels: opts.xLabels, xEvery: opts.xEvery || Math.ceil(n / 12), yFmt, xBand: true });
      const band = plotW / n;
      const groups = opts.stacked ? 1 : opts.series.length;
      const gapIn = 2;
      const barW = Math.min(opts.maxBar || 24, (band * 0.66 - gapIn * (groups - 1)) / groups);
      const bars = [];

      opts.xLabels.forEach((lb, i) => {
        const cx = padL + band * (i + 0.5);
        let acc = 0;
        opts.series.forEach((s, si) => {
          const v = s.values[i];
          let bx, by, bh;
          if (opts.stacked) {
            bx = cx - barW / 2;
            const y0 = y(acc), y1 = y(acc + v);
            by = y1; bh = Math.max(0, y0 - y1 - (si < opts.series.length - 1 ? 2 : 0)); // 2px surface gap
            acc += v;
          } else {
            const total = groups * barW + (groups - 1) * gapIn;
            bx = cx - total / 2 + si * (barW + gapIn);
            by = y(v); bh = y(0) - y(v);
          }
          const isTop = opts.stacked ? (si === opts.series.length - 1) : true;
          const rTop = isTop ? Math.min(4, barW / 2) : 0;
          const p = el('path', {
            d: roundTopRect(bx, by, barW, Math.max(bh, 0), rTop),
            fill: s.color
          }, svg);
          p.__data = { i, si };
          bars.push(p);
        });
        // hover hit (밴드 전체)
        const hit = el('rect', { x: padL + band * i, y: padT, width: band, height: plotH, fill: 'transparent' }, svg);
        hit.addEventListener('pointermove', e => {
          bars.forEach(b => b.style.opacity = b.__data.i === i ? 1 : 0.45);
          showTT(e.clientX, e.clientY, lb,
            opts.series.map(s => ({ name: s.name, color: s.color, value: (opts.ttFmt || fmtComma)(s.values[i]) })));
        });
        hit.addEventListener('pointerleave', () => { bars.forEach(b => b.style.opacity = 1); hideTT(); });
      });

      if (!REDUCED) {
        bars.forEach(b => {
          b.style.transformBox = 'fill-box';
          b.style.transformOrigin = 'bottom';
          b.style.transform = 'scaleY(0)';
        });
        animateOnEnter(container, () => {
          bars.forEach((b, i) => {
            b.style.transition = `transform .6s ${Math.min(i * 9, 500)}ms cubic-bezier(.22,.8,.36,1)`;
            b.style.transform = 'scaleY(1)';
          });
        });
      }
    };
    render();
    watchResize(container, render);
  }

  /* ============================================================
     mirrorChart — 유입(위) / 유출(아래) + 순유입 라인(선택)
     opts: { xLabels, up:{name,color,values}, down:{name,color,values},
             net?:{name,color,values}, height?, xEvery? }
     ============================================================ */
  function mirrorChart(container, opts) {
    const render = () => {
      const { svg, W, H } = baseSVG(container, opts.height || 280);
      const padL = opts.padL != null ? opts.padL : 52, padR = opts.padR != null ? opts.padR : 14, padT = 14, padB = 30;
      const n = opts.xLabels.length;
      const maxV = Math.max(...opts.up.values, ...opts.down.values.map(Math.abs),
        ...(opts.net ? opts.net.values.map(Math.abs) : [0]));
      const { hi, ticks } = niceTicks(0, maxV, 2);
      const lo = -hi;
      const allTicks = [...ticks.map(t => -t).reverse().slice(0, -1), ...ticks];
      const plotW = W - padL - padR, plotH = H - padT - padB;
      const y = v => padT + plotH - ((v - lo) / (hi - lo)) * plotH;
      const g = el('g', {}, svg);
      allTicks.forEach(t => {
        el('line', { x1: padL, x2: W - padR, y1: y(t), y2: y(t), stroke: t === 0 ? 'var(--axis)' : 'var(--grid)', 'stroke-width': 1 }, g);
        el('text', { x: padL - 8, y: y(t) + 4, 'text-anchor': 'end', fill: 'var(--tick)', 'font-size': 11, style: 'font-variant-numeric:tabular-nums' }, g)
          .textContent = fmtCompact(t);
      });
      const band = plotW / n;
      const barW = Math.min(10, band * 0.6);
      const xEvery = opts.xEvery || Math.ceil(n / 8);
      opts.xLabels.forEach((lb, i) => {
        if (i % xEvery === 0 || i === n - 1)
          el('text', { x: padL + band * (i + 0.5), y: H - padB + 18, 'text-anchor': 'middle', fill: 'var(--tick)', 'font-size': 11 }, g).textContent = lb;
      });

      const bars = [];
      opts.xLabels.forEach((lb, i) => {
        const cx = padL + band * (i + 0.5);
        const uv = opts.up.values[i], dv = Math.abs(opts.down.values[i]);
        const u = el('path', { d: roundTopRect(cx - barW / 2, y(uv), barW, y(0) - y(uv) - 1, 3), fill: opts.up.color }, svg);
        const dH = y(-dv) - y(0) - 1;
        const dvNode = el('path', { d: roundBottomRect(cx - barW / 2, y(0) + 1, barW, Math.max(dH, 0), 3), fill: opts.down.color }, svg);
        bars.push({ node: u, dir: 'up' }, { node: dvNode, dir: 'down' });
        const hit = el('rect', { x: padL + band * i, y: padT, width: band, height: plotH, fill: 'transparent' }, svg);
        hit.addEventListener('pointermove', e => {
          const rows = [
            { name: opts.up.name, color: opts.up.color, value: '+' + fmtComma(uv) },
            { name: opts.down.name, color: opts.down.color, value: '−' + fmtComma(dv) }
          ];
          if (opts.net) rows.push({ name: opts.net.name, color: opts.net.color, value: signed(opts.net.values[i]) });
          showTT(e.clientX, e.clientY, lb, rows);
        });
        hit.addEventListener('pointerleave', hideTT);
      });

      let netPath = null;
      if (opts.net) {
        const x = i => padL + band * (i + 0.5);
        const d = opts.net.values.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
        netPath = el('path', { d, fill: 'none', stroke: opts.net.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      }

      if (!REDUCED) {
        bars.forEach(b => {
          b.node.style.transformBox = 'fill-box';
          b.node.style.transformOrigin = b.dir === 'up' ? 'bottom' : 'top';
          b.node.style.transform = 'scaleY(0)';
        });
        if (netPath) { const L = netPath.getTotalLength(); netPath.style.strokeDasharray = L; netPath.style.strokeDashoffset = L; }
        animateOnEnter(container, () => {
          bars.forEach((b, i) => {
            b.node.style.transition = `transform .5s ${Math.min(i * 5, 420)}ms cubic-bezier(.22,.8,.36,1)`;
            b.node.style.transform = 'scaleY(1)';
          });
          if (netPath) { netPath.style.transition = 'stroke-dashoffset 1s .35s cubic-bezier(.22,.8,.36,1)'; netPath.style.strokeDashoffset = 0; }
        });
      }
    };
    render();
    watchResize(container, render);
  }

  /* ── spark(container, values, color) ─────────── */
  function spark(container, values, color, w = 96, h = 30) {
    container.textContent = '';
    const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h });
    container.appendChild(svg);
    const min = Math.min(...values), max = Math.max(...values);
    const x = i => 2 + (i / (values.length - 1)) * (w - 8);
    const y = v => 2 + (h - 6) * (1 - (max === min ? 0.5 : (v - min) / (max - min)));
    const d = values.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
    el('path', { d, fill: 'none', stroke: color || 'var(--series-deemph)', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    el('circle', { cx: x(values.length - 1), cy: y(values[values.length - 1]), r: 2.6, fill: color || 'var(--series-1)' }, svg);
  }

  /* ── 도형/기타 헬퍼 ──────────────────────────── */
  function roundTopRect(x, y, w, h, r) {
    if (h <= 0) return `M ${x} ${y} h ${w} v 0 h ${-w} Z`;
    r = Math.min(r, w / 2, h);
    return `M ${x} ${y + h} V ${y + r} Q ${x} ${y} ${x + r} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} V ${y + h} Z`;
  }
  function roundBottomRect(x, y, w, h, r) {
    if (h <= 0) return `M ${x} ${y} h ${w} v 0 h ${-w} Z`;
    r = Math.min(r, w / 2, h);
    return `M ${x} ${y} H ${x + w} V ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} H ${x + r} Q ${x} ${y + h} ${x} ${y + h - r} Z`;
  }
  const signed = n => (n >= 0 ? '+' : '−') + fmtComma(Math.abs(n));

  function watchResize(container, render) {
    let t0 = 0;
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      if (Math.abs(w - t0) < 8) return;
      t0 = w; render();
    });
    ro.observe(container);
  }

  /* ============================================================
     sankey — 유입 → 체류 → 결과 플로우
     가독성 장치: ①색은 1단계 유입원을 끝까지 따라감(후속 리본이
     유입원별 스트라이프로 분해) ②노드/리본 호버 시 해당 경로만
     하이라이트 ③노드 직접 라벨(값+점유율)
     opts: {
       stages: ['유입 채널','체류','결과'],           // 단계명(개수 자유)
       order:  [[...],[...],[...]],                  // 단계별 노드 순서
       colors: { '지상파':'var(--series-1)', ... },  // 1단계 노드 → 색
       flows:  [{ path:['지상파','1–5분','콜 전환'], value: 320 }, ...],
       height?, valueFmt?
     }
     ============================================================ */
  function sankey(container, opts) {
    const render = () => {
      const H = opts.height || 400;
      const { svg, W } = baseSVG(container, H);
      const padL = 132, padR = 152, padT = 30, padB = 10;
      const plotW = W - padL - padR, plotH = H - padT - padB;
      const nS = opts.stages.length;
      const fmt = opts.valueFmt || fmtComma;
      const GAP = 14, BARW = 10;

      /* 노드 집계 */
      const nodes = {}; // name -> {stage, idx, value}
      opts.order.forEach((names, s) => names.forEach((nm, i) => nodes[nm] = { stage: s, idx: i, value: 0, name: nm }));
      // 노드 값 = 통과 유량 합
      opts.flows.forEach(f => f.path.forEach(nm => { nodes[nm].value += f.value; }));

      /* 스케일: 전 컬럼 공통 */
      let scale = Infinity;
      opts.order.forEach(names => {
        const sum = names.reduce((a, nm) => a + nodes[nm].value, 0);
        scale = Math.min(scale, (plotH - GAP * (names.length - 1)) / sum);
      });

      /* 노드 y 배치 (컬럼 세로 중앙 정렬) */
      const colX = s => padL + (s / (nS - 1)) * plotW;
      opts.order.forEach((names, s) => {
        const totalH = names.reduce((a, nm) => a + nodes[nm].value * scale, 0) + GAP * (names.length - 1);
        let y0 = padT + (plotH - totalH) / 2;
        names.forEach(nm => {
          nodes[nm].x = colX(s); nodes[nm].y = y0; nodes[nm].h = nodes[nm].value * scale;
          y0 += nodes[nm].h + GAP;
        });
      });

      /* 리본(플로우×구간) 오프셋 — 교차 최소화 정렬 */
      const flowColor = f => opts.colors[f.path[0]];
      const segs = []; // {f, s, x0,y0,x1,y1,th, node}
      for (let s = 0; s < nS - 1; s++) {
        const offOut = {}, offIn = {};
        // 출구 정렬: (현재, 다음, 그 다음, 이전) 순 — 교차 최소화
        [...opts.flows].sort((a, b) =>
          nodes[a.path[s]].idx - nodes[b.path[s]].idx ||
          nodes[a.path[s + 1]].idx - nodes[b.path[s + 1]].idx ||
          (s + 2 < nS ? nodes[a.path[s + 2]].idx - nodes[b.path[s + 2]].idx : 0) ||
          (s > 0 ? nodes[a.path[s - 1]].idx - nodes[b.path[s - 1]].idx : 0)
        ).forEach(f => {
          const a = nodes[f.path[s]], b = nodes[f.path[s + 1]];
          const th = f.value * scale;
          offOut[a.name] = offOut[a.name] || 0;
          const y0 = a.y + offOut[a.name]; offOut[a.name] += th;
          segs.push({ f, s, a, b, th, y0 });
        });
        // 입구 오프셋: 같은 정렬 순서로 타깃에 쌓기
        segs.filter(g => g.s === s)
          .sort((g1, g2) =>
            g1.b.idx - g2.b.idx ||
            g1.a.idx - g2.a.idx ||
            (s > 0 ? nodes[g1.f.path[s - 1]].idx - nodes[g2.f.path[s - 1]].idx : 0))
          .forEach(g => {
            offIn[g.b.name] = offIn[g.b.name] || 0;
            g.y1 = g.b.y + offIn[g.b.name]; offIn[g.b.name] += g.th;
          });
      }

      /* 리본 렌더 */
      const ribbonsByFlow = new Map();
      segs.forEach(g => {
        const x0 = g.a.x + BARW, x1 = g.b.x;
        const mx = (x0 + x1) / 2;
        const d = `M ${x0} ${g.y0} C ${mx} ${g.y0}, ${mx} ${g.y1}, ${x1} ${g.y1}` +
                  ` L ${x1} ${g.y1 + g.th} C ${mx} ${g.y1 + g.th}, ${mx} ${g.y0 + g.th}, ${x0} ${g.y0 + g.th} Z`;
        const p = el('path', { d, fill: flowColor(g.f), opacity: 0.30 }, svg);
        p.__flow = g.f;
        if (!ribbonsByFlow.has(g.f)) ribbonsByFlow.set(g.f, []);
        ribbonsByFlow.get(g.f).push(p);
        p.addEventListener('pointermove', e => {
          focusFlows(fl => fl === g.f);
          showTT(e.clientX, e.clientY, g.f.path.join(' → '), [{
            name: '가구', color: flowColor(g.f),
            value: fmt(g.f.value) + ' (' + Math.round(g.f.value / nodes[g.f.path[0]].value * 100) + '%)'
          }]);
        });
        p.addEventListener('pointerleave', () => { focusFlows(null); hideTT(); });
      });

      function focusFlows(pred) {
        ribbonsByFlow.forEach((paths, fl) => {
          const on = pred === null ? null : pred(fl);
          paths.forEach(p => p.style.opacity = on === null ? 0.30 : on ? 0.62 : 0.05);
        });
      }

      /* 노드 바 + 라벨 */
      const colSums = opts.order.map(names => names.reduce((a, nm) => a + nodes[nm].value, 0));
      Object.values(nodes).forEach(nd => {
        const isFirst = nd.stage === 0, isLast = nd.stage === nS - 1;
        const barColor = isFirst ? opts.colors[nd.name] : 'var(--ink-3)';
        const r = el('rect', { x: nd.x, y: nd.y, width: BARW, height: nd.h, rx: 3, fill: barColor }, svg);
        r.style.cursor = 'default';
        const share = Math.round(nd.value / colSums[nd.stage] * 100);
        const g = el('g', {}, svg);
        if (isFirst || isLast) {
          const tx = isFirst ? nd.x - 10 : nd.x + BARW + 10;
          const anchor = isFirst ? 'end' : 'start';
          el('text', { x: tx, y: nd.y + nd.h / 2 - 3, 'text-anchor': anchor, fill: 'var(--ink)', 'font-size': 12.5, 'font-weight': 700 }, g).textContent = nd.name;
          el('text', { x: tx, y: nd.y + nd.h / 2 + 13, 'text-anchor': anchor, fill: 'var(--ink-3)', 'font-size': 11, style: 'font-variant-numeric:tabular-nums' }, g)
            .textContent = fmt(nd.value) + ' · ' + share + '%';
        } else {
          // 중간 노드: 바 위 칩형 라벨
          const label = nd.name + ' · ' + fmtCompact(nd.value);
          const tw = label.length * 6.6 + 16;
          const cx = nd.x + BARW / 2;
          el('rect', { x: cx - tw / 2, y: nd.y - 24, width: tw, height: 19, rx: 9.5, fill: 'var(--surface)', stroke: 'var(--hairline)' }, g);
          el('text', { x: cx, y: nd.y - 10.5, 'text-anchor': 'middle', fill: 'var(--ink-2)', 'font-size': 11, 'font-weight': 700 }, g).textContent = label;
        }
        const over = e => {
          focusFlows(fl => fl.path.includes(nd.name));
          showTT(e.clientX, e.clientY, nd.name, [{
            name: opts.stages[nd.stage], color: barColor, value: fmt(nd.value) + ' (' + share + '%)'
          }]);
        };
        [r, g].forEach(t => {
          t.addEventListener('pointermove', over);
          t.addEventListener('pointerleave', () => { focusFlows(null); hideTT(); });
        });
      });

      /* 단계 헤더 */
      opts.stages.forEach((st, s) => {
        el('text', {
          x: colX(s) + BARW / 2, y: padT - 16, 'text-anchor': s === 0 ? 'start' : s === nS - 1 ? 'end' : 'middle',
          fill: 'var(--ink-3)', 'font-size': 11, 'font-weight': 700, 'letter-spacing': '.02em'
        }, svg).textContent = st;
      });

      /* 드로우인 */
      if (!REDUCED) {
        const all = [...svg.querySelectorAll('path')];
        all.forEach(p => { p.__baseOp = p.getAttribute('opacity') || 1; p.style.opacity = 0; });
        animateOnEnter(container, () => {
          all.forEach((p, i) => {
            p.style.transition = `opacity .7s ${Math.min(i * 22, 700)}ms ease`;
            p.style.opacity = p.__baseOp;
          });
        });
      }
    };
    render();
    watchResize(container, render);
  }

  /* ── 레전드 헬퍼 ─────────────────────────────── */
  function legend(container, items) {
    container.classList.add('chart-legend');
    container.textContent = '';
    items.forEach(it => {
      const k = document.createElement('span'); k.className = 'key';
      const s = document.createElement('span');
      s.className = it.line ? 'line-key' : 'swatch';
      s.style.background = it.color;
      k.appendChild(s);
      k.appendChild(document.createTextNode(it.name));
      container.appendChild(k);
    });
  }

  window.KTC = { lineChart, columnChart, mirrorChart, sankey, spark, legend, fmtComma, fmtCompact };
})();
