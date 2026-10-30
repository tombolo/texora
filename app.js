/* ==========================================================
   AsiaTix — app logic
   ========================================================== */
(() => {
  "use strict";

  const CFG = window.ASIATIX_CONFIG;
  const METHODS = window.ASIATIX_METHODS;
  const COUNTRIES = window.ASIATIX_COUNTRIES;
  const LANGS = window.ASIATIX_LANGS;
  const I18N = window.ASIATIX_I18N;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
  };

  /* ---------------- data ---------------- */
  let EVENTS = [
    { id: 1,  title: "Neon Tokyo Nights Festival",   city: "Tokyo",      cc: "JP", cat: "festival", img: "img/tokyo-neon.jpg",     usd: 59,  days: 9,  left: 38,  hot: 1 },
    { id: 2,  title: "Sky K-Pop Live",               city: "Seoul",      cc: "KR", cat: "music",    img: "img/seoul-concert.jpg",  usd: 89,  days: 14, left: 12,  hot: 1 },
    { id: 3,  title: "Songkran Water Splash Fest",   city: "Bangkok",    cc: "TH", cat: "festival", img: "img/bangkok.jpg",        usd: 35,  days: 21, left: 0,   hot: 0 },
    { id: 4,  title: "Marina Bay Night Race Pass",   city: "Singapore",  cc: "SG", cat: "sports",   img: "img/singapore.jpg",      usd: 120, days: 30, left: 14,  hot: 1 },
    { id: 5,  title: "Bali Sunset Sound",            city: "Bali",       cc: "ID", cat: "music",    img: "img/bali.jpg",           usd: 49,  days: 11, left: 0,   hot: 0 },
    { id: 6,  title: "Mumbai Stand-Up Showdown",     city: "Mumbai",     cc: "IN", cat: "culture",  img: "img/mumbai.jpg",         usd: 25,  days: 6,  left: 24,  hot: 0 },
    { id: 7,  title: "Taipei Sky Lantern Night",     city: "Taipei",     cc: "TW", cat: "festival", img: "img/taipei.jpg",         usd: 32,  days: 18, left: 0,   hot: 0 },
    { id: 8,  title: "Dubai Desert Beats",           city: "Dubai",      cc: "AE", cat: "music",    img: "img/dubai.jpg",          usd: 95,  days: 25, left: 19,  hot: 1 },
    { id: 9,  title: "Hanoi Old Quarter Food Walk",  city: "Hanoi",      cc: "VN", cat: "tour",     img: "img/hanoi.jpg",          usd: 28,  days: 4,  left: 0,   hot: 0 },
    { id: 10, title: "Kyoto Temple Illumination",    city: "Kyoto",      cc: "JP", cat: "culture",  img: "img/kyoto.jpg",          usd: 40,  days: 16, left: 0,   hot: 0 },
    { id: 11, title: "Shanghai Skyline Night Cruise",city: "Shanghai",   cc: "CN", cat: "tour",     img: "img/shanghai.jpg",       usd: 55,  days: 7,  left: 31,  hot: 0 },
    { id: 12, title: "Manila Bay Music Fest",        city: "Manila",     cc: "PH", cat: "music",    img: "img/manila.jpg",         usd: 42,  days: 20, left: 0,   hot: 0 },
    { id: 13, title: "Grand Sumo Tournament Seats",  city: "Tokyo",      cc: "JP", cat: "sports",   img: "img/sumo.jpg",           usd: 70,  days: 33, left: 9,   hot: 0 },
    { id: 14, title: "Hanbok Palace Night Tour",     city: "Seoul",      cc: "KR", cat: "tour",     img: "img/palace.jpg",         usd: 38,  days: 5,  left: 0,   hot: 0 }
  ];
  const CATS = ["all", "music", "festival", "sports", "culture", "tour"];
  const DESTS = [
    { city: "Tokyo",     cc: "JP", img: "img/tokyo-neon.jpg" },
    { city: "Seoul",     cc: "KR", img: "img/palace.jpg" },
    { city: "Bangkok",   cc: "TH", img: "img/bangkok.jpg" },
    { city: "Singapore", cc: "SG", img: "img/singapore.jpg" }
  ];
  // Windows does not render flag emoji, so we show ISO country-code badges instead
  const flagEl = (cc) => `<span class="cc">${cc === "XX" ? "🌍" : cc}</span>`;
  const flagTxt = (cc) => (cc === "XX" ? "🌍" : cc);

  /* ---------------- state ---------------- */
  const state = { country: "XX", lang: "en", cat: "all", query: "", detected: false };

  /* ---------------- i18n helpers ---------------- */
  const t = (key, vars = {}) => {
    let s = (I18N[state.lang] && I18N[state.lang][key]) || I18N.en[key] || key;
    for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k]);
    return s;
  };
  const locale = () => LANGS[state.lang].locale;
  const countryName = (cc) => {
    if (cc === "XX") return "🌍 Global";
    try { return new Intl.DisplayNames([locale()], { type: "region" }).of(cc); } catch { return COUNTRIES[cc].name; }
  };
  const round3 = (n) => { if (n <= 0) return 0; const m = Math.pow(10, Math.floor(Math.log10(n)) - 2); return Math.round(n / m) * m; };
  const unitLocal = (usd) => {
    const cur = COUNTRIES[state.country].cur;
    return cur === "USD" ? usd : round3(usd * CFG.rates[cur]);
  };
  const money = (n) => {
    const cur = COUNTRIES[state.country].cur;
    const small = CFG.rates[cur] < 10;
    try {
      return new Intl.NumberFormat(locale(), { style: "currency", currency: cur, maximumFractionDigits: small ? 2 : 0, minimumFractionDigits: 0 }).format(n);
    } catch { return `${cur} ${Math.round(n)}`; }
  };
  const eventDate = (e) => {
    if (e && e.date) { const d = new Date(e.date); if (!isNaN(d)) return d; }
    const d = new Date(); d.setDate(d.getDate() + (e && e.days || 0)); d.setHours(19, 30); return d;
  };
  const dateFmt = (e) => {
    const d = eventDate(typeof e === "object" ? e : { days: e });
    try { return new Intl.DateTimeFormat(locale(), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d); }
    catch { return d.toDateString(); }
  };

  function applyTranslations() {
    const L = LANGS[state.lang];
    document.documentElement.lang = state.lang;
    document.documentElement.dir = L.dir;
    $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    renderFilters(); renderEvents(false); renderDests(); renderPayments(); renderSelects();
    const c = COUNTRIES[state.country];
    $("#payForFlag").innerHTML = flagEl(state.country);
    $("#payForText").textContent = t("pay_for", { country: countryName(state.country) });
    $("#regionFlag").innerHTML = flagEl(state.country);
    $("#chipLoc").textContent = `${countryName(state.country).replace("🌍 ", "")} · ${L.label}`;
    document.title = `AsiaTix — ${t("h1a")} ${t("h1b")}`;
  }

  function renderSelects() {
    const ls = $("#langSelect"), rs = $("#regionSelect");
    ls.innerHTML = Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${k === state.lang ? "selected" : ""}>${v.label}</option>`).join("");
    rs.innerHTML = Object.keys(COUNTRIES).map((k) => `<option value="${k}" ${k === state.country ? "selected" : ""}>${countryName(k).replace("🌍 ", "")}</option>`).join("");
  }

  function setRegion(cc, { save = true, announce = false, syncLang = true } = {}) {
    if (!COUNTRIES[cc]) cc = "XX";
    state.country = cc;
    if (syncLang) state.lang = COUNTRIES[cc].lang;
    if (save) store.set("asiatix_region", cc);
    applyTranslations();
    if (announce) toast(`${flagTxt(cc)}  ${t("detected", { lang: LANGS[state.lang].label, country: countryName(cc).replace("🌍 ", "") })}`);
  }

  /* ---------------- geo detection ---------------- */
  async function fetchJSON(url, ms = 2500) {
    const ctl = new AbortController(); const id = setTimeout(() => ctl.abort(), ms);
    try { const r = await fetch(url, { signal: ctl.signal }); return await r.json(); } finally { clearTimeout(id); }
  }
  async function detectCountry() {
    for (const g of CFG.geoEndpoints) {
      try { const d = await fetchJSON(g.url); const cc = g.pick(d); if (cc) return { cc: String(cc).toUpperCase(), src: "ip" }; } catch { /* next */ }
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (window.ASIATIX_TZ[tz]) return { cc: window.ASIATIX_TZ[tz], src: "tz" };
    const nav = (navigator.language || "en").toLowerCase();
    const map = { zh: "CN", ja: "JP", ko: "KR", hi: "IN", th: "TH", vi: "VN", id: "ID", ms: "MY", fil: "PH", tl: "PH", ar: "AE" };
    return { cc: map[nav.slice(0, 2)] || "XX", src: "lang" };
  }
  async function resolveRegion() {
    const forced = new URLSearchParams(location.search).get("region");
    if (forced && COUNTRIES[forced.toUpperCase()]) return { cc: forced.toUpperCase(), saved: false };
    const saved = store.get("asiatix_region");
    if (saved && COUNTRIES[saved]) return { cc: saved, saved: true };
    const d = await detectCountry();
    // Countries we don't have a dedicated profile for fall back to "XX" (English / USD)
    return { cc: COUNTRIES[d.cc] ? d.cc : "XX", saved: false };
  }

  /* ---------------- loader ---------------- */
  function runLoader(ready) {
    const bar = $("#loaderBar"), pct = $("#loaderPct");
    $$("#loaderWords span").forEach((s, i) => { s.style.animationDelay = `${i * 0.5}s`; });
    const start = performance.now(); let p = 0, done = false;
    return new Promise((resolve) => {
      const tick = () => {
        const el = performance.now() - start;
        const cap = done ? 100 : 92;
        const target = Math.min(cap, (el / 1900) * 100);
        p += (target - p) * 0.12 + 0.15; p = Math.min(p, cap);
        bar.style.width = p + "%"; pct.textContent = Math.floor(p);
        if (p >= 99.5 && done) { pct.textContent = 100; bar.style.width = "100%"; return setTimeout(resolve, 350); }
        requestAnimationFrame(tick);
      };
      ready.then(() => { done = true; });
      requestAnimationFrame(tick);
    });
  }

  /* ---------------- events UI ---------------- */
  function renderFilters() {
    $("#filters").innerHTML = CATS.map((c) => `<button class="pill ${c === state.cat ? "active" : ""}" data-cat="${c}">${t(c === "all" ? "f_all" : c === "tour" ? "f_tour" : "f_" + c)}</button>`).join("");
  }
  const filtered = () => EVENTS.filter((e) =>
    (state.cat === "all" || e.cat === state.cat) &&
    (!state.query || (e.title + " " + e.city).toLowerCase().includes(state.query.toLowerCase())));

  function skeletons(n = 6) {
    $("#eventGrid").innerHTML = Array.from({ length: n }, () => `<div class="sk"><div class="a"></div><div class="l s"></div><div class="l m"></div><div class="l p"></div></div>`).join("");
  }
  let renderTimer;
  function renderEvents(withSkeleton = true) {
    clearTimeout(renderTimer);
    const draw = () => {
      const list = filtered();
      $("#emptyMsg").hidden = list.length > 0;
      $("#eventGrid").innerHTML = list.map((e, i) => {
        const flag = flagEl(e.cc);
        return `<article class="card" style="--i:${i}" data-id="${e.id}">
          <div class="card-art"><img src="${e.img}" alt="${e.title}" /></div>
          <span class="tag">${t("f_" + e.cat)}</span>${e.hot ? '<span class="hot">HOT</span>' : ""}
          <div class="card-body">
            <div class="card-meta"><span>${flag} ${e.city}</span><span>${dateFmt(e)}</span></div>
            <h3>${e.title}</h3>
            <div class="card-foot">
              <div class="price"><small>${t("from")}</small><b>${money(unitLocal(e.usd))}</b>${e.left ? `<div class="left">${t("left", { n: e.left })}</div>` : ""}</div>
              <button class="btn btn-primary btn-sm" data-buy="${e.id}">${t("buy")}</button>
            </div>
          </div>
        </article>`;
      }).join("");
    };
    if (withSkeleton) { skeletons(); renderTimer = setTimeout(draw, 650); } else draw();
  }

  function destList() {
    const map = {};
    EVENTS.forEach((e) => {
      if (!map[e.city]) map[e.city] = { city: e.city, cc: e.cc, img: e.img, n: 0 };
      map[e.city].n++;
    });
    const computed = Object.values(map).sort((a, b) => b.n - a.n);
    return (computed.length ? computed : DESTS).slice(0, 4);
  }
  function renderDests() {
    $("#destGrid").innerHTML = destList().map((d, i) => `
      <div class="dest reveal in" style="transition-delay:${i * 80}ms" data-city="${d.city}">
        <img src="${d.img}" alt="${d.city}" />
        <div><h3>${flagEl(d.cc)} ${d.city}</h3><p>${t("n_events", { n: d.n || EVENTS.filter((e) => e.city === d.city).length })}</p></div></div>`).join("");
  }

  function renderPayments() {
    const list = COUNTRIES[state.country].pay;
    $("#payMethods").innerHTML = list.map((id, i) => {
      const m = METHODS[id];
      return `<div class="pm" style="--i:${i};--c1:${m.c1};--c2:${m.c2}"><span class="pm-ic ${m.dark ? "dark" : ""}">${m.short}</span><div><b>${m.name}</b></div></div>`;
    }).join("");
  }

  /* ---------------- toast ---------------- */
  let toastTimer;
  function toast(msg) {
    const el = $("#toast"); el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3600);
  }

  /* ---------------- checkout ---------------- */
  let co = null;
  const modal = $("#modal"), body = $("#modalBody");
  const unitPrice = () => unitLocal(co.ev.usd) * (co.tier === "vip" ? 2.2 : 1);
  const calc = () => { const sub = unitPrice() * co.qty; const fee = sub * (CFG.serviceFeePct / 100); return { sub, fee, total: sub + fee }; };

  function openCheckout(id) {
    const ev = EVENTS.find((e) => e.id === id); if (!ev) return;
    co = { ev, tier: "gen", qty: 2, step: 1, name: "", email: "", method: COUNTRIES[state.country].pay[0] };
    modal.hidden = false; document.body.style.overflow = "hidden"; renderCheckout();
  }
  function closeCheckout() { modal.hidden = true; document.body.style.overflow = ""; co = null; }

  const header = () => `
    <div class="co-event"><div class="co-art"><img src="${co.ev.img}" alt="" /></div>
      <div><b>${co.ev.title}</b><small>${flagEl(co.ev.cc)} ${co.ev.city} · ${dateFmt(co.ev)}</small></div></div>
    <div class="stepper">${[1, 2, 3].map((n) => `<div class="${co.step >= n ? "on" : ""}">${t(["c_tickets", "c_details", "c_pay"][n - 1])}</div>`).join("")}</div>`;
  const summary = () => { const c = calc(); return `<div class="sum"><div><span>${co.qty} × ${t(co.tier === "vip" ? "t_vip" : "t_gen")}</span><span>${money(c.sub)}</span></div><div><span>${t("fee")}</span><span>${money(c.fee)}</span></div><div class="tot"><span>${t("total")}</span><span>${money(c.total)}</span></div></div>`; };

  function renderCheckout() {
    if (!co) return;
    let html = header();
    if (co.step === 1) {
      html += `<div class="tiers">
        <button class="tier ${co.tier === "gen" ? "on" : ""}" data-tier="gen"><b>${t("t_gen")}</b><span>${money(unitLocal(co.ev.usd))}</span></button>
        <button class="tier ${co.tier === "vip" ? "on" : ""}" data-tier="vip"><b>${t("t_vip")}</b><span>${money(unitLocal(co.ev.usd) * 2.2)}</span></button></div>
        <div class="qty"><span>${t("qty")}</span><div class="qty-ctl"><button data-q="-1">−</button><output>${co.qty}</output><button data-q="1">+</button></div></div>
        ${summary()}<div class="co-actions"><button class="btn btn-primary" data-go="2">${t("next")} →</button></div>`;
    } else if (co.step === 2) {
      html += `<label class="field">${t("name")}<input id="coName" autocomplete="name" value="${co.name}" /></label>
        <label class="field">${t("email")}<input id="coEmail" type="email" autocomplete="email" value="${co.email}" /></label>
        ${summary()}<div class="co-actions"><button class="btn btn-ghost" data-go="1">←</button><button class="btn btn-primary" data-go="3">${t("next")} →</button></div>`;
    } else if (co.step === 3) {
      const list = COUNTRIES[state.country].pay;
      html += `<div class="field paywith">${t("pay_with")} · ${flagEl(state.country)} ${countryName(state.country).replace("🌍 ", "")}</div>
        <div class="pay-opts">${list.map((id) => { const m = METHODS[id]; return `<button class="opt ${co.method === id ? "on" : ""}" data-m="${id}" style="--c1:${m.c1};--c2:${m.c2}"><span class="pm-ic ${m.dark ? "dark" : ""}">${m.short}</span><div><b>${m.name}</b></div><i class="dot"></i></button>`; }).join("")}</div>
        ${summary()}<div class="co-actions"><button class="btn btn-ghost" data-go="2">←</button><button class="btn btn-primary" id="payBtn">🔒 ${t("pay_now", { amount: money(calc().total) })}</button></div>`;
    }
    body.innerHTML = html;
  }

  function goStep(n) {
    if (n === 3) {
      const nm = $("#coName"), em = $("#coEmail");
      if (nm) { co.name = nm.value.trim(); co.email = em.value.trim(); }
      const okName = co.name.length > 1, okMail = /^\S+@\S+\.\S+$/.test(co.email);
      if (!okName || !okMail) {
        nm.classList.toggle("bad", !okName); em.classList.toggle("bad", !okMail);
        toast(t("err_fields")); return;
      }
    }
    if (n === 1 || n === 2) { const nm = $("#coName"), em = $("#coEmail"); if (nm) { co.name = nm.value; co.email = em.value; } }
    co.step = n; renderCheckout();
  }

  async function pay() {
    const order = { id: "AT" + Math.random().toString(36).slice(2, 8).toUpperCase(), eventId: co.ev.id, tier: co.tier, qty: co.qty, method: co.method,
      currency: COUNTRIES[state.country].cur, total: calc().total, name: co.name, email: co.email, country: state.country };
    body.innerHTML = `${header()}<div class="center"><div class="spinner"></div><h3>${t("processing")}</h3><p id="procMsg">${METHODS[co.method].name}</p></div>`;
    try {
      if (CFG.demoMode) {
        await new Promise((r) => setTimeout(r, 2800));
      } else {
        const res = await fetch(CFG.checkoutEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(order) });
        const data = await res.json();
        if (data.url) { location.href = data.url; return; }
        throw new Error("No checkout url");
      }
      success(order);
    } catch (err) {
      console.error(err); co.step = 3; renderCheckout(); toast("⚠️ Payment failed — please try again");
    }
  }

  function qrSVG(seed) {
    let h = 0; for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => (h = (h * 1664525 + 1013904223) >>> 0) / 4294967296;
    const N = 25; let r = "";
    const O = N - 7; // origin offset for right/bottom finder patterns
    const origins = [[0, 0], [O, 0], [0, O]];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let on, inFinder = false;
      for (const [ox, oy] of origins) {
        const cx = x - ox, cy = y - oy;
        if (cx >= -1 && cx <= 7 && cy >= -1 && cy <= 7) {
          inFinder = true;
          on = cx >= 0 && cx <= 6 && cy >= 0 && cy <= 6 &&
            (cx === 0 || cx === 6 || cy === 0 || cy === 6 || (cx >= 2 && cx <= 4 && cy >= 2 && cy <= 4));
        }
      }
      if (!inFinder) on = rnd() > 0.52;
      if (on) r += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
    return `<svg viewBox="-1 -1 ${N + 2} ${N + 2}" fill="#161410" shape-rendering="crispEdges">${r}</svg>`;
  }

  function success(order) {
    body.innerHTML = `<div class="center">
      <svg class="check" viewBox="0 0 100 100"><circle cx="50" cy="50" r="41"/><path d="M32 52l13 13 24-28"/></svg>
      <h3>${t("ok_t")}</h3><p>${t("ok_d", { email: order.email })}</p></div>
      <div class="e-ticket">
        <div class="e-top" style="background-image:url('${co.ev.img}')"><small>${co.ev.city.toUpperCase()} · ${co.ev.cc}</small><b>${co.ev.title}</b></div>
        <div class="e-mid"></div>
        <div class="e-bot">${qrSVG(order.id)}<div><b>${order.name}</b><span>${order.qty} × ${t(order.tier === "vip" ? "t_vip" : "t_gen")}</span><span>${dateFmt(co.ev)}</span><span>#${order.id}</span></div></div>
      </div>
      <div class="co-actions"><button class="btn btn-primary" data-close>${t("close")}</button></div>`;
    confetti();
  }

  /* ---------------- confetti ---------------- */
  function confetti() {
    const cv = $("#confetti"), ctx = cv.getContext("2d");
    cv.width = innerWidth; cv.height = innerHeight;
    const cols = ["#c9a56a", "#e8d5a3", "#8a6a3f", "#c47a5a", "#9aaf86"];
    const ps = Array.from({ length: 150 }, () => ({ x: cv.width / 2, y: cv.height / 2 + 40, vx: (Math.random() - .5) * 18, vy: -Math.random() * 18 - 4, s: Math.random() * 8 + 4, c: cols[Math.random() * cols.length | 0], r: Math.random() * 6, vr: (Math.random() - .5) * .4 }));
    let f = 0;
    (function loop() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      ps.forEach((p) => { p.vy += .45; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
      if (++f < 160) requestAnimationFrame(loop); else ctx.clearRect(0, 0, cv.width, cv.height);
    })();
  }

  /* ---------------- effects ---------------- */
  function setupReveal() {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 });
    $$(".reveal:not(.in)").forEach((el) => io.observe(el));
  }
  function countUp() {
    $$("[data-count]").forEach((el) => {
      const end = parseFloat(el.dataset.count), dec = +el.dataset.dec || 0, suf = el.dataset.suffix || "", t0 = performance.now(), dur = 1800;
      (function step(now) {
        const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
        el.textContent = (end * e).toFixed(dec) + (k === 1 ? suf : "");
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    });
  }
  function setupMotion() {
    const glow = $("#cursorGlow");
    addEventListener("pointermove", (e) => { glow.style.opacity = 1; glow.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`; glow.style.left = 0; glow.style.top = 0; }, { passive: true });
    const nav = $("#nav");
    const onScroll = () => { nav.classList.toggle("scrolled", scrollY > 30); };
    addEventListener("scroll", onScroll, { passive: true }); onScroll();
    // hero parallax
    const hv = $("#heroVisual");
    $(".hero").addEventListener("pointermove", (e) => {
      const r = hv.getBoundingClientRect(), dx = (e.clientX - (r.left + r.width / 2)) / r.width, dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      $$(".float-ticket", hv).forEach((el) => { const d = +el.dataset.depth; el.style.setProperty("--tx", `${dx * d}px`); el.style.setProperty("--ty", `${dy * d}px`); });
    });
    // card tilt
    const grid = $("#eventGrid");
    grid.addEventListener("pointermove", (e) => {
      const c = e.target.closest(".card"); if (!c) return;
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.setProperty("--ry", `${(x - .5) * 10}deg`); c.style.setProperty("--rx", `${(.5 - y) * 10}deg`);
      c.style.setProperty("--mx", `${x * 100}%`); c.style.setProperty("--my", `${y * 100}%`);
    });
    grid.addEventListener("pointerout", (e) => { const c = e.target.closest(".card"); if (c && !c.contains(e.relatedTarget)) { c.style.setProperty("--rx", "0deg"); c.style.setProperty("--ry", "0deg"); } });
  }

  /* ---------------- events wiring ---------------- */
  function wire() {
    $("#langSelect").addEventListener("change", (e) => { state.lang = e.target.value; store.set("asiatix_lang", state.lang); applyTranslations(); });
    $("#regionSelect").addEventListener("change", (e) => { store.set("asiatix_lang", ""); setRegion(e.target.value, { announce: true }); });
    $("#filters").addEventListener("click", (e) => { const b = e.target.closest("[data-cat]"); if (!b) return; state.cat = b.dataset.cat; renderFilters(); renderEvents(true); });
    $("#searchForm").addEventListener("submit", (e) => { e.preventDefault(); state.query = $("#searchInput").value.trim(); renderEvents(true); $("#events").scrollIntoView({ behavior: "smooth" }); });
    $("#searchInput").addEventListener("input", (e) => { state.query = e.target.value.trim(); renderEvents(false); });
    $("#eventGrid").addEventListener("click", (e) => { const b = e.target.closest("[data-buy]"); if (b) openCheckout(Number(b.dataset.buy)); });
    $("#destGrid").addEventListener("click", (e) => { const d = e.target.closest("[data-city]"); if (!d) return; state.query = d.dataset.city; state.cat = "all"; $("#searchInput").value = state.query; renderFilters(); renderEvents(true); $("#events").scrollIntoView({ behavior: "smooth" }); });
    $("#newsForm").addEventListener("submit", (e) => { e.preventDefault(); e.target.reset(); toast("✅ " + t("news_btn")); });
    modal.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) return closeCheckout();
      const tier = e.target.closest("[data-tier]"); if (tier) { co.tier = tier.dataset.tier; return renderCheckout(); }
      const q = e.target.closest("[data-q]"); if (q) { co.qty = Math.min(10, Math.max(1, co.qty + +q.dataset.q)); return renderCheckout(); }
      const go = e.target.closest("[data-go]"); if (go) return goStep(+go.dataset.go);
      const m = e.target.closest("[data-m]"); if (m) { co.method = m.dataset.m; return renderCheckout(); }
      if (e.target.closest("#payBtn")) pay();
    });
    addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeCheckout(); });
    $("#year").textContent = new Date().getFullYear();
    setupChat();
  }

  async function loadLiveEvents() {
    try {
      const list = await fetch("/api/events").then((r) => r.json());
      if (Array.isArray(list) && list.length) {
        EVENTS = list.map((e) => ({ ...e, hot: e.hot ? 1 : 0 }));
      }
    } catch { /* keep built-in list */ }
  }

  function setupChat() {
    const fab = $("#chatFab"), panel = $("#chatPanel"), msgs = $("#chatMsgs"), form = $("#chatForm");
    if (!fab) return;
    let threadId = store.get("asiatix_chat") || ("T" + Math.random().toString(36).slice(2, 10));
    store.set("asiatix_chat", threadId);
    let lastCount = 0, timer = null;
    const paint = (thread) => {
      const list = (thread && thread.messages) || [];
      if (!list.length) {
        msgs.innerHTML = `<div class="bubble admin">${t("chat_hello")}</div>`;
      } else {
        msgs.innerHTML = list.map((m) => `<div class="bubble ${m.from}">${String(m.text).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</div>`).join("");
      }
      msgs.scrollTop = 99999;
      if (list.length > lastCount && list[list.length - 1].from === "admin" && panel.hidden) $("#chatDot").hidden = false;
      lastCount = list.length;
    };
    const pull = async () => {
      try { paint(await fetch("/api/chat?thread=" + encodeURIComponent(threadId)).then((r) => r.json())); } catch { /* offline */ }
    };
    fab.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) { $("#chatDot").hidden = true; pull(); }
    });
    $("#chatClose").addEventListener("click", () => { panel.hidden = true; });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = $("#chatText").value.trim(); if (!text) return;
      $("#chatText").value = "";
      try {
        const thread = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId, name: $("#chatName").value.trim(), email: $("#chatEmail").value.trim(), text })
        }).then((r) => r.json());
        threadId = thread.id || threadId;
        store.set("asiatix_chat", threadId);
        paint(thread);
      } catch { toast("Could not send — is the server running?"); }
    });
    pull();
    timer = setInterval(() => { if (!panel.hidden) pull(); }, 5000);
    void timer;
  }

  /* ---------------- boot ---------------- */
  async function boot() {
    wire(); setupMotion();
    skeletons();
    let result = { cc: "XX", saved: false };
    const ready = Promise.all([
      resolveRegion().then((r) => { result = r; }).catch(() => {}),
      loadLiveEvents()
    ]);
    await runLoader(ready);
    // apply language: explicit saved language wins over region default
    try {
      setRegion(result.cc, { save: false });
      const savedLang = store.get("asiatix_lang");
      if (result.saved && savedLang && LANGS[savedLang]) { state.lang = savedLang; applyTranslations(); }
    } catch (err) { console.error(err); }
    $("#loader").classList.add("done");
    document.body.classList.remove("is-loading");
    setupReveal(); setTimeout(countUp, 500);
    if (!result.saved) setTimeout(() => toast(`${flagTxt(state.country)}  ${t("detected", { lang: LANGS[state.lang].label, country: countryName(state.country).replace("🌍 ", "") })}`), 900);
  }
  boot();
})();
