/* ==========================================================================
   YAÑEZ TOUR'S  |  script.js
   JavaScript vanilla, sin dependencias.

   Notas de arquitectura:
   - Nada escucha window "scroll". Un solo bucle rAF lee scrollY, lo suaviza
     (lerp) y reparte el valor a los módulos. Eso da el efecto "slow motion".
   - Todo lo animado usa transform / opacity.
   - Respeta prefers-reduced-motion (sin partículas, parallax ni bucles).
   - Cada módulo corre aislado (safe) para que un fallo no rompa la página.
   ========================================================================== */
(() => {
  'use strict';

  /* ---------- Utilidades ---------- */
  const WA_NUMBER = '526621038511';
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const waUrl = (text) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
  const safe = (name, fn) => { try { fn(); } catch (err) { console.error(`[${name}]`, err); } };

  /* ==========================================================================
     MOTOR DE SCROLL (rAF + lerp). Los módulos se suscriben con { measure, update }
  ========================================================================== */
  const engine = (() => {
    const mods = [];
    let y = window.scrollY, last = -1, dirty = true, vh = innerHeight, docH = 0;

    const measure = () => {
      vh = innerHeight;
      docH = root.scrollHeight;
      mods.forEach((m) => m.measure && m.measure(vh));
      dirty = true;
    };

    const tick = () => {
      const target = window.scrollY;
      y = reduce || Math.abs(target - y) < 0.1 ? target : lerp(y, target, 0.1);
      if (y !== last || dirty) {
        mods.forEach((m) => m.update && m.update(y, vh, docH));
        last = y;
        dirty = false;
      }
      requestAnimationFrame(tick);
    };

    return {
      add(m) { mods.push(m); },
      measure,
      start() { measure(); requestAnimationFrame(tick); },
      get vh() { return vh; },
    };
  })();

  const pageTop = (el) => el.getBoundingClientRect().top + window.scrollY;

  /* ==========================================================================
     1. ENLACES DE WHATSAPP (mensaje distinto según el CTA)
  ========================================================================== */
  safe('whatsapp', () => {
    $$('[data-wa]').forEach((a) => { a.href = waUrl(a.dataset.wa); });
  });

  /* ==========================================================================
     2. LOADER (progreso real: imagen del hero + fuentes + load)
  ========================================================================== */
  safe('loader', () => {
    const loader = $('#loader');
    const arc = $('#ldArc');
    const pct = $('#ldPct');
    if (!loader) { root.classList.remove('is-loading'); root.classList.add('is-ready'); return; }

    const CIRC = 553;
    const MIN_MS = reduce ? 250 : 2300;
    const t0 = performance.now();
    let target = 12, shown = 0, finished = false;
    const bump = (v) => { target = Math.max(target, v); };

    const heroImg = $('.hs img');
    if (heroImg && !heroImg.complete) {
      heroImg.addEventListener('load', () => bump(70), { once: true });
      heroImg.addEventListener('error', () => bump(70), { once: true });
    } else { bump(70); }
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => bump(88));
    if (document.readyState === 'complete') bump(100);
    else window.addEventListener('load', () => bump(100), { once: true });
    setTimeout(() => bump(100), 6000);

    const finish = () => {
      if (finished) return;
      finished = true;
      setTimeout(() => {
        loader.classList.add('is-done');
        root.classList.remove('is-loading');
        root.classList.add('is-ready');
        document.dispatchEvent(new Event('app:ready'));
        if (location.hash) {
          const el = $(location.hash);
          if (el) el.scrollIntoView();
        }
        setTimeout(() => loader.classList.add('is-gone'), 1600);
      }, 260);
    };
    setTimeout(finish, 10000); // red de seguridad absoluta

    const frame = (now) => {
      const timeCap = clamp((now - t0) / MIN_MS, 0, 1) * 100;
      const goal = Math.min(target, timeCap);
      shown = goal - shown < 0.08 ? goal : lerp(shown, goal, 0.12);
      pct.textContent = Math.round(shown);
      arc.style.strokeDashoffset = (CIRC * (1 - shown / 100)).toFixed(1);
      loader.style.setProperty('--lp', (shown / 100).toFixed(3));
      if (shown >= 99.9) { finish(); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  /* ==========================================================================
     3. NAV: estado pegajoso, menú móvil y enlace activo
  ========================================================================== */
  safe('nav', () => {
    const nav = $('#nav');
    const sentinel = $('#topSentinel');
    if (nav && sentinel) {
      new IntersectionObserver(([e]) => nav.classList.toggle('is-stuck', !e.isIntersecting)).observe(sentinel);
    }

    const toggle = $('#navToggle');
    const menu = $('#menu');
    if (toggle && menu) {
      $$('.menu-in > *', menu).forEach((el, i) => el.style.setProperty('--i', i));
      const setMenu = (open) => {
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
        toggle.firstElementChild.className = open ? 'ph-bold ph-x' : 'ph-bold ph-list';
        menu.classList.toggle('is-open', open);
        menu.setAttribute('aria-hidden', String(!open));
        root.style.overflow = open ? 'hidden' : '';
      };
      toggle.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
      menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) { setMenu(false); toggle.focus(); } });
      matchMedia('(min-width: 960px)').addEventListener('change', (m) => { if (m.matches) setMenu(false); });
    }

    const links = $$('.nav-links a');
    const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const link = map.get(e.target.id);
        if (link) link.setAttribute('aria-current', e.isIntersecting ? 'true' : 'false');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });
  });

  /* ==========================================================================
     4. TEXTO: separar palabras (máscara) + reveal con IntersectionObserver
  ========================================================================== */
  const splitWords = (el) => {
    let i = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const inner = document.createElement('span');
            inner.textContent = part;
            inner.style.setProperty('--i', i++);
            w.appendChild(inner);
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) { walk(child); }
      });
    };
    walk(el);
  };

  safe('reveal', () => {
    $$('[data-split]').forEach(splitWords);
    const targets = $$('[data-reveal],[data-split]');
    if (reduce || !('IntersectionObserver' in window)) { targets.forEach((el) => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    targets.forEach((el) => io.observe(el));
  });

  /* ==========================================================================
     5. CONTADORES
  ========================================================================== */
  safe('counters', () => {
    const nums = $$('[data-count]');
    if (reduce) return; // el HTML ya trae el valor final
    const run = (el) => {
      const to = Number(el.dataset.count);
      const t0 = performance.now();
      const step = (now) => {
        const p = clamp((now - t0) / 1700, 0, 1);
        el.textContent = Math.round(to * (1 - Math.pow(1 - p, 4)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    nums.forEach((el) => { el.textContent = '0'; });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.6 });
    nums.forEach((el) => io.observe(el));
  });

  /* ==========================================================================
     6. HERO: slideshow con Ken Burns + partículas
  ========================================================================== */
  safe('hero-slides', () => {
    const slides = $$('.hs');
    if (slides.length < 2 || reduce) return;
    let cur = 0;
    setInterval(() => {
      const prev = slides[cur];
      prev.classList.remove('is-on');
      prev.classList.add('is-prev');
      setTimeout(() => prev.classList.remove('is-prev'), 2000);
      cur = (cur + 1) % slides.length;
      slides[cur].classList.add('is-on');
    }, 7000);
  });

  safe('particles', () => {
    const canvas = $('#particles');
    const hero = $('#inicio');
    if (!canvas || !hero || reduce) return;
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, parts = [], visible = true, rafId = 0;
    const mouse = { x: -9999, y: -9999, on: false };
    const COLORS = ['247,182,60', '245,238,223', '43,179,201'];

    const make = (initial) => {
      const k = Math.random();
      return {
        x: Math.random() * w,
        y: initial ? Math.random() * h : h + 12,
        r: 0.7 + Math.random() * 2.1,
        vy: -(0.12 + Math.random() * 0.42),
        vx: (Math.random() - 0.5) * 0.18,
        ph: Math.random() * Math.PI * 2,
        sw: 0.4 + Math.random() * 0.9,
        c: k < 0.58 ? 0 : k < 0.86 ? 1 : 2,
        a: 0.25 + Math.random() * 0.6,
      };
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.offsetWidth; h = canvas.offsetHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = clamp(Math.round((w * h) / (w < 700 ? 16000 : 12500)), 28, 100);
      parts = Array.from({ length: n }, () => make(true));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const LINK = w < 700 ? 80 : 110;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.ph += 0.01 * p.sw;
        p.x += p.vx + Math.sin(p.ph) * 0.25;
        p.y += p.vy;
        if (mouse.on) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < 16900) {
            const d = Math.sqrt(d2) || 1, f = (130 - d) / 130;
            p.x += (dx / d) * f * 2.4; p.y += (dy / d) * f * 2.4;
          }
        }
        if (p.y < -12 || p.x < -24 || p.x > w + 24) { parts[i] = make(false); continue; }
        ctx.beginPath();
        ctx.fillStyle = `rgba(${COLORS[p.c]},${p.a})`;
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fill();
        for (let j = i + 1; j < parts.length; j++) {
          const q = parts[j], dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            ctx.strokeStyle = `rgba(247,182,60,${(1 - Math.sqrt(d2) / LINK) * 0.2})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
      }
    };

    const loop = () => { if (visible && !document.hidden) draw(); rafId = requestAnimationFrame(loop); };
    resize();
    rafId = requestAnimationFrame(loop);

    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 200); });
    if (finePointer) {
      hero.addEventListener('pointermove', (e) => {
        const r = canvas.getBoundingClientRect();
        mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true;
      });
      hero.addEventListener('pointerleave', () => { mouse.on = false; });
    }
  });

  /* ==========================================================================
     7. MÓDULOS DE SCROLL (suscritos al motor)
  ========================================================================== */

  /* 7.1 Barra de progreso + parallax del hero */
  safe('scroll-hero', () => {
    const bar = $('#progressBar');
    const media = $('#heroMedia');
    const copy = $('#heroCopy');
    const hero = $('#inicio');
    let heroH = 0;
    engine.add({
      measure() { heroH = hero ? hero.offsetHeight : 0; },
      update(y, vh, docH) {
        if (bar) bar.style.transform = `scaleX(${clamp(y / Math.max(1, docH - vh), 0, 1).toFixed(4)})`;
        if (reduce || !hero || y > heroH * 1.15) return;
        if (media) media.style.transform = `translate3d(0,${(y * 0.28).toFixed(1)}px,0)`;
        if (copy) {
          copy.style.transform = `translate3d(0,${(y * 0.14).toFixed(1)}px,0)`;
          copy.style.opacity = clamp(1 - y / (heroH * 0.62), 0, 1).toFixed(3);
        }
      },
    });
  });

  /* 7.2 Parallax de imágenes dentro de su marco */
  safe('parallax', () => {
    if (reduce) return;
    const items = $$('[data-parallax]').map((img) => ({ img, box: img.parentElement, f: Number(img.dataset.parallax) || 0.06, top: 0, h: 0 }));
    engine.add({
      measure() { items.forEach((it) => { it.top = pageTop(it.box); it.h = it.box.offsetHeight; }); },
      update(y, vh) {
        items.forEach((it) => {
          const c = it.top + it.h / 2 - (y + vh / 2);
          if (Math.abs(c) > vh) return;
          const lim = it.h * 0.07;
          it.img.style.transform = `translate3d(0,${clamp(-c * it.f, -lim, lim).toFixed(1)}px,0)`;
        });
      },
    });
  });

  /* 7.3 Manifiesto: palabras que se encienden con el scroll */
  safe('manifesto', () => {
    const el = $('#manifesto');
    if (!el) return;
    const words = [];
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const s = document.createElement('span');
            s.className = 'mw'; s.textContent = part;
            words.push(s); frag.appendChild(s);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) { walk(child); }
      });
    };
    walk(el);
    if (reduce) { words.forEach((s) => s.style.setProperty('--o', 1)); return; }
    let top = 0, h = 0;
    const lastO = new Array(words.length).fill(-1);
    engine.add({
      measure(vh) { top = pageTop(el); h = el.offsetHeight; },
      update(y, vh) {
        const start = top - vh * 0.88, end = top + h - vh * 0.5;
        const p = clamp((y - start) / (end - start), 0, 1);
        const n = words.length;
        for (let i = 0; i < n; i++) {
          const o = Math.round(clamp((p * (n + 5) - i) / 5, 0, 1) * 100) / 100;
          if (o !== lastO[i]) { lastO[i] = o; words[i].style.setProperty('--o', o); }
        }
      },
    });
  });

  /* 7.4 Sección de cultura: zoom lento + parallax del fondo */
  safe('culture', () => {
    if (reduce) return;
    const sec = $('#cultura');
    const bg = $('.culture-bg', sec || document);
    const img = $('#cultureImg');
    if (!sec || !bg || !img) return;
    let top = 0, h = 0;
    engine.add({
      measure() { top = pageTop(sec); h = sec.offsetHeight; },
      update(y, vh) {
        const c = top + h / 2 - (y + vh / 2);
        if (Math.abs(c) > h / 2 + vh) return;
        const p = clamp((y + vh - top) / (h + vh), 0, 1);
        bg.style.transform = `translate3d(0,${(-c * 0.1).toFixed(1)}px,0)`;
        img.style.transform = `scale(${(1.2 - 0.14 * p).toFixed(3)})`;
      },
    });
  });

  /* 7.5 Itinerario: ruta que se dibuja, barco que navega, pasos que se encienden */
  safe('route', () => {
    const steps = $$('.step');
    const ol = $('#routeSteps');
    if (!ol || !steps.length) return;

    const NS = 'http://www.w3.org/2000/svg';
    const bg = $('#routeBg');
    const line = $('#routeLine');
    const nodesG = $('#mapNodes');
    const boat = $('#mapBoat');
    const desktop = matchMedia('(min-width: 960px)');
    let total = 0, nodes = [], mapReady = false, pts = [];

    const buildMap = () => {
      if (mapReady || !bg || !desktop.matches) return;
      try { total = bg.getTotalLength(); } catch (e) { return; }
      const sides = ['r', 'r', 'l', 'l'];
      steps.forEach((s, i) => {
        const f = i / (steps.length - 1);
        const pt = bg.getPointAtLength(total * f);
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'map-node');
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y); c.setAttribute('r', 8);
        const t = document.createElementNS(NS, 'text');
        const left = sides[i] === 'l';
        t.setAttribute('x', pt.x + (left ? -16 : 16)); t.setAttribute('y', pt.y + 4.5);
        t.setAttribute('text-anchor', left ? 'end' : 'start');
        t.textContent = s.dataset.step;
        g.append(c, t); nodesG.appendChild(g); nodes.push(g);
      });
      mapReady = true;
      dirtyUpdate();
    };
    desktop.addEventListener('change', buildMap);

    let tops = [], hs = [], olTop = 0, olH = 0, lastActive = -2, lastU = -1;
    const dirtyUpdate = () => { lastU = -1; lastActive = -2; };

    const setActive = (idx) => {
      if (idx === lastActive) return;
      lastActive = idx;
      steps.forEach((s, i) => s.classList.toggle('is-active', i <= idx));
      nodes.forEach((n, i) => n.classList.toggle('is-on', i <= idx));
    };

    if (reduce) {
      steps.forEach((s) => s.classList.add('is-active'));
      ol.style.setProperty('--p', 1);
      const prep = () => { buildMap(); if (line) line.style.strokeDashoffset = 0; nodes.forEach((n) => n.classList.add('is-on')); if (boat && mapReady) { const e = bg.getPointAtLength(total); boat.setAttribute('transform', `translate(${e.x} ${e.y})`); } };
      desktop.addEventListener('change', prep); prep();
      return;
    }

    engine.add({
      measure() {
        buildMap();
        tops = steps.map((s) => pageTop(s));
        hs = steps.map((s) => s.offsetHeight);
        olTop = pageTop(ol); olH = ol.offsetHeight;
      },
      update(y, vh) {
        const probe = y + vh * 0.55;
        const first = tops[0] + 20, lastC = tops[steps.length - 1] + 20;
        const u = clamp((probe - first) / Math.max(1, lastC - first), 0, 1);
        ol.style.setProperty('--p', clamp((probe - (olTop + 20)) / Math.max(1, olH - 40), 0, 1).toFixed(4));

        let idx = -1;
        for (let i = 0; i < steps.length; i++) { if (probe >= tops[i] + 20) idx = i; }
        setActive(Math.max(idx, probe >= olTop - vh * 0.1 ? 0 : -1));

        if (mapReady && Math.abs(u - lastU) > 0.0005) {
          lastU = u;
          line.style.strokeDashoffset = (1 - u).toFixed(4);
          const pt = bg.getPointAtLength(total * u);
          boat.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
        }
      },
    });
  });

  /* ==========================================================================
     8. INTERACCIÓN: spotlight + tilt, botones magnéticos
  ========================================================================== */
  safe('tilt', () => {
    if (!finePointer || reduce) return;
    $$('[data-tilt]').forEach((el) => {
      let raf = 0;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--sx', `${(px * 100).toFixed(1)}%`);
        el.style.setProperty('--sy', `${(py * 100).toFixed(1)}%`);
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          el.style.transform = `perspective(1000px) rotateX(${((0.5 - py) * 3.2).toFixed(2)}deg) rotateY(${((px - 0.5) * 4).toFixed(2)}deg)`;
        });
      });
      el.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); raf = 0; el.style.transform = ''; });
    });
  });

  safe('magnetic', () => {
    if (!finePointer || reduce) return;
    $$('[data-magnetic]').forEach((btn) => {
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        btn.style.setProperty('--mx', `${(dx * 0.16).toFixed(1)}px`);
        btn.style.setProperty('--my', `${(dy * 0.22).toFixed(1)}px`);
      });
      btn.addEventListener('pointerleave', () => { btn.style.setProperty('--mx', '0px'); btn.style.setProperty('--my', '0px'); });
    });
  });

  /* ==========================================================================
     9. GALERÍA (arrastre, botones, progreso) + LIGHTBOX
  ========================================================================== */
  safe('gallery', () => {
    const track = $('#gTrack');
    if (!track) return;
    const bar = $('#gBar');
    const prev = $('#gPrev'), next = $('#gNext');

    const progress = () => {
      const p = (track.scrollLeft + track.clientWidth) / Math.max(1, track.scrollWidth);
      if (bar) bar.parentElement.style.setProperty('--gp', clamp(p, 0.08, 1).toFixed(3));
    };
    track.addEventListener('scroll', progress, { passive: true });
    window.addEventListener('resize', progress);
    progress();

    const step = () => track.clientWidth * 0.7;
    if (prev) prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: reduce ? 'auto' : 'smooth' }));
    if (next) next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: reduce ? 'auto' : 'smooth' }));

    // Arrastre con mouse (en táctil se usa el desplazamiento nativo)
    let down = false, sx = 0, sl = 0, moved = 0;
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; sx = e.clientX; sl = track.scrollLeft; moved = 0;
    });
    window.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      moved = Math.max(moved, Math.abs(dx));
      if (moved > 5) track.classList.add('is-drag');
      track.scrollLeft = sl - dx;
    });
    const end = () => { down = false; track.classList.remove('is-drag'); };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    track.addEventListener('click', (e) => { if (moved > 5) { e.preventDefault(); e.stopPropagation(); moved = 0; } }, true);
  });

  safe('lightbox', () => {
    const lb = $('#lightbox');
    const items = $$('.g-open');
    if (!lb || !items.length || typeof lb.showModal !== 'function') return;
    const img = $('#lbImg'), cap = $('#lbCap');
    let idx = 0, touchX = null;

    const show = (i) => {
      idx = (i + items.length) % items.length;
      const b = items[idx];
      img.src = b.dataset.full;
      img.alt = b.querySelector('img').alt;
      cap.textContent = b.dataset.cap || '';
    };
    const open = (i) => { show(i); lb.showModal(); root.style.overflow = 'hidden'; };
    const close = () => lb.close();

    items.forEach((b, i) => b.addEventListener('click', () => open(i)));
    $('#lbClose').addEventListener('click', close);
    $('#lbPrev').addEventListener('click', () => show(idx - 1));
    $('#lbNext').addEventListener('click', () => show(idx + 1));
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    lb.addEventListener('close', () => { root.style.overflow = ''; items[idx].focus({ preventScroll: true }); });
    lb.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
    lb.addEventListener('touchstart', (e) => { touchX = e.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
      touchX = null;
    }, { passive: true });
  });

  /* ==========================================================================
     10. VIDEOS (reproducen al entrar en pantalla, sin sonido por defecto)
  ========================================================================== */
  safe('videos', () => {
    const figs = $$('.vid');
    figs.forEach((fig) => {
      const v = $('video', fig);
      const tgl = $('[data-vid-toggle]', fig);
      const snd = $('[data-vid-sound]', fig);
      let userPaused = false;

      const sync = () => { tgl.firstElementChild.className = v.paused ? 'ph-fill ph-play' : 'ph-fill ph-pause'; };
      v.addEventListener('play', sync);
      v.addEventListener('pause', sync);
      sync();

      tgl.addEventListener('click', () => {
        if (v.paused) { userPaused = false; v.preload = 'auto'; v.play().catch(() => {}); }
        else { userPaused = true; v.pause(); }
      });
      snd.addEventListener('click', () => {
        v.muted = !v.muted;
        snd.firstElementChild.className = v.muted ? 'ph-bold ph-speaker-slash' : 'ph-bold ph-speaker-high';
        snd.setAttribute('aria-label', v.muted ? 'Activar sonido' : 'Silenciar');
        if (!v.muted) {
          figs.forEach((other) => {
            const ov = $('video', other);
            if (ov !== v) { ov.muted = true; $('[data-vid-sound]', other).firstElementChild.className = 'ph-bold ph-speaker-slash'; }
          });
          if (v.paused) { userPaused = false; v.play().catch(() => {}); }
        }
      });

      if (!reduce && 'IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => {
          if (e.isIntersecting && !userPaused) { v.preload = 'auto'; v.play().catch(() => {}); }
          else if (!e.isIntersecting) { v.pause(); }
        }, { threshold: 0.5 }).observe(v);
      }
    });
  });

  /* ==========================================================================
     11. FAQ (acordeón accesible, una abierta a la vez)
  ========================================================================== */
  safe('faq', () => {
    const items = $$('.acc-item');
    items.forEach((item) => {
      const btn = $('.acc-q', item);
      btn.addEventListener('click', () => {
        const willOpen = !item.classList.contains('is-open');
        items.forEach((o) => {
          if (o !== item && o.classList.contains('is-open')) {
            o.classList.remove('is-open');
            $('.acc-q', o).setAttribute('aria-expanded', 'false');
          }
        });
        item.classList.toggle('is-open', willOpen);
        btn.setAttribute('aria-expanded', String(willOpen));
      });
    });
  });

  /* ==========================================================================
     12. FORMULARIO: valida y abre WhatsApp con el mensaje armado
  ========================================================================== */
  safe('form', () => {
    const form = $('#reserveForm');
    if (!form) return;
    const status = $('#formStatus');
    const date = $('#f-date');
    if (date) {
      const t = new Date();
      date.min = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    }

    const setErr = (field, msg) => {
      const wrap = field.closest('.field');
      const out = $(`#${field.getAttribute('aria-describedby')}`);
      wrap.classList.toggle('has-error', Boolean(msg));
      field.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (out) out.textContent = msg || '';
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = form.nombre.value.trim();
      const people = form.personas.value;
      let firstBad = null;

      if (name.length < 2) { setErr(form.nombre, 'Escribe tu nombre para poder atenderte.'); firstBad = firstBad || form.nombre; }
      else setErr(form.nombre, '');
      if (!people) { setErr(form.personas, 'Elige cuántas personas son.'); firstBad = firstBad || form.personas; }
      else setErr(form.personas, '');

      if (firstBad) {
        status.className = 'form-status';
        status.textContent = 'Revisa los campos marcados.';
        firstBad.focus();
        return;
      }

      const extras = Array.from(form.querySelectorAll('input[name="extra"]:checked')).map((c) => c.value);
      const msg = form.mensaje.value.trim();
      let when = '';
      if (form.fecha.value) {
        const [yy, mm, dd] = form.fecha.value.split('-').map(Number);
        when = new Date(yy, mm - 1, dd).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      }
      const lines = ["Hola Yañez Tour's, quiero reservar el tour a la Isla del Tiburón.", '', `Nombre: ${name}`, `Personas: ${people}`];
      if (when) lines.push(`Fecha tentativa: ${when}`);
      if (extras.length) lines.push(`Quiero consultar: ${extras.join(', ')}`);
      if (msg) lines.push(`Comentarios: ${msg}`);
      lines.push('', 'Gracias, quedo atento.');
      const url = waUrl(lines.join('\n'));

      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();

      status.className = 'form-status is-ok';
      status.textContent = 'Listo. Abrimos WhatsApp con tu mensaje, solo falta enviarlo.';
    });

    form.addEventListener('input', (e) => {
      if (e.target.matches('[aria-describedby]') && e.target.closest('.has-error')) setErr(e.target, '');
    });
  });

  /* ==========================================================================
     13. EXTRAS: tooltip del botón flotante, año, asientos
  ========================================================================== */
  safe('extras', () => {
    const y = $('#year');
    if (y) y.textContent = new Date().getFullYear();

    $$('.seats li').forEach((li, i) => li.style.setProperty('--k', i));

    const wa = $('#waFloat');
    if (wa && !reduce) {
      document.addEventListener('app:ready', () => {
        setTimeout(() => {
          wa.classList.add('show-tip');
          setTimeout(() => wa.classList.remove('show-tip'), 5200);
        }, 6500);
      }, { once: true });
    }
  });

  /* ==========================================================================
     ARRANQUE DEL MOTOR
  ========================================================================== */
  const boot = () => {
    engine.start();
    let t;
    const remeasure = () => { clearTimeout(t); t = setTimeout(engine.measure, 150); };
    window.addEventListener('resize', remeasure);
    window.addEventListener('load', remeasure);
    if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(document.body);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
