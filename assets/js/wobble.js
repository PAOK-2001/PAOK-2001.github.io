/*
 * Hand-drawn stitching.
 *
 * Replaces the CSS dashed borders listed in TARGETS with SVG paths that wobble
 * smoothly, so the dashes stay crisp and evenly spaced. Each element gets its own
 * seed, so no two cards wobble the same way. The CSS keeps the borders (in a
 * transparent colour once <html> has the "wobble-js" class), so layout never shifts
 * and the plain dashed borders remain as the no-JS fallback.
 */
(function () {
  'use strict';

  if (!window.ResizeObserver || !document.querySelectorAll) { return; }

  var STITCH = '#593e28';   // Deep Walnut
  var DASH_LEN = 12, GAP = 15;          // px
  var PERIOD = DASH_LEN + GAP;
  var DASH = DASH_LEN + ' ' + GAP;
  var STEP = 18;          // px between sampled points along a path
  var AMP_BOX = 2.2;      // max sideways drift for outlines, px
  var AMP_LINE = 2.0;     // max sideways drift for straight rules, px

  // kind: "box" (rounded outline) or "rule" (one edge); rows: separators inside a box
  var TARGETS = [
    { sel: '.masthead', kind: 'rule', edge: 'bottom', width: 3 },
    { sel: '.page__footer', kind: 'rule', edge: 'top', width: 3 },
    { sel: '.pub-card', kind: 'box', radius: 16, width: 3 },
    { sel: '.news-card', kind: 'box', radius: 14, width: 3 },
    { sel: '.archive > .list__item:not(:last-of-type)', kind: 'rule', edge: 'bottom', width: 2.25, opacity: 0.8 },
    { sel: '.page__share', kind: 'rule', edge: 'top', width: 2.25 },
    { sel: '.page__share + .pagination', kind: 'rule', edge: 'top', width: 2.25 }
  ];

  // Small deterministic PRNG (mulberry32)
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 16777619); }
    return h >>> 0;
  }

  // Smooth 1-D noise: three sine waves of decreasing size. For closed outlines each
  // wave makes a whole number of cycles around the perimeter, so the ends meet.
  function makeNoise(rand, amp, period) {
    var waves = [[0.6, 420], [0.3, 190], [0.1, 95]].map(function (w) {
      var len = w[1] * (0.75 + 0.5 * rand());
      var k = period
        ? Math.max(1, Math.round(period / len)) * 2 * Math.PI / period
        : 2 * Math.PI / len;
      return { a: w[0], k: k, p: rand() * 2 * Math.PI };
    });
    return function (s) {
      var v = 0;
      for (var i = 0; i < waves.length; i++) { v += waves[i].a * Math.sin(waves[i].k * s + waves[i].p); }
      return amp * v;
    };
  }

  // Points around a rounded rectangle, each with its outward normal and arc length
  function roundedRect(w, h, r, inset) {
    var x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset;
    r = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
    var H = Math.PI / 2;
    var segs = [
      { line: [x0 + r, y0, x1 - r, y0], n: [0, -1] },
      { arc: [x1 - r, y0 + r, -H] },
      { line: [x1, y0 + r, x1, y1 - r], n: [1, 0] },
      { arc: [x1 - r, y1 - r, 0] },
      { line: [x1 - r, y1, x0 + r, y1], n: [0, 1] },
      { arc: [x0 + r, y1 - r, H] },
      { line: [x0, y1 - r, x0, y0 + r], n: [-1, 0] },
      { arc: [x0 + r, y0 + r, 2 * H] }
    ];
    var pts = [], s = 0;
    segs.forEach(function (g) {
      var len = g.line ? Math.hypot(g.line[2] - g.line[0], g.line[3] - g.line[1]) : r * H;
      // corners need several points or the spline cuts them off diagonally
      var n = g.arc ? Math.max(4, Math.ceil(len / 6)) : Math.max(1, Math.round(len / STEP));
      for (var i = 0; i < n; i++) {
        var f = i / n;
        if (g.line) {
          pts.push({ x: g.line[0] + (g.line[2] - g.line[0]) * f, y: g.line[1] + (g.line[3] - g.line[1]) * f,
                     nx: g.n[0], ny: g.n[1], s: s + f * len });
        } else {
          var a = g.arc[2] + f * H;
          pts.push({ x: g.arc[0] + r * Math.cos(a), y: g.arc[1] + r * Math.sin(a),
                     nx: Math.cos(a), ny: Math.sin(a), s: s + f * len });
        }
      }
      s += len;
    });
    return { pts: pts, len: s };
  }

  function straight(x0, x1, y) {
    var len = x1 - x0, n = Math.max(2, Math.round(len / STEP)), pts = [];
    for (var i = 0; i <= n; i++) { pts.push({ x: x0 + len * i / n, y: y, nx: 0, ny: 1, s: len * i / n }); }
    return pts;
  }

  function r1(v) { return Math.round(v * 10) / 10; }

  // Catmull-Rom spline through the points, written as cubic Beziers
  function smoothPath(p, closed) {
    var n = p.length, d = 'M' + r1(p[0].x) + ' ' + r1(p[0].y);
    var count = closed ? n : n - 1;
    for (var i = 0; i < count; i++) {
      var p0 = p[closed ? (i - 1 + n) % n : Math.max(i - 1, 0)];
      var p1 = p[i];
      var p2 = p[(i + 1) % n];
      var p3 = p[closed ? (i + 2) % n : Math.min(i + 2, n - 1)];
      d += ' C' + r1(p1.x + (p2.x - p0.x) / 6) + ' ' + r1(p1.y + (p2.y - p0.y) / 6) +
           ' ' + r1(p2.x - (p3.x - p1.x) / 6) + ' ' + r1(p2.y - (p3.y - p1.y) / 6) +
           ' ' + r1(p2.x) + ' ' + r1(p2.y);
    }
    return d + (closed ? ' Z' : '');
  }

  function wobble(pts, noise) {
    return pts.map(function (p) {
      var o = noise(p.s);
      return { x: p.x + p.nx * o, y: p.y + p.ny * o };
    });
  }

  // pathLength makes the dash pattern fit the path exactly: a whole number of
  // dash+gap periods on closed outlines (no long dash at the seam), and a full
  // dash at both ends of open rules (no stray dots).
  function closedLen(len) { return Math.max(1, Math.round(len / PERIOD)) * PERIOD; }
  function openLen(len) {
    var n = Math.max(1, Math.round((len + GAP) / PERIOD));
    return n * DASH_LEN + (n - 1) * GAP;
  }

  function stroke(d, width, opacity, plen) {
    return '<path d="' + d + '" pathLength="' + plen + '" fill="none" stroke="' + STITCH + '" stroke-opacity="' + (opacity || 1) +
           '" stroke-width="' + width + '" stroke-dasharray="' + DASH + '" stroke-linecap="round" stroke-linejoin="round"/>';
  }

  function draw(item) {
    var el = item.el, t = item.target;
    var w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) { return; }
    var rand = rng(item.seed);
    var out = '';

    if (t.kind === 'box') {
      var shape = roundedRect(w, h, t.radius, t.width / 2);
      out += stroke(smoothPath(wobble(shape.pts, makeNoise(rand, AMP_BOX, shape.len)), true), t.width, 1,
                    closedLen(shape.len));

      if (t.rows) {
        var top = el.getBoundingClientRect().top;
        var rows = el.querySelectorAll(t.rows);
        for (var i = 0; i < rows.length; i++) {
          var y = rows[i].getBoundingClientRect().top - top;
          var rowNoise = makeNoise(rng(item.seed + 101 * (i + 1)), AMP_LINE * 0.8);
          var rowLen = w - 2 * (t.width + 4);
          out += stroke(smoothPath(wobble(straight(t.width + 4, w - t.width - 4, y), rowNoise), false),
                        t.rowWidth, t.rowOpacity, openLen(rowLen));
        }
      }
    } else {
      var yLine = t.edge === 'top' ? t.width / 2 : h - t.width / 2;
      out += stroke(smoothPath(wobble(straight(1, w - 1, yLine), makeNoise(rand, AMP_LINE)), false),
                    t.width, t.opacity, openLen(w - 2));
    }

    item.svg.setAttribute('width', w);
    item.svg.setAttribute('height', h);
    item.svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    item.svg.style.left = -el.clientLeft + 'px';
    item.svg.style.top = -el.clientTop + 'px';
    item.svg.innerHTML = out;
  }

  var items = [];
  var pending = new Set();
  var frame = 0;

  function flush() {
    frame = 0;
    pending.forEach(draw);
    pending.clear();
  }

  function schedule(item) {
    pending.add(item);
    if (!frame) { frame = requestAnimationFrame(flush); }
  }

  var observer = new ResizeObserver(function (entries) {
    entries.forEach(function (e) { if (e.target.__wobble) { schedule(e.target.__wobble); } });
  });

  function init() {
    TARGETS.forEach(function (t) {
      var base = hash(t.sel);
      var els = document.querySelectorAll(t.sel);
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.__wobble) { continue; }
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'wobble-svg');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        el.appendChild(svg);
        var item = { el: el, target: t, svg: svg, seed: (base + 7919 * (i + 1)) >>> 0 };
        el.__wobble = item;
        items.push(item);
        observer.observe(el);
        schedule(item);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
