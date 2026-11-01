/* ==========================================================================
   Motion & interactive features for the portfolio.
   Loaded after app.js. Each feature is isolated, so one failing never breaks the others.
   Edit the FX block below to tweak text or switch features on/off.
   ========================================================================== */
(function () {
  "use strict";

  const FX = {
    // Typed line under the intro paragraph (separate phrases with a comma in the array)
    typedLead: "I'm all about ",
    typedPhrases: [
      "building clean, fast web apps.",
      "organizing workflows that scale.",
      "designing brands that stand out.",
    ],
    particles: true,   // animated network behind the hero
    marquee: true,     // scrolling strip of your tools
    tilt: true,        // 3D tilt on profile photo + project cards
    spotlight: true,   // cursor glow on cards
    magnetic: true,    // buttons lean toward the cursor
    palette: true,     // Ctrl/Cmd + K quick-jump
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const safe = (name, fn) => { try { fn(); } catch (e) { console.warn("[fx] " + name + " skipped:", e); } };

  document.documentElement.classList.add("js-fx");

  /* ---------- 1. Scroll progress bar ---------- */
  function initProgress() {
    const bar = document.createElement("div");
    bar.className = "scroll-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);
    let ticking = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ---------- 2. Tagline words + typed line ---------- */
  function initHeroText() {
    const tagline = $(".brand-tagline");
    if (tagline && !reduce) {
      const words = tagline.textContent.trim().split(/\s+/);
      tagline.setAttribute("aria-label", words.join(" "));
      tagline.textContent = "";
      words.forEach((w, i) => {
        const span = document.createElement("span");
        span.className = "tw";
        span.style.setProperty("--i", i);
        span.setAttribute("aria-hidden", "true");
        span.textContent = w;
        tagline.appendChild(span);
      });
    }

    const subtitle = $(".hero-subtitle");
    if (!subtitle || !FX.typedPhrases.length) return;
    const line = document.createElement("p");
    line.className = "hero-typed";
    const lead = document.createElement("span");
    lead.className = "typed-lead";
    lead.textContent = FX.typedLead;
    const text = document.createElement("span");
    text.textContent = FX.typedPhrases[0];
    const caret = document.createElement("span");
    caret.className = "typed-caret";
    caret.setAttribute("aria-hidden", "true");
    line.append(lead, text, caret);
    subtitle.insertAdjacentElement("afterend", line);
    if (reduce) { caret.style.display = "none"; return; }

    let pi = 0, ci = 0, deleting = false;
    text.textContent = "";
    (function tick() {
      const full = FX.typedPhrases[pi];
      if (!deleting) {
        ci++;
        text.textContent = full.slice(0, ci);
        if (ci === full.length) { deleting = true; return setTimeout(tick, 1900); }
        return setTimeout(tick, 50 + Math.random() * 40);
      }
      ci--;
      text.textContent = full.slice(0, ci);
      if (ci === 0) { deleting = false; pi = (pi + 1) % FX.typedPhrases.length; return setTimeout(tick, 380); }
      setTimeout(tick, 24);
    })();
  }

  /* ---------- 3. Hero particle network ---------- */
  function initParticles() {
    const hero = $(".hero");
    if (!hero) return;
    const canvas = document.createElement("canvas");
    canvas.className = "hero-canvas";
    canvas.setAttribute("aria-hidden", "true");
    hero.insertBefore(canvas, hero.firstChild);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0, h = 0, particles = [], raf = 0, onScreen = true;
    const mouse = { x: -9999, y: -9999 };
    const small = window.matchMedia("(max-width: 700px)").matches;

    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.max(1, w * dpr);
      canvas.height = Math.max(1, h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(small ? 30 : 68, Math.round((w * h) / 17000));
      particles = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.4 + 0.7,
      }));
      draw();
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        if (!reduce) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
          const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
          if (d < 130 && d > 0) { p.x += (dx / d) * 1.4; p.y += (dy / d) * 1.4; }
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 229, 255, 0.75)";
        ctx.fill();
      }
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 120) {
            ctx.strokeStyle = `rgba(0, 150, 255, ${(1 - d / 120) * 0.32})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        const md = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        if (md < 170) {
          ctx.strokeStyle = `rgba(0, 229, 255, ${(1 - md / 170) * 0.5})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
    }

    function loop() {
      draw();
      raf = onScreen && !document.hidden ? requestAnimationFrame(loop) : 0;
    }
    function start() { if (!raf && !reduce) raf = requestAnimationFrame(loop); }

    new ResizeObserver(resize).observe(canvas);
    resize();
    if (reduce) return; // one static frame only

    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) start(); }).observe(hero);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) start(); });
    hero.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    });
    hero.addEventListener("pointerleave", () => { mouse.x = mouse.y = -9999; });
    start();
  }

  /* ---------- 4. Count-up stats ---------- */
  function initCountUp() {
    if (reduce) return;
    const els = $$(".stat-item h4");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        run(en.target);
      });
    }, { threshold: 0.6 });
    els.forEach((el) => {
      const m = el.textContent.trim().match(/^(\d+(?:\.\d+)?)(.*)$/);
      if (!m) return;
      el.dataset.final = el.textContent.trim();
      el.dataset.num = m[1];
      el.dataset.suffix = m[2];
      el.setAttribute("aria-label", el.dataset.final);
      el.textContent = "0" + m[2];
      io.observe(el);
    });
    function run(el) {
      const target = parseFloat(el.dataset.num);
      const dec = (el.dataset.num.split(".")[1] || "").length;
      const t0 = performance.now(), dur = 1500;
      (function step(t) {
        const p = Math.min(1, (t - t0) / dur);
        const eased = p >= 1 ? 1 : 1 - Math.pow(2, -10 * p);
        if (p < 1) { el.textContent = (target * eased).toFixed(dec) + el.dataset.suffix; requestAnimationFrame(step); }
        else el.textContent = el.dataset.final;
      })(t0);
    }
  }

  /* ---------- 5. Staggered reveals + skill pill delays ---------- */
  function initStagger() {
    $$(".skill-pills").forEach((group) => {
      $$("span", group).forEach((s, i) => s.style.setProperty("--i", i));
    });
    if (reduce) return;
    const groups = new Map();
    $$(".stat-item, .value-card, .service-card, .timeline-item").forEach((el) => {
      const key = el.parentElement;
      const idx = groups.get(key) || 0;
      groups.set(key, idx + 1);
      el.style.transitionDelay = (idx % 4) * 90 + "ms";
      // remove the delay after the reveal so hover effects stay instant
      el.addEventListener("transitionend", (e) => {
        if (e.propertyName === "opacity") el.style.transitionDelay = "";
      });
    });
  }

  /* ---------- 6. Skills marquee ---------- */
  function initMarquee() {
    const hero = $(".hero");
    const names = [...new Set($$(".skill-pills span").map((s) => s.textContent.trim()).filter(Boolean))];
    if (!hero || names.length < 6) return;

    const wrap = document.createElement("div");
    wrap.className = "marquee-wrap" + (reduce ? " is-static" : "");
    wrap.setAttribute("aria-hidden", "true");

    const rows = [names.filter((_, i) => i % 2 === 0), names.filter((_, i) => i % 2 === 1)];
    rows.forEach((list, ri) => {
      const row = document.createElement("div");
      row.className = "marquee-row" + (ri === 1 ? " reverse" : "");
      const track = document.createElement("div");
      track.className = "marquee-track";
      for (let copy = 0; copy < 2; copy++) {
        const set = document.createElement("div");
        set.className = "marquee-set";
        if (copy === 1) set.setAttribute("aria-hidden", "true");
        list.forEach((n) => {
          const pill = document.createElement("span");
          pill.className = "marquee-pill";
          pill.textContent = n;
          set.appendChild(pill);
        });
        track.appendChild(set);
      }
      row.appendChild(track);
      wrap.appendChild(row);
    });
    hero.insertAdjacentElement("afterend", wrap);

    if (!reduce) {
      requestAnimationFrame(() => {
        $$(".marquee-row", wrap).forEach((row) => {
          const set = $(".marquee-set", row);
          row.style.setProperty("--dur", Math.max(24, set.scrollWidth / 45) + "s");
        });
      });
    }
  }

  /* ---------- 7. Spotlight + tilt + magnetic (delegated, so dynamic cards work too) ---------- */
  function initPointerFx() {
    if (!finePointer || reduce) return;
    const SPOT = ".stat-item, .value-card, .service-card, .project-card, .timeline-item, .skill-category, .contact-box";
    const TILT = ".project-card, .hero-avatar-wrapper";
    const MAG = ".hero-cta .btn, .nav-btn, .contact-box .btn";

    let spotEl = null, tiltEl = null, magEl = null, pending = null;

    function resetTilt(el) {
      if (!el) return;
      el.classList.remove("fx-tilting");
      el.style.transform = "";
    }
    function resetMag(el) { if (el) el.style.translate = ""; }

    function apply() {
      const e = pending; pending = null;
      if (!e) return;

      if (FX.spotlight) {
        const card = e.target.closest ? e.target.closest(SPOT) : null;
        if (spotEl && spotEl !== card) spotEl.classList.remove("fx-spot");
        if (card) {
          const r = card.getBoundingClientRect();
          card.style.setProperty("--mx", e.clientX - r.left + "px");
          card.style.setProperty("--my", e.clientY - r.top + "px");
          card.classList.add("fx-spot");
        }
        spotEl = card;
      }

      if (FX.tilt) {
        const t = e.target.closest ? e.target.closest(TILT) : null;
        if (tiltEl && tiltEl !== t) resetTilt(tiltEl);
        if (t) {
          const r = t.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          const max = t.classList.contains("hero-avatar-wrapper") ? 9 : 5;
          const lift = t.classList.contains("project-card") ? " translateY(-4px)" : "";
          t.classList.add("fx-tilting");
          t.style.transform = `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)${lift}`;
        }
        tiltEl = t;
      }

      if (FX.magnetic) {
        const b = e.target.closest ? e.target.closest(MAG) : null;
        if (magEl && magEl !== b) resetMag(magEl);
        if (b) {
          const r = b.getBoundingClientRect();
          const dx = (e.clientX - (r.left + r.width / 2)) * 0.22;
          const dy = (e.clientY - (r.top + r.height / 2)) * 0.3;
          b.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
        }
        magEl = b;
      }
    }

    document.addEventListener("pointermove", (e) => {
      if (!pending) requestAnimationFrame(apply);
      pending = e;
    }, { passive: true });
    document.documentElement.addEventListener("mouseleave", () => {
      if (spotEl) spotEl.classList.remove("fx-spot");
      resetTilt(tiltEl); resetMag(magEl);
      spotEl = tiltEl = magEl = null;
    });
  }

  /* ---------- 8. Scrollspy for the nav ---------- */
  function initScrollspy() {
    const links = $$('.nav-links a.nav-link[href^="#"]');
    const map = new Map();
    links.forEach((a) => {
      const sec = document.getElementById(a.getAttribute("href").slice(1));
      if (sec) map.set(sec, a);
    });
    if (!map.size) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          links.forEach((l) => l.classList.remove("active"));
          map.get(en.target).classList.add("active");
        }
      });
    }, { rootMargin: "-42% 0px -52% 0px" });
    map.forEach((_, sec) => io.observe(sec));
    window.addEventListener("scroll", () => {
      if (window.scrollY < 250) links.forEach((l) => l.classList.remove("active"));
    }, { passive: true });
  }

  /* ---------- 9. Back-to-top + quick-jump buttons ---------- */
  function scrollToId(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  function initFabs() {
    const top = document.createElement("button");
    top.type = "button";
    top.className = "fx-fab to-top";
    top.setAttribute("aria-label", "Back to top");
    top.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>';
    top.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }));
    document.body.appendChild(top);
    window.addEventListener("scroll", () => top.classList.toggle("show", window.scrollY > 700), { passive: true });
  }

  /* ---------- 10. Quick-jump palette (Ctrl/Cmd + K, or "/") ---------- */
  function initPalette() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fx-fab qj-btn";
    btn.setAttribute("aria-label", "Open quick jump");
    btn.innerHTML = '<span>Quick jump</span><kbd>Ctrl K</kbd>';
    if (/Mac|iPhone|iPad/.test(navigator.platform)) btn.querySelector("kbd").textContent = "⌘ K";
    document.body.appendChild(btn);

    const overlay = document.createElement("div");
    overlay.className = "qj-overlay";
    overlay.innerHTML =
      '<div class="qj-box" role="dialog" aria-modal="true" aria-label="Quick jump">' +
      '<input class="qj-input" type="text" placeholder="Jump to a section or project…" aria-label="Search sections and projects" autocomplete="off" />' +
      '<ul class="qj-list" role="listbox"></ul>' +
      '<div class="qj-foot"><span>↑↓ navigate</span><span>↵ open</span><span>esc close</span></div></div>';
    document.body.appendChild(overlay);
    const input = $(".qj-input", overlay);
    const list = $(".qj-list", overlay);

    let items = [], shown = [], sel = 0, lastFocus = null;

    function build() {
      items = [];
      [["about", "About me"], ["roles", "Core roles"], ["skills", "Skills & tools"], ["experience", "Background"], ["projects", "Work & feats"], ["social", "Social feed"], ["contact", "Contact"]]
        .forEach(([id, label]) => {
          if (document.getElementById(id)) items.push({ label, hint: "Section", icon: "#", run: () => scrollToId(id) });
        });
      const mail = $('a[href^="mailto:"]');
      if (mail) items.push({ label: "Email me", hint: mail.getAttribute("href").replace("mailto:", ""), icon: "✉", run: () => { window.location.href = mail.getAttribute("href"); } });
      const msn = $(".messenger-fab");
      if (msn && /^https:\/\//.test(msn.href)) items.push({ label: "Message me on Messenger", hint: "Opens Messenger", icon: "💬", run: () => window.open(msn.href, "_blank", "noopener") });
      [["github.com", "GitHub"], ["linkedin.com", "LinkedIn"], ["facebook.com", "Facebook"], ["instagram.com", "Instagram"]].forEach(([host, name]) => {
        const a = $$(`a[href*="${host}"]`).find((x) => !x.classList.contains("messenger-fab") && /^https:\/\//.test(x.href));
        if (a) items.push({ label: "Open " + name, hint: "External link", icon: "↗", run: () => window.open(a.href, "_blank", "noopener") });
      });
      if (typeof allProjects !== "undefined" && Array.isArray(allProjects)) {
        allProjects.forEach((p) => items.push({
          label: String(p.title || "Untitled project"), hint: "Project", icon: "◆",
          run: () => {
            scrollToId("projects");
            setTimeout(() => { if (typeof openProjectModal === "function") openProjectModal(p.id); }, 450);
          },
        }));
      }
    }

    function render() {
      const q = input.value.trim().toLowerCase();
      shown = items.filter((it) => !q || (it.label + " " + it.hint).toLowerCase().includes(q));
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      list.textContent = "";
      if (!shown.length) {
        const li = document.createElement("li");
        li.className = "qj-empty";
        li.textContent = "No matches";
        list.appendChild(li);
        return;
      }
      shown.forEach((it, i) => {
        const li = document.createElement("li");
        li.className = "qj-item" + (i === sel ? " sel" : "");
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", i === sel ? "true" : "false");
        const icon = document.createElement("span"); icon.className = "qj-icon"; icon.textContent = it.icon;
        const label = document.createElement("span"); label.className = "qj-label"; label.textContent = it.label;
        const hint = document.createElement("span"); hint.className = "qj-hint"; hint.textContent = it.hint;
        li.append(icon, label, hint);
        li.addEventListener("mousemove", () => { if (sel !== i) { sel = i; render(); } });
        li.addEventListener("click", () => choose(i));
        list.appendChild(li);
      });
      const cur = $(".qj-item.sel", list);
      if (cur) cur.scrollIntoView({ block: "nearest" });
    }

    function open() {
      lastFocus = document.activeElement;
      build(); input.value = ""; sel = 0; render();
      overlay.classList.add("open");
      input.focus();
    }
    function close() {
      overlay.classList.remove("open");
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function choose(i) {
      const it = shown[i];
      if (!it) return;
      close();
      setTimeout(it.run, 60);
    }

    btn.addEventListener("click", open);
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
    input.addEventListener("input", () => { sel = 0; render(); });
    document.addEventListener("keydown", (e) => {
      const isOpen = overlay.classList.contains("open");
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        isOpen ? close() : open();
        return;
      }
      const typing = /^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable;
      if (!isOpen && e.key === "/" && !typing) { e.preventDefault(); open(); return; }
      if (!isOpen) return;
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); render(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); render(); }
      else if (e.key === "Enter") { e.preventDefault(); choose(sel); }
      else if (e.key === "Tab") { e.preventDefault(); input.focus(); } // keep focus inside the dialog
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    safe("progress", initProgress);
    safe("hero text", initHeroText);
    if (FX.particles) safe("particles", initParticles);
    safe("count-up", initCountUp);
    safe("stagger", initStagger);
    if (FX.marquee) safe("marquee", initMarquee);
    safe("pointer effects", initPointerFx);
    safe("scrollspy", initScrollspy);
    safe("buttons", initFabs);
    if (FX.palette) safe("palette", initPalette);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
