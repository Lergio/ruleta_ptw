"use strict";

/**
 * Lógica de la ruleta y de la interfaz.
 * Depende de api.js (global MalApi), que debe cargarse antes.
 */
(function () {
  const PALETTE = ["#8C9BFF", "#4FD1C1", "#FF8F85", "#FFC95C", "#C3A9F5"];
  const MAX_SEGS = 12;
  const USER_KEY = "ruleta-usuario";
  const MODES = [
    ["todos", "Todos"],
    ["pendientes", "Plan to watch"],
    ["espera", "En espera"],
  ];

  const $ = (id) => document.getElementById(id);
  const canvas = $("wheel");
  const ctx = canvas.getContext("2d");
  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- almacenamiento local (solo comodidades del navegador) ---------- */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const startedKey = () => "ruleta-empezados:" + user.toLowerCase();
  function loadStarted() {
    try { return new Set(JSON.parse(store.get(startedKey()) || "[]")); } catch (e) { return new Set(); }
  }
  function saveStarted() { store.set(startedKey(), JSON.stringify([...started])); }

  /* ---------- estado ---------- */
  let ALL = [];
  let types = [];
  let active = new Set();
  let started = new Set();
  let user = "";
  let mode = "todos";
  let segs = [];
  let rot = Math.random() * Math.PI * 2;
  let spinning = false;
  let loading = false;
  let current = null;
  let history = [];

  const inMode = (a, m = mode) =>
    m === "todos" || (m === "espera" ? a.s === "on_hold" : a.s === "plan_to_watch");
  // Los que todavía no se emitieron (a.u) cuentan para el total pero nunca entran al sorteo.
  const pool = () => ALL.filter((a) => !a.u && active.has(a.y) && inMode(a) && !started.has(a.id));

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const mod = (x, m) => ((x % m) + m) % m;

  /* ---------- dibujo de la ruleta ---------- */
  function fitLabel(name, type, maxW) {
    const suffix = "  ·  " + type;
    if (ctx.measureText(name + suffix).width <= maxW) return name + suffix;
    let t = name;
    while (t.length > 1 && ctx.measureText(t + "…" + suffix).width > maxW) t = t.slice(0, -1);
    return t.trimEnd() + "…" + suffix;
  }

  function draw() {
    const size = canvas.clientWidth;
    if (!size) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(size * dpr)) canvas.width = canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cs = getComputedStyle(document.documentElement);
    const rimC = cs.getPropertyValue("--rim").trim();
    const hubC = cs.getPropertyValue("--hub").trim();
    const lamp = cs.getPropertyValue("--lamp").trim();
    const c = size / 2, R = c - 8, r = R * 0.93;

    ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.fillStyle = rimC; ctx.fill();

    const n = segs.length;
    if (!n) {
      ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.fillStyle = hubC; ctx.fill();
      return;
    }
    const a = (Math.PI * 2) / n;
    ctx.font = `700 ${Math.max(11, R * 0.058)}px "Zen Kaku Gothic New", "Segoe UI", Arial, sans-serif`;
    ctx.textBaseline = "middle";

    for (let i = 0; i < n; i++) {
      const s = rot + i * a;
      let col = i % PALETTE.length;
      if (i === n - 1 && n > 1 && col === 0) col = 2;
      ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, r, s, s + a); ctx.closePath();
      ctx.fillStyle = PALETTE[col]; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = rimC; ctx.stroke();

      ctx.save(); ctx.translate(c, c); ctx.rotate(s + a / 2);
      ctx.textAlign = "right"; ctx.fillStyle = "#1A1526";
      ctx.fillText(fitLabel(segs[i].t, segs[i].y, r - 14 - R * 0.2), r - 14, 0);
      ctx.restore();
    }

    const dots = Math.max(24, n * 2);
    for (let i = 0; i < dots; i++) {
      const ang = rot + i * ((Math.PI * 2) / dots);
      ctx.beginPath();
      ctx.arc(c + Math.cos(ang) * (R + r) / 2, c + Math.sin(ang) * (R + r) / 2, Math.max(2, R * 0.011), 0, Math.PI * 2);
      ctx.fillStyle = lamp; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(c, c, R * 0.13, 0, Math.PI * 2);
    ctx.fillStyle = hubC; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = rimC; ctx.stroke();
  }

  function idleWheel() {
    segs = shuffle(pool()).slice(0, MAX_SEGS);
    draw();
  }

  /* ---------- interfaz ---------- */
  function setResultMessage(text) {
    const box = $("result");
    box.classList.remove("pop");
    box.textContent = "";
    const p = document.createElement("p");
    p.className = "placeholder";
    p.textContent = text;
    box.appendChild(p);
  }

  function renderCount() {
    const p = pool().length;
    const upcoming = ALL.filter((a) => a.u).length;
    $("count").textContent = ALL.length
      ? `${p} de ${ALL.length} animes en la ruleta`
      : "Cargá tu lista de MyAnimeList para armar la ruleta.";
    $("countNote").textContent = upcoming
      ? `${upcoming} ${upcoming === 1 ? "todavía no se emitió" : "todavía no se emitieron"} y no participan del sorteo.`
      : "";
    const removed = ALL.filter((a) => started.has(a.id)).length;
    const rs = $("restore");
    rs.hidden = removed === 0;
    if (removed) rs.textContent = `Restaurar los ${removed} que ya saqué`;
    $("spin").disabled = spinning || loading || p === 0;
  }

  function renderModes() {
    const box = $("modes");
    box.textContent = "";
    MODES.forEach(([k, label]) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip";
      b.setAttribute("aria-pressed", mode === k);
      const n = document.createElement("span");
      n.className = "n";
      n.textContent = ALL.filter((a) => !a.u && inMode(a, k) && active.has(a.y) && !started.has(a.id)).length;
      b.append(document.createTextNode(label), n);
      b.addEventListener("click", () => {
        if (spinning) return;
        mode = k;
        afterPoolChange();
      });
      box.appendChild(b);
    });
  }

  function renderChips() {
    const box = $("chips");
    box.textContent = "";
    types.forEach((t) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip";
      b.setAttribute("aria-pressed", active.has(t));
      const n = document.createElement("span");
      n.className = "n";
      n.textContent = ALL.filter((a) => a.y === t && !a.u && inMode(a) && !started.has(a.id)).length;
      b.append(document.createTextNode(t), n);
      b.addEventListener("click", () => {
        if (spinning) return;
        active.has(t) ? active.delete(t) : active.add(t);
        afterPoolChange();
      });
      box.appendChild(b);
    });
  }

  function afterPoolChange() {
    renderModes(); renderChips(); renderCount(); idleWheel();
    if (ALL.length && !pool().length && !current) {
      setResultMessage("No quedan animes con estos filtros. Activá otro tipo o restaurá la lista.");
    }
  }

  function showResult(a) {
    const box = $("result");
    box.textContent = "";
    box.classList.remove("pop"); void box.offsetWidth; box.classList.add("pop");

    const row = document.createElement("div");
    row.className = "result-row";

    if (a.img) {
      const img = document.createElement("img");
      img.className = "result-img";
      img.src = a.img;
      img.alt = "";
      img.loading = "lazy";
      img.onerror = () => img.remove();
      row.appendChild(img);
    }

    const content = document.createElement("div");
    content.className = "result-content";

    const h = document.createElement("h2");
    h.textContent = a.t;

    const meta = document.createElement("div");
    meta.className = "meta";
    const badge = document.createElement("span");
    badge.className = "badge"; badge.textContent = a.y;
    const eps = document.createElement("span");
    eps.className = "eps";
    eps.textContent = a.e > 0 ? `${a.e} ${a.e === 1 ? "episodio" : "episodios"}` : "Episodios sin definir";
    meta.append(badge, eps);
    if (a.yr) {
      const year = document.createElement("span");
      year.className = "year";
      year.textContent = a.yr;
      meta.appendChild(year);
    }
    content.append(h, meta);

    if (a.s === "on_hold") {
      const hold = document.createElement("p");
      hold.className = "hold";
      if (a.w > 0) {
        hold.textContent = a.e > 0
          ? `En espera: viste ${a.w} de ${a.e}. Retomá desde el episodio ${Math.min(a.w + 1, a.e)}.`
          : `En espera: viste ${a.w} episodios. Retomá desde el episodio ${a.w + 1}.`;
      } else {
        hold.textContent = "En espera: no tenés episodios vistos registrados.";
      }
      content.appendChild(hold);
    }

    const link = document.createElement("a");
    link.className = "mal-link";
    link.href = `https://myanimelist.net/anime/${encodeURIComponent(a.id)}`;
    link.target = "_blank"; link.rel = "noopener noreferrer";
    link.textContent = "Ver en MyAnimeList";
    content.appendChild(link);

    const related = document.createElement("div");
    related.className = "related";
    content.appendChild(related);
    loadRelated(a, related);

    row.appendChild(content);
    box.appendChild(row);

    updateStartedBtn();
  }

  const relatedCache = new Map();
  function loadRelated(a, container) {
    let p = relatedCache.get(a.id);
    if (!p) {
      p = MalApi.fetchRelatedAnime(a.id).catch(() => []);
      relatedCache.set(a.id, p);
    }
    p.then((list) => {
      // Si mientras cargaba ya se sorteó/limpió otro resultado, no lo mostramos.
      if (current !== a || !document.body.contains(container)) return;
      renderRelated(list, container);
    });
  }

  function renderRelated(list, container) {
    container.textContent = "";
    if (!list.length) return;
    const h3 = document.createElement("h3");
    h3.textContent = "Relacionados";
    const ul = document.createElement("ul");
    list.forEach((r) => {
      const li = document.createElement("li");
      const label = document.createElement("span");
      label.className = "rel-label";
      label.textContent = r.relLabel + ": ";
      const a = document.createElement("a");
      a.href = `https://myanimelist.net/anime/${encodeURIComponent(r.id)}`;
      a.target = "_blank"; a.rel = "noopener noreferrer";
      a.textContent = r.t;
      li.append(label, a);
      ul.appendChild(li);
    });
    container.append(h3, ul);
  }

  function updateStartedBtn() {
    const b = $("started");
    $("redo").hidden = !current;
    if (!current) { b.hidden = true; return; }
    b.hidden = false;
    b.textContent = started.has(current.id)
      ? "Deshacer: volver a la ruleta"
      : (current.s === "on_hold" ? "Ya lo retomé" : "Ya lo empecé");
  }

  function renderHistory() {
    $("history").hidden = history.length === 0;
    const ol = $("historyList");
    ol.textContent = "";
    history.slice(0, 10).forEach((a) => {
      const li = document.createElement("li");
      const s1 = document.createElement("span"); s1.textContent = a.t;
      const s2 = document.createElement("span"); s2.textContent = a.y;
      li.append(s1, s2);
      ol.appendChild(li);
    });
  }

  /* ---------- giro ---------- */
  function spin() {
    if (spinning || loading) return;
    const p = pool();
    if (!p.length) return;

    const winner = p[Math.floor(Math.random() * p.length)];
    const n = Math.min(MAX_SEGS, p.length);
    const others = shuffle(p.filter((x) => x !== winner)).slice(0, n - 1);
    const w = Math.floor(Math.random() * n);
    others.splice(w, 0, winner);
    segs = others;

    const a = (Math.PI * 2) / n;
    const desired = -Math.PI / 2 - (w * a + a / 2) + (Math.random() - 0.5) * a * 0.7;
    const turns = 5 + Math.floor(Math.random() * 3);
    const from = rot;
    const to = rot + mod(desired - rot, Math.PI * 2) + turns * Math.PI * 2;

    spinning = true;
    $("redo").disabled = true;
    $("spin").disabled = true;
    if (current) { setResultMessage("Girando…"); $("started").hidden = true; }
    $("spin").textContent = "Girando…";

    const finish = () => {
      rot = mod(to, Math.PI * 2);
      draw();
      spinning = false;
      $("redo").disabled = false;
      current = winner;
      history.unshift(winner);
      $("spin").textContent = "Girar de nuevo";
      showResult(winner);
      renderHistory();
      renderCount();
    };

    if (reduceMotion()) { rot = to; finish(); return; }

    const t0 = performance.now(), dur = 5200;
    (function frame(now) {
      const k = Math.min(1, (now - t0) / dur);
      rot = from + (to - from) * (1 - Math.pow(1 - k, 4));
      draw();
      k < 1 ? requestAnimationFrame(frame) : finish();
    })(t0);
  }

  /* ---------- carga desde MyAnimeList ---------- */
  function errorMessage(err) {
    switch (err && err.kind) {
      case "config": return "Falta configurar BASE_URL en js/api.js con la URL de tu proxy.";
      case "notfound": return "No encontré a ese usuario en MyAnimeList.";
      case "forbidden": return "La lista de este usuario es privada, o MyAnimeList rechazó la solicitud.";
      case "auth": return "MyAnimeList rechazó el Client ID. Revisá que sea el correcto.";
      case "network": return "No se pudo conectar con MyAnimeList. Si en la consola aparece un error de CORS, hace falta un proxy (ver BASE_URL en js/api.js).";
      default: return (err && err.message) || "Ocurrió un error inesperado.";
    }
  }

  function setLoading(on) {
    loading = on;
    $("load").disabled = on;
    $("load").textContent = on ? "Cargando…" : "Cargar lista";
    $("username").disabled = on;
    $("loadMsg").textContent = on ? "Descargando tu lista de MyAnimeList…" : $("loadMsg").textContent;
    renderCount();
  }

  async function loadUser(name) {
    name = name.trim();
    if (!name || spinning || loading) return;
    $("error").hidden = true;
    setLoading(true);
    try {
      const list = await MalApi.fetchWatchlist(name);
      user = name;
      store.set(USER_KEY, name);
      ALL = list;
      const counts = {};
      list.forEach((a) => { counts[a.y] = (counts[a.y] || 0) + 1; });
      types = Object.keys(counts).sort((x, y) => counts[y] - counts[x]);
      active = new Set(types);
      started = loadStarted();
      mode = "todos";
      current = null;
      history = [];
      rot = Math.random() * Math.PI * 2;
      $("spin").textContent = "Girar";
      $("loadMsg").textContent = `${list.length} animes cargados de ${name} (plan to watch + en espera).`;
      setResultMessage(list.length
        ? "Todavía no giraste. Tocá Girar y la ruleta elige por vos."
        : "Este usuario no tiene animes en plan to watch ni en espera.");
      updateStartedBtn(); renderHistory(); renderModes(); renderChips(); renderCount(); idleWheel();
    } catch (err) {
      $("loadMsg").textContent = "";
      $("error").textContent = errorMessage(err);
      $("error").hidden = false;
    } finally {
      setLoading(false);
    }
  }

  /* ---------- eventos ---------- */
  $("userForm").addEventListener("submit", (e) => { e.preventDefault(); loadUser($("username").value); });
  $("spin").addEventListener("click", spin);

  $("started").addEventListener("click", () => {
    if (!current) return;
    started.has(current.id) ? started.delete(current.id) : started.add(current.id);
    saveStarted();
    updateStartedBtn(); renderCount(); renderModes(); renderChips();
  });

  $("redo").addEventListener("click", () => {
    if (spinning || !current) return;
    const i = history.indexOf(current);
    if (i !== -1) history.splice(i, 1);
    renderHistory();
    spin();
  });

  $("clearHistory").addEventListener("click", () => { history = []; renderHistory(); });

  $("restore").addEventListener("click", () => {
    started.clear();
    saveStarted();
    updateStartedBtn(); renderModes(); renderChips(); renderCount(); idleWheel();
  });

  window.addEventListener("resize", draw);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);

  /* ---------- inicio ---------- */
  renderModes(); renderChips(); renderCount(); draw();
  const saved = store.get(USER_KEY);
  if (saved) {
    $("username").value = saved;
    loadUser(saved);
  }
})();
