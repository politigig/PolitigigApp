/* Politigig app: routing, home, services, election results explorer */
(function () {
  "use strict";
  const M = window.ELECTIONS;
  const YEARS = M.years;
  const LATEST = YEARS[YEARS.length - 1];
  const state = { year: LATEST, level: "state", selected: null, data: null, mode: "pres", gov: null, ok: null };
  let pendingMode = null;
  const $ = (s) => document.querySelector(s);
  const fmt = d3.format(",");
  const pct = (x) => (x * 100).toFixed(1) + "%";
  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };

  $("#yr").textContent = new Date().getFullYear();

  // ---------- helpers ----------
  const marginOf = (v) => (v && v[2] ? (v[0] - v[1]) / v[2] : null);
  function marginLabel(m) {
    if (m == null) return "No data";
    return (m >= 0 ? "D+" : "R+") + Math.abs(m * 100).toFixed(1);
  }
  const partyColor = (m) => (m >= 0 ? "var(--dem)" : "var(--rep)");
  const stateEV = (year, fips) => M.electors[year][M.states[fips][1]];
  function nationalTotals(year) {
    return Object.values(state.data[year].states).reduce((a, v) => [a[0] + v[0], a[1] + v[1], a[2] + v[2]], [0, 0, 0]);
  }
  function closestStates(year, n) {
    return Object.entries(state.data[year].states).filter(([f]) => M.states[f])
      .map(([f, v]) => ({ f, v, m: marginOf(v) }))
      .sort((a, b) => Math.abs(a.m) - Math.abs(b.m)).slice(0, n);
  }

  // ---------- theme ----------
  const themeSeg = $("#themeSeg");
  function applyTheme(t) {
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
    themeSeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", b.dataset.theme === t));
    const dark = t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.querySelector('meta[name="theme-color"]').content = dark ? "#0b1220" : "#26445e";
  }
  let theme = store.get("pg-theme") || "system";
  applyTheme(theme);
  themeSeg.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    theme = b.dataset.theme; store.set("pg-theme", theme); applyTheme(theme); onThemeChange();
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { applyTheme(theme); onThemeChange(); });

  // ---------- router ----------
  const VIEWS = ["home", "services", "results", "account"];
  const scrollMem = {};
  let current = null;
  // On desktop the app frame scrolls; on phones the window does.
  const desktopMQ = matchMedia("(min-width: 600px)");
  const scroller = () => (desktopMQ.matches ? document.getElementById("app") : document.scrollingElement);
  function route() {
    const [path, query] = (location.hash.replace(/^#\/?/, "") || "home").split("?");
    const view = VIEWS.includes(path) ? path : "home";
    if (current) scrollMem[current] = scroller().scrollTop;
    VIEWS.forEach((v) => { document.getElementById("view-" + v).hidden = v !== view; });
    document.querySelectorAll(".tabbar a").forEach((a) =>
      a.dataset.tab === view ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
    $("#appbarTitle").textContent = document.getElementById("view-" + view).dataset.title;
    // Home shows the wordmark; other tabs show the mark plus the screen title
    $("#appbarWordmark").hidden = view !== "home";
    $("#appbarTitle").hidden = view === "home";
    $("#appbarMark").style.visibility = view === "home" ? "hidden" : "visible";
    const changed = current !== view;
    current = view;
    if (view !== "results") closeSheet();
    const qMode = query && (query.match(/mode=(pres|gov|ok)/) || [])[1];
    if (view === "results" && qMode) { if (state.data) setMode(qMode); else pendingMode = qMode; }
    if (query && query.includes("focus=close")) {
      requestAnimationFrame(() => $("#closeTitle").scrollIntoView({ block: "start" }));
    } else if (changed) {
      scroller().scrollTop = scrollMem[view] || 0;
    }
    if (view === "results" && state.data) requestAnimationFrame(() => { popChart && popChart.resize(); evChart && evChart.resize(); });
  }
  window.addEventListener("hashchange", route);
  // tapping the active tab scrolls to top, like native apps
  document.querySelectorAll(".tabbar a").forEach((a) => a.addEventListener("click", (e) => {
    if (a.dataset.tab === current && location.hash.startsWith("#/" + current)) { e.preventDefault(); scroller().scrollTo({ top: 0, behavior: "smooth" }); }
  }));

  // ---------- services ----------
  const SERVICES = [
    ["Campaign staffing", "Field, finance & comms staff", "Field directors, organizers, finance and communications staff, matched to your race and ready on short notice.",
      '<circle cx="12" cy="7" r="3"/><path d="M5 21a7 7 0 0 1 14 0"/>'],
    ["Canvassing & field", "Doors, phones and texts", "Door-knocking, phone and text banks, and voter registration drives, with shift tracking built in.",
      '<path d="M3 21h18M5 21V10l7-6 7 6v11M9 21v-6h6v6"/>'],
    ["Data & targeting", "Turnout and precinct targeting", "Historical results, turnout modeling and precinct targeting so every volunteer hour goes further.",
      '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'],
    ["Digital & creative", "Ads, social and video", "Ad creative, social, video and web from freelancers who know political compliance rules.",
      '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/>'],
    ["Polling & research", "Surveys and focus groups", "Surveys, focus groups and opposition research from experienced, vetted researchers.",
      '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>']
  ];
  $("#servicesList").innerHTML = SERVICES.map(([t, s, d, icon], i) => `
    <li>
      <button type="button" class="row-btn" aria-expanded="false" aria-controls="svc${i}">
        <span class="row-icon"><svg viewBox="0 0 24 24">${icon}</svg></span>
        <span class="row-text">${t}<small>${s}</small></span><span class="chev">›</span>
      </button>
      <div class="svc-desc" id="svc${i}">${d}</div>
    </li>`).join("");
  $("#servicesList").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const li = b.parentElement, open = !li.classList.contains("open");
    li.classList.toggle("open", open); b.setAttribute("aria-expanded", open);
  });

  // ---------- install prompt ----------
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; $("#installRow").hidden = false; });
  $("#installBtn").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $("#installRow").hidden = true;
  });
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone) $("#iosInstallRow").hidden = false;

  // ---------- colors ----------
  let colorScale;
  function buildColors() {
    const dem = cssVar("--dem"), rep = cssVar("--rep"), neu = cssVar("--neutral");
    const interp = d3.interpolateRgbBasis([
      d3.color(rep).darker(0.9).formatHex(), rep, d3.interpolateLab(rep, neu)(0.62), neu,
      d3.interpolateLab(dem, neu)(0.62), dem, d3.color(dem).darker(0.9).formatHex()
    ]);
    // sqrt easing so narrow wins still read as a clear lean
    colorScale = (m) => {
      if (m == null) return cssVar("--line");
      const t = Math.sign(m) * Math.sqrt(Math.min(1, Math.abs(m) / 0.4));
      return interp((t + 1) / 2);
    };
    $("#legendBar").style.background = "linear-gradient(90deg," +
      d3.range(-1, 1.01, 0.1).map((t) => interp((t + 1) / 2)).join(",") + ")";
  }

  // ---------- controls ----------
  const yearSeg = $("#yearSeg");
  yearSeg.innerHTML = YEARS.map((y) => `<button type="button" role="radio" data-year="${y}" aria-checked="${y === state.year}">${y}</button>`).join("");
  yearSeg.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setYear(b.dataset.year); });
  $("#levelSeg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setLevel(b.dataset.level); });

  // ---------- race mode ----------
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const partyVar = (p) => (p === "D" ? "var(--dem)" : p === "R" ? "var(--rep)" : "var(--ink-3)");
  $("#modeSeg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setMode(b.dataset.mode); });
  function setMode(m) {
    state.mode = m;
    $("#view-results").dataset.mode = m;
    $("#modeSeg").querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", b.dataset.mode === m));
    closeSheet(); hideTip();
    if (m === "gov" && state.level !== "state") setLevel("state");
    resetInfo(); drawMap();
    if (m === "gov") renderGov();
    if (m === "ok") renderOK();
    if (m === "pres") requestAnimationFrame(() => { popChart && popChart.resize(); evChart && evChart.resize(); });
  }

  // Governor: signed margin, + = Democratic win, - = Republican win, null = other/pending
  function govMargin(st) {
    const r = state.gov && state.gov[st];
    if (!r || r.status === "pending" || !r.candidates.length) return null;
    const [a, b] = r.candidates;
    const m = (a.votes - (b ? b.votes : 0)) / r.total;
    return a.party === "D" ? m : a.party === "R" ? -m : null;
  }
  function govRows(r, max) {
    const cs = r.candidates.slice(0, max || 4);
    const rest = r.candidates.slice(max || 4).reduce((a, c) => a + c.votes, 0);
    const row = (label, n, c, won) => `
      <div class="bar-row" style="--c:${c}">
        <span class="label">${label}${won ? ' <span class="won">✓</span>' : ""}</span><span class="val">${pct(n / r.total)} · ${fmt(n)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(n / r.total) * 100}%"></div></div>
      </div>`;
    return cs.map((c) => row(`${esc(c.name)} (${esc(c.party || "?")})`, c.votes, partyVar(c.party), c.winner)).join("") +
      (rest > 0 ? row("Others", rest, "var(--ink-3)", false) : "");
  }
  function govStatusLabel(r) {
    return r.status === "unofficial" ? `${r.year} · Unofficial` : r.status === "certified" ? `${r.year} · Final` : `${r.year} · Pending`;
  }

  function setYear(y) {
    state.year = y;
    yearSeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", b.dataset.year === y));
    renderResults();
  }
  function setLevel(l) {
    state.level = l; state.selCounty = null;
    $("#levelSeg").querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", b.dataset.level === l));
    resetInfo(); drawMap();
  }

  // ---------- map ----------
  const svg = d3.select("#map");
  const gRoot = svg.append("g"), gUnits = gRoot.append("g"), gBorders = gRoot.append("g"), gHl = gRoot.append("g");
  const path = d3.geoPath();
  const W = 975, H = 610;
  const zoom = d3.zoom().scaleExtent([1, 14]).translateExtent([[0, 0], [W, H]])
    .on("zoom", (e) => gRoot.attr("transform", e.transform));
  svg.call(zoom).on("dblclick.zoom", null);
  $("#zoomIn").onclick = () => svg.transition().duration(300).call(zoom.scaleBy, 1.6);
  $("#zoomOut").onclick = () => svg.transition().duration(300).call(zoom.scaleBy, 1 / 1.6);
  $("#zoomReset").onclick = () => { svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity); };

  let statesGeo, countiesGeo, stateMesh;
  function unitValue(d) {
    const yr = state.data[state.year];
    if (state.level === "county") return yr.counties[d.id] || yr.states[d.id.slice(0, 2)];
    return yr.states[d.id];
  }
  function drawMap() {
    if (!statesGeo) return;
    const feats = state.level === "county" ? countiesGeo : statesGeo;
    const sel = gUnits.selectAll("path.unit").data(feats, (d) => state.level + d.id);
    sel.exit().remove();
    sel.enter().append("path")
      .attr("class", "unit" + (state.level === "county" ? " county" : ""))
      .attr("d", path)
      .on("pointermove", onHover).on("pointerleave", hideTip).on("click", onTap)
      .merge(sel)
      .attr("fill", (d) => {
        if (state.mode === "gov") {
          const r = state.gov && state.gov[M.states[d.id] ? M.states[d.id][1] : ""];
          if (r && r.status !== "pending" && r.candidates.length && !["D", "R"].includes(r.candidates[0].party)) return cssVar("--ink-3");
          return colorScale(govMargin(M.states[d.id] ? M.states[d.id][1] : ""));
        }
        return colorScale(marginOf(unitValue(d)));
      });
    gBorders.selectAll("path").data(state.level === "county" ? [stateMesh] : []).join("path").attr("class", "state-border").attr("d", path);
    svg.attr("aria-label", state.mode === "gov" ? "Map of the most recent governor race in each state" : `Map of ${state.year} presidential results by ${state.level}`);
    drawHighlight();
  }
  function drawHighlight() {
    const f = state.selected && statesGeo ? statesGeo.filter((d) => d.id === state.selected) : [];
    // in county view, also outline the tapped county
    const c = state.level === "county" && state.selCounty && countiesGeo ? countiesGeo.filter((d) => d.id === state.selCounty) : [];
    gHl.selectAll("path").data([...f, ...c], (d) => d.id).join("path")
      .attr("class", (d) => (d.id.length === 5 ? "hl hl-county" : c.length ? "hl hl-soft" : "hl")).attr("d", path);
  }

  function unitTitle(d) {
    const st = M.states[d.id.slice(0, 2)];
    const isCounty = state.level === "county" && state.data[state.year].counties[d.id];
    if (!isCounty) return st[0];
    const name = d.properties.name, suffix = st[1] === "LA" ? " Parish" : st[1] === "AK" || /city$/i.test(name) ? "" : " County";
    return `${name}${suffix}, ${st[1]}`;
  }
  function voteRows(v) {
    const race = M.races[state.year];
    return `<div class="tt-row"><span class="sw" style="--c:var(--dem)"></span>${race.dem}<span class="v">${pct(v[0] / v[2])}</span></div>
      <div class="tt-row"><span class="sw" style="--c:var(--rep)"></span>${race.rep}<span class="v">${pct(v[1] / v[2])}</span></div>`;
  }
  const tip = $("#tooltip"), wrap = $("#mapWrap");
  function onHover(evt, d) {
    if (evt.pointerType !== "mouse") return;
    const v = unitValue(d);
    if (state.mode === "gov") {
      const st = M.states[d.id.slice(0, 2)], r = state.gov && state.gov[st[1]];
      tip.innerHTML = `<div class="tt-title">${st[0]}</div>` + (r && r.status !== "pending"
        ? r.candidates.slice(0, 2).map((c) => `<div class="tt-row"><span class="sw" style="--c:${partyVar(c.party)}"></span>${esc(c.name)}<span class="v">${pct(c.votes / r.total)}</span></div>`).join("") +
          `<div class="tt-margin">Governor · ${govStatusLabel(r)}</div>`
        : `<div class="tt-margin">Governor · ${r ? r.year + " results pending" : "No race"}</div>`);
    } else
    tip.innerHTML = `<div class="tt-title">${unitTitle(d)}</div>` +
      (v ? voteRows(v) + `<div class="tt-margin">${marginLabel(marginOf(v))} · ${fmt(v[2])} votes</div>` : '<div class="tt-margin">No data</div>');
    const r = wrap.getBoundingClientRect();
    tip.hidden = false;
    let x = evt.clientX - r.left + 14, y = evt.clientY - r.top + 14;
    if (x + tip.offsetWidth > r.width) x = Math.max(4, x - tip.offsetWidth - 28);
    if (y + tip.offsetHeight > r.height) y = Math.max(4, y - tip.offsetHeight - 28);
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  function hideTip() { tip.hidden = true; }

  const mapInfo = $("#mapInfo");
  function resetInfo() { mapInfo.innerHTML = state.mode === "gov" ? "Tap a state to see its most recent governor's race. Light gray: results not posted yet. Dark gray: won by a third party." : "Tap a state to see its results. Pinch to zoom."; }
  function onTap(evt, d) {
    hideTip();
    const fips = d.id.slice(0, 2);
    state.selected = fips;
    state.selCounty = state.level === "county" && state.mode !== "gov" ? d.id : null;
    drawHighlight();
    if (state.level === "state" || state.mode === "gov") { openSheet(fips); return; }
    const v = unitValue(d);
    mapInfo.innerHTML = `<div class="mi-head"><b>${unitTitle(d)}</b><button type="button" data-open="${fips}">${M.states[fips][1]} details</button></div>` +
      (v ? voteRows(v) + `<div class="tt-margin">${marginLabel(marginOf(v))} · ${fmt(v[2])} votes</div>` : "No data");
  }
  mapInfo.addEventListener("click", (e) => { const b = e.target.closest("[data-open]"); if (b) openSheet(b.dataset.open); });

  function zoomToState(fips) {
    const f = statesGeo.find((d) => d.id === fips); if (!f) return;
    const [[x0, y0], [x1, y1]] = path.bounds(f);
    const k = Math.min(10, 0.85 / Math.max((x1 - x0) / W, (y1 - y0) / H));
    svg.transition().duration(650).call(zoom.transform,
      d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2));
  }

  // ---------- bottom sheet ----------
  const sheet = $("#sheet"), backdrop = $("#sheetBackdrop");
  let stateChart;
  function openSheet(fips) {
    state.selected = fips; drawHighlight();
    renderSheet();
    sheet.hidden = false; backdrop.hidden = false;
    requestAnimationFrame(() => { sheet.classList.add("show"); backdrop.classList.add("show"); });
    sheet.querySelector(".sheet-body").scrollTop = 0;
    $("#sheetClose").focus({ preventScroll: true });
  }
  function closeSheet() {
    if (sheet.hidden) return;
    sheet.classList.remove("show"); backdrop.classList.remove("show");
    sheet.style.transform = "";
    setTimeout(() => { sheet.hidden = true; backdrop.hidden = true; }, 300);
  }
  $("#sheetClose").onclick = closeSheet;
  backdrop.onclick = closeSheet;
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
  // drag the grab handle down to dismiss
  (function () {
    const grab = $("#sheetGrab"); let y0 = null, dy = 0;
    grab.addEventListener("pointerdown", (e) => { y0 = e.clientY; dy = 0; sheet.classList.add("dragging"); grab.setPointerCapture(e.pointerId); });
    grab.addEventListener("pointermove", (e) => {
      if (y0 == null) return; dy = Math.max(0, e.clientY - y0);
      sheet.style.transform = `translate(-50%, ${dy}px)`;
    });
    const end = () => {
      if (y0 == null) return; y0 = null; sheet.classList.remove("dragging");
      if (dy > 90) closeSheet(); else sheet.style.transform = "";
    };
    grab.addEventListener("pointerup", end); grab.addEventListener("pointercancel", end);
  })();

  function renderSheet() {
    const fips = state.selected; if (!fips) return;
    $("#sheetPres").hidden = state.mode === "gov";
    $("#sheetNote").hidden = state.mode !== "gov";
    if (state.mode === "gov") {
      const st = M.states[fips], r = state.gov && state.gov[st[1]];
      $("#stateName").textContent = st[0];
      if (!r) {
        $("#stateEyebrow").textContent = "Governor";
        $("#stateBars").innerHTML = '<p class="race-pending">No governor election data.</p>';
        $("#sheetNote").textContent = "";
        return;
      }
      $("#stateEyebrow").textContent = `Governor · ${govStatusLabel(r)}`;
      $("#stateBars").innerHTML = r.status === "pending" || !r.candidates.length
        ? `<p class="race-pending">Results for the ${r.year} governor's race have not been posted yet.</p>`
        : govRows(r, 5);
      $("#sheetNote").innerHTML = (r.status === "unofficial" ? "Unofficial results; certification is still pending. " : "") +
        (r.source ? `Source: <a href="${r.source}" rel="noopener">Wikipedia</a>` : "");
      return;
    }
    const race = M.races[state.year];
    const v = state.data[state.year].states[fips];
    $("#stateName").textContent = M.states[fips][0];
    $("#stateEyebrow").textContent = `${state.year} · ${stateEV(state.year, fips)} electoral votes`;
    const row = (label, n, c) => `
      <div class="bar-row" style="--c:${c}">
        <span class="label">${label}</span><span class="val">${pct(n / v[2])} · ${fmt(n)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(n / v[2]) * 100}%"></div></div>
      </div>`;
    const other = v[2] - v[0] - v[1];
    $("#stateBars").innerHTML = row(race.dem + " (D)", v[0], "var(--dem)") + row(race.rep + " (R)", v[1], "var(--rep)") +
      (other > 0 ? row("Other candidates", other, "var(--ink-3)") : "");

    const ms = YEARS.map((y) => { const m = marginOf(state.data[y].states[fips]); return m == null ? null : +(m * 100).toFixed(1); });
    $("#sheetYears").innerHTML = YEARS.map((y, i) =>
      `<button type="button" data-year="${y}" aria-pressed="${y === state.year}"><b>${y}</b><span style="--c:${partyColor(ms[i])}"><i></i>${marginLabel(ms[i] / 100)}</span></button>`).join("");

    const dem = cssVar("--dem"), rep = cssVar("--rep");
    if (stateChart) stateChart.destroy();
    stateChart = new Chart($("#stateChart"), {
      type: "line",
      data: { labels: YEARS, datasets: [{
        label: "Margin", data: ms, borderColor: cssVar("--ink-3"), borderWidth: 2, tension: 0.25,
        pointRadius: YEARS.map((y) => (y === state.year ? 8 : 5)), pointHoverRadius: 9,
        pointBackgroundColor: ms.map((m) => (m >= 0 ? dem : rep)), pointBorderColor: cssVar("--surface"), pointBorderWidth: 2
      }] },
      options: baseOptions({
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => " " + marginLabel(c.parsed.y / 100) } } },
        scales: { y: { ticks: { callback: (t) => (t === 0 ? "Even" : (t > 0 ? "D+" : "R+") + Math.abs(t)) },
          grid: { color: (c) => (c.tick.value === 0 ? cssVar("--ink-3") : cssVar("--line")) } } },
        onClick: (e, els) => { if (els.length) setYear(YEARS[els[0].index]); }
      })
    });
  }
  $("#sheetYears").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setYear(b.dataset.year); });

  // ---------- charts ----------
  function deepMerge(a, b) {
    for (const k in b) {
      if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && typeof b[k] !== "function") a[k] = deepMerge(a[k] || {}, b[k]);
      else a[k] = b[k];
    }
    return a;
  }
  function baseOptions(extra) {
    const ink2 = cssVar("--ink-2"), line = cssVar("--line");
    return deepMerge({
      responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "top", align: "start", labels: { color: ink2, usePointStyle: true, pointStyle: "rectRounded", boxWidth: 10, padding: 12 } },
        tooltip: { backgroundColor: cssVar("--surface"), titleColor: cssVar("--ink"), bodyColor: cssVar("--ink"), borderColor: line,
          borderWidth: 1, padding: 10, cornerRadius: 10, boxPadding: 4, usePointStyle: true }
      },
      scales: {
        x: { ticks: { color: ink2 }, grid: { display: false }, border: { color: line } },
        y: { ticks: { color: ink2 }, grid: { color: line }, border: { display: false } }
      }
    }, extra || {});
  }
  const winLine = {
    id: "winLine",
    afterDatasetsDraw(chart) {
      const y = chart.scales.y.getPixelForValue(270), { left, right } = chart.chartArea, ctx = chart.ctx;
      ctx.save(); ctx.strokeStyle = cssVar("--ink-3"); ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = cssVar("--ink-2"); ctx.font = "600 11px system-ui, sans-serif";
      ctx.textAlign = "right"; ctx.fillText("270 to win", right, y - 5); ctx.restore();
    }
  };

  let popChart, evChart;
  function renderCharts() {
    const dem = cssVar("--dem"), rep = cssVar("--rep"), surf = cssVar("--surface");
    const share = (y, i) => { const t = nationalTotals(y); return +((t[i] / t[2]) * 100).toFixed(2); };
    const rad = YEARS.map((y) => (y === state.year ? 7 : 4));
    const ds = (label, i, c) => ({ label, data: YEARS.map((y) => share(y, i)), borderColor: c, backgroundColor: c, borderWidth: 2,
      pointRadius: rad, pointHoverRadius: 8, pointBorderColor: surf, pointBorderWidth: 2, tension: 0.25 });
    if (popChart) popChart.destroy();
    popChart = new Chart($("#popChart"), {
      type: "line",
      data: { labels: YEARS, datasets: [ds("Democrat", 0, dem), ds("Republican", 1, rep)] },
      options: baseOptions({
        scales: { y: { suggestedMin: 44, suggestedMax: 54, ticks: { callback: (t) => t + "%" } } },
        plugins: { tooltip: { callbacks: {
          title: (c) => c[0].label + ": " + M.races[c[0].label].dem + " vs " + M.races[c[0].label].rep,
          label: (c) => ` ${c.dataset.label}: ${c.parsed.y.toFixed(1)}%` } } },
        onClick: (e, els) => { if (els.length) setYear(YEARS[els[0].index]); }
      })
    });
    const bar = (label, k, c) => ({ label, data: YEARS.map((y) => M.races[y].ev[k]),
      backgroundColor: YEARS.map((y) => (y === state.year ? c : d3.color(c).copy({ opacity: 0.5 }).formatRgb())),
      borderRadius: 4, borderSkipped: "start", categoryPercentage: 0.7, barPercentage: 0.9 });
    if (evChart) evChart.destroy();
    evChart = new Chart($("#evChart"), {
      type: "bar",
      data: { labels: YEARS, datasets: [bar("Democrat", "dem", dem), bar("Republican", "rep", rep)] },
      options: baseOptions({
        scales: { y: { min: 0, max: 400, ticks: { stepSize: 100 } } },
        plugins: { tooltip: { callbacks: {
          label: (c) => ` ${c.datasetIndex ? M.races[c.label].rep : M.races[c.label].dem}: ${c.parsed.y}`,
          footer: (c) => M.races[c[0].label].note || "" } } },
        onClick: (e, els) => { if (els.length) setYear(YEARS[els[0].index]); }
      }),
      plugins: [winLine]
    });
  }

  // ---------- summary, lists, table ----------
  function renderSummary() {
    const race = M.races[state.year], tot = nationalTotals(state.year), demWon = race.ev.dem > race.ev.rep;
    const card = (party, name, ev, votes, won, c) => `
      <div class="cand" style="--c:${c}">
        <div class="party"><span>${party}</span>${won ? '<span class="badge">✓ Won</span>' : ""}</div>
        <div class="name">${name}</div>
        <div class="ev">${ev}</div><div class="ev-label">electoral votes</div>
        <div class="pv">${pct(votes / tot[2])} of vote</div>
      </div>`;
    $("#summary").innerHTML = card("Democrat", race.dem, race.ev.dem, tot[0], demWon, "var(--dem)") +
      card("Republican", race.rep, race.ev.rep, tot[1], !demWon, "var(--rep)");
  }
  function renderLists() {
    $("#closeTitle").textContent = `Closest states in ${state.year}`;
    $("#closeList").innerHTML = closestStates(state.year, 8).map((r) =>
      `<li><button type="button" data-f="${r.f}"><span class="sw" style="--c:${partyColor(r.m)}"></span>${M.states[r.f][0]}
        <span class="m">${marginLabel(r.m)}</span><span class="chev">›</span></button></li>`).join("");
    const rows = Object.entries(state.data[state.year].states).filter(([f]) => M.states[f])
      .sort((a, b) => M.states[a[0]][0].localeCompare(M.states[b[0]][0]));
    $("#stateTable tbody").innerHTML = rows.map(([f, v]) =>
      `<tr data-f="${f}"><td>${M.states[f][0]}</td><td class="num">${pct(v[0] / v[2])}</td>
        <td class="num">${pct(v[1] / v[2])}</td><td class="num">${marginLabel(marginOf(v))}</td></tr>`).join("");
  }
  $("#closeList").addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (b) { zoomToState(b.dataset.f); openSheet(b.dataset.f); } });
  $("#stateTable").addEventListener("click", (e) => { const r = e.target.closest("[data-f]"); if (r) { zoomToState(r.dataset.f); openSheet(r.dataset.f); } });

  // ---------- home ----------
  function renderHome() {
    const y = LATEST, race = M.races[y], tot = nationalTotals(y), ev = race.ev;
    const total = ev.dem + ev.rep;
    $("#homeLatest").innerHTML = `
      <div class="latest-top"><strong>${y} Presidential</strong><span>View map ›</span></div>
      <div class="evbar"><div style="--c:var(--dem);width:${(ev.dem / total) * 100}%"></div><div style="--c:var(--rep);flex:1"></div><span class="mid"></span></div>
      <div class="ev270">270 to win</div>
      <div class="evlabels">
        <div><b>${ev.dem}</b>${race.dem}<br><small>${pct(tot[0] / tot[2])} of vote</small></div>
        <div class="r"><b>${ev.rep}</b>${race.rep}<br><small>${pct(tot[1] / tot[2])} of vote</small></div>
      </div>`;
    $("#homeChips").innerHTML = closestStates(y, 8).map((r) =>
      `<button type="button" class="chip" data-f="${r.f}"><div class="abbr"><i style="--c:${partyColor(r.m)}"></i>${M.states[r.f][1]}</div>
        <div class="nm">${M.states[r.f][0]}</div><div class="m">${marginLabel(r.m)}</div></button>`).join("");
  }
  $("#homeChips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-f]"); if (!b) return;
    if (state.year !== LATEST) setYear(LATEST);
    location.hash = "#/results";
    zoomToState(b.dataset.f); openSheet(b.dataset.f);
  });

  // ---------- governor panel ----------
  function renderGov() {
    const g = state.gov;
    if (!g) { $("#govSummary").innerHTML = '<p class="race-pending">Governor data could not be loaded.</p>'; $("#govPanel").innerHTML = ""; return; }
    const rows = Object.entries(g).map(([ab, r]) => ({ ab, r, name: Object.values(M.states).find((s) => s[1] === ab)[0],
      fips: Object.keys(M.states).find((f) => M.states[f][1] === ab), m: govMargin(ab) }));
    const done = rows.filter((x) => x.r.status !== "pending" && x.r.candidates.length);
    const by = (p) => done.filter((x) => x.r.candidates[0].party === p).length;
    const other = done.length - by("D") - by("R");
    const pending = rows.length - done.length;
    const n26 = rows.filter((x) => x.r.year === 2026), r26 = n26.filter((x) => x.r.status !== "pending" && x.r.candidates.length);
    $("#govSummary").innerHTML = `
      <div class="gov-counts">
        <div class="cand" style="--c:var(--dem)"><div class="party"><span>Democrat</span></div><div class="ev">${by("D")}</div><div class="ev-label">governor races won</div></div>
        <div class="cand" style="--c:var(--rep)"><div class="party"><span>Republican</span></div><div class="ev">${by("R")}</div><div class="ev-label">governor races won</div></div>
      </div>
      <div class="status-banner"><div>Each state's <b>most recent</b> governor's race. ${r26.length} of ${n26.length} races from Nov 3, 2026 have results posted (unofficial).
        ${other ? ` ${other} won by another party.` : ""}${pending ? ` ${pending} pending.` : ""}</div></div>`;

    const close = r26.slice().sort((a, b) => Math.abs(a.m ?? 1) - Math.abs(b.m ?? 1)).slice(0, 8);
    const sorted = rows.slice().sort((a, b) => a.name.localeCompare(b.name));
    $("#govPanel").innerHTML = `
      <h3 class="group-title">Closest 2026 governor races</h3>
      <ul class="list close-list">${close.map((x) => `<li><button type="button" data-f="${x.fips}">
        <span class="sw" style="--c:${partyVar(x.r.candidates[0].party)}"></span>${x.name}
        <span class="m">${x.m == null ? esc(x.r.candidates[0].party) + " win" : marginLabel(x.m)}</span><span class="chev">›</span></button></li>`).join("") ||
        '<li class="race-pending" style="padding:14px">No 2026 results posted yet.</li>'}</ul>
      <h3 class="group-title">All states</h3>
      <div class="card table-card"><table>
        <thead><tr><th>State</th><th>Year</th><th>Winner</th><th class="num">Margin</th></tr></thead>
        <tbody>${sorted.map((x) => {
          const ok = x.r.status !== "pending" && x.r.candidates.length, w = ok ? x.r.candidates[0] : null;
          const mg = ok ? (x.r.candidates[1] ? (x.r.candidates[0].votes - x.r.candidates[1].votes) / x.r.total : 1) : null;
          return `<tr data-f="${x.fips}"><td>${x.name}</td><td>${x.r.year}</td>
            <td>${w ? `<span class="pd" style="--c:${partyVar(w.party)}"></span>${esc(w.name)}` : '<span class="race-pending">Pending</span>'}</td>
            <td class="num">${mg == null ? "—" : esc(w.party) + "+" + (mg * 100).toFixed(1)}</td></tr>`; }).join("")}</tbody>
      </table></div>
      <p class="fineprint">Governor results compiled from Wikipedia, which cites state election offices. 2026 results are unofficial until each state certifies them.</p>`;
  }
  $("#govPanel").addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (b) { zoomToState(b.dataset.f); openSheet(b.dataset.f); } });

  // ---------- Oklahoma 2026 panel ----------
  const OK_OFFICIAL = "https://results.okelections.gov/OKER/?elecDate=20261103";
  function raceCard(r) {
    const title = r.office + (r.district && !/District/.test(r.office) ? ` District ${r.district}` : "");
    const head = `<div class="race-head"><div><h4>${esc(title)}</h4>${r.subtitle ? `<div class="sub">${esc(r.subtitle)}</div>` : ""}</div>`;
    if (r.status === "measure") {
      const t = r.yes + r.no;
      const row = (label, n, c) => `<div class="bar-row" style="--c:${c}"><span class="label">${label}</span><span class="val">${pct(n / t)} · ${fmt(n)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(n / t) * 100}%"></div></div></div>`;
      return `<div class="race-card">${head}<span class="pill">${esc(r.outcome)}</span></div>
        ${row("Yes", r.yes, "var(--accent)")}${row("No", r.no, "var(--ink-3)")}
        ${r.source && /^http/.test(r.source) ? `<a class="race-src" href="${r.source}" rel="noopener">Source</a>` : ""}</div>`;
    }
    if (r.status === "outcome")
      return `<div class="race-card">${head}<span class="pill">${esc(r.outcome)}</span></div>
        <p class="race-pending">${r.note ? esc(r.note) : `Vote totals not yet available. <a href="${OK_OFFICIAL}" rel="noopener">Official results</a>`}</p></div>`;
    if (r.status !== "reported" || !r.candidates.length)
      return `<div class="race-card">${head}<span class="pill">Pending</span></div>
        <p class="race-pending">General election results have not been posted to our source yet. <a href="${OK_OFFICIAL}" rel="noopener">Official results</a></p></div>`;
    const w = r.candidates[0], m = r.candidates[1] ? (w.votes - r.candidates[1].votes) / r.total : 1;
    return `<div class="race-card">${head}<span class="pill">${esc(w.party)}+${(m * 100).toFixed(1)}</span></div>
      ${govRows(r, 4)}${r.source && /^http/.test(r.source) ? `<a class="race-src" href="${r.source}" rel="noopener">Source</a>` : r.source ? `<span class="race-src">Source: ${esc(r.source)}</span>` : ""}</div>`;
  }
  function chamberCard(ch) {
    const ds = ch.districts || [];
    const won = (p) => ds.filter((d) => (d.candidates.find((c) => c.winner) || {}).party === p).length;
    const R = won("R"), D = won("D"), O = ds.length - R - D;
    const line = (d) => {
      const w = d.candidates.find((c) => c.winner), opp = d.candidates.filter((c) => !c.winner);
      const tag = d.note || (d.unopposed ? "Unopposed" : opp.length ? "def. " + opp.map((c) => `${esc(c.name)} (${c.party})`).join(", ") : "");
      return `<li><span class="dn">${d.district}</span><div>${w ? `<span class="w"><span class="pd" style="--c:${partyVar(w.party)}"></span>${esc(w.name)} (${w.party})</span>` : "Undecided"}
        <div class="o">${tag}</div></div></li>`;
    };
    return `<div class="race-card"><div class="race-head"><h4>${esc(ch.chamber)}</h4><span class="pill">${ds.length} seats up</span></div>
      <div class="seat-tally"><div style="--c:var(--rep);flex:${R}"></div><div style="--c:var(--dem);flex:${D}"></div>${O ? `<div style="--c:var(--ink-3);flex:${O}"></div>` : ""}</div>
      <div class="seat-legend"><span><i style="--c:var(--rep)"></i>Republican ${R}</span><span><i style="--c:var(--dem)"></i>Democrat ${D}</span>${O ? `<span><i style="--c:var(--ink-3)"></i>Other/undecided ${O}</span>` : ""}</div>
      <details class="districts"><summary>All ${ds.length} districts</summary><ul class="district-list">${ds.map(line).join("")}</ul></details>
      ${ch.source ? `<a class="race-src" href="${ch.source}" rel="noopener">Source</a>` : ""}</div>`;
  }
  let okTab = "now", okRace = null, okCounty = null;
  function renderOK() {
    const el = $("#okPanel");
    el.innerHTML = `<div class="seg seg-full" id="okTabSeg" role="radiogroup" aria-label="Oklahoma view">
        <button type="button" role="radio" data-t="now" aria-checked="${okTab === "now"}">Nov 3, 2026</button>
        <button type="button" role="radio" data-t="past" aria-checked="${okTab === "past"}">Past elections</button>
        <button type="button" role="radio" data-t="local" aria-checked="${okTab === "local"}">Local</button>
      </div><div id="okBody"></div>`;
    if (okTab === "past") renderOKPast(); else if (okTab === "local") renderOKLocal(); else renderOKNow();
  }
  $("#okPanel").addEventListener("click", (e) => {
    const t = e.target.closest("#okTabSeg button");
    if (t) { okTab = t.dataset.t; renderOK(); return; }
    const r = e.target.closest("[data-race]");
    if (r) { okRace = r.dataset.race; okCounty = null; renderOKPast(); return; }
    const c = e.target.closest("[data-county]");
    if (c) { okCounty = c.dataset.county; drawOKMap(); renderOKCountyInfo(); $("#okMapCard").scrollIntoView({ block: "start", behavior: "smooth" }); }
  });

  // ---------- Oklahoma past elections: county map ----------
  function renderOKPast() {
    const H = state.okHist, el = $("#okBody");
    if (!H) { el.innerHTML = '<p class="race-pending">Past Oklahoma results could not be loaded.</p>'; return; }
    const race = H.races.find((r) => r.id === okRace) || H.races[0];
    okRace = race.id;
    const st = race.state;
    const won = (p) => Object.values(race.counties).filter((v) => (p === "D" ? v[0] > v[1] : v[1] > v[0])).length;
    const demWon = st[0] > st[1];
    el.innerHTML = `
      <div class="chips ok-chips">${H.races.map((r) => `<button type="button" class="chip race-chip" data-race="${r.id}" aria-pressed="${r.id === race.id}">
        <div class="abbr">${r.year}</div><div class="nm">${esc(r.office)}</div></button>`).join("")}</div>
      <div class="summary">
        ${[["Democrat", race.dem, st[0], "var(--dem)", demWon, won("D")], ["Republican", race.rep, st[1], "var(--rep)", !demWon, won("R")]].map(([p, n, v, c, w, cw]) => `
        <div class="cand" style="--c:${c}">
          <div class="party"><span>${p}</span>${w ? '<span class="badge">✓ Won</span>' : ""}</div>
          <div class="name">${esc(n)}</div>
          <div class="ev">${pct(v / st[2])}</div><div class="ev-label">${fmt(v)} votes</div>
          <div class="pv">${cw} of 77 counties</div>
        </div>`).join("")}
      </div>
      <div class="card map-card" id="okMapCard">
        <h3 class="card-title" style="padding:0 6px">${race.year} ${esc(race.office)} by county</h3>
        <svg id="okMap" role="img" aria-label="Oklahoma ${race.year} ${esc(race.office)} results by county"></svg>
        <div class="map-info" id="okInfo"></div>
        <div class="legend" aria-hidden="true"><span>R+40</span><div class="legend-bar" style="background:${$("#legendBar").style.background}"></div><span>D+40</span></div>
      </div>
      <h3 class="group-title">All 77 counties</h3>
      <div class="card table-card"><table>
        <thead><tr><th>County</th><th class="num">Dem</th><th class="num">Rep</th><th class="num">Margin</th></tr></thead>
        <tbody>${okCountyRows(race).map((c) => `<tr data-county="${c.f}"><td>${esc(c.name)}</td>
          <td class="num">${fmt(c.v[0])}</td><td class="num">${fmt(c.v[1])}</td><td class="num">${marginLabel(marginOf(c.v))}</td></tr>`).join("")}</tbody>
      </table></div>
      <p class="fineprint">Source: ${esc(race.source)}.</p>
      ${okYearRaces(race.year)}`;
    drawOKMap(); renderOKCountyInfo();
    const chip = el.querySelector('.race-chip[aria-pressed="true"]');
    if (chip) chip.scrollIntoView({ block: "nearest", inline: "center" });
  }
  function okYearRaces(year) {
    const Y = state.okYears && state.okYears.years.find((y) => y.year === year);
    if (!Y || !Y.groups.length) return "";
    return `<h2 class="year-head">All ${year} results</h2>
      ${Y.groups.map((g) => `<h3 class="group-title">${esc(g.name)}</h3>${g.races.map(raceCard).join("")}`).join("")}
      <p class="fineprint">Compiled from Wikipedia, which cites the Oklahoma State Election Board. Presidential totals from the MIT Election Data and Science Lab.</p>`;
  }
  // ---------- Oklahoma local (municipal) elections ----------
  let okCity = null;
  function localCard(e) {
    const rounds = e.rounds.map((r) => {
      const rows = r.candidates.slice(0, 6).map((c) => {
        const won = e.winner && c.name === e.winner && r === e.rounds[e.rounds.length - 1];
        const color = e.partisan ? partyVar(c.party) : won ? "var(--accent)" : "var(--ink-3)";
        return `<div class="bar-row" style="--c:${color}">
          <span class="label">${esc(c.name)}${e.partisan && c.party ? ` (${esc(c.party)})` : ""}${won ? ' <span class="won">✓</span>' : ""}</span><span class="val">${pct(c.votes / r.total)} · ${fmt(c.votes)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${(c.votes / r.total) * 100}%"></div></div></div>`;
      }).join("");
      const rest = r.candidates.slice(6).reduce((a, c) => a + c.votes, 0);
      return `${e.rounds.length > 1 ? `<div class="round-label">${esc(r.label)}</div>` : ""}${rows}${rest ? `<div class="race-pending">+ ${fmt(rest)} votes for ${r.candidates.length - 6} others</div>` : ""}`;
    }).join("");
    return `<div class="race-card"><div class="race-head"><div><h4>${e.year} ${esc(e.office)}</h4>
        ${e.winner ? `<div class="sub">Winner: ${esc(e.winner)}</div>` : ""}</div><span class="pill">${e.partisan ? "Partisan" : "Nonpartisan"}</span></div>
      ${rounds}<a class="race-src" href="${e.source}" rel="noopener">Source</a></div>`;
  }
  function renderOKLocal() {
    const L = state.okLocal, el = $("#okBody");
    if (!L || !L.cities.length) { el.innerHTML = '<p class="race-pending">Local results could not be loaded.</p>'; return; }
    const city = L.cities.find((c) => c.city === okCity) || L.cities[0]; okCity = city.city;
    el.innerHTML = `
      <div class="seg seg-full" id="okCitySeg" role="radiogroup" aria-label="City">${L.cities.map((c) =>
        `<button type="button" role="radio" data-city="${esc(c.city)}" aria-checked="${c.city === city.city}">${esc(c.city)}</button>`).join("")}</div>
      <div class="status-banner"><div>Oklahoma City and Tulsa elect their mayors and councils in <b>nonpartisan</b> races; older races marked "Partisan" used party primaries. A candidate with a majority in the first round wins outright; otherwise the top two meet in a runoff or general election.</div></div>
      ${city.elections.map(localCard).join("")}
      <p class="fineprint">Compiled from Wikipedia, which cites the Oklahoma, Tulsa and Oklahoma County election boards. Local races Wikipedia doesn't cover (other cities, county offices, school boards) aren't included yet.</p>`;
  }
  $("#okPanel").addEventListener("click", (e) => {
    const b = e.target.closest("#okCitySeg button"); if (b) { okCity = b.dataset.city; renderOKLocal(); }
  });

  function okFeatures() { return countiesGeo ? countiesGeo.filter((d) => d.id.startsWith("40")) : []; }
  function okCountyRows(race) {
    const names = Object.fromEntries(okFeatures().map((d) => [d.id, d.properties.name]));
    return Object.entries(race.counties).map(([f, v]) => ({ f, v, name: names[f] || f }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  function drawOKMap() {
    const race = state.okHist && state.okHist.races.find((r) => r.id === okRace);
    const feats = okFeatures(), svgEl = document.getElementById("okMap");
    if (!race || !feats.length || !svgEl) return;
    const b = path.bounds({ type: "FeatureCollection", features: feats });
    const pad = 4;
    const o = d3.select(svgEl).attr("viewBox", [b[0][0] - pad, b[0][1] - pad, b[1][0] - b[0][0] + pad * 2, b[1][1] - b[0][1] + pad * 2].join(" "));
    o.selectAll("path.okc").data(feats, (d) => d.id).join((en) => en.append("path").attr("class", "okc").attr("d", path)
        .on("click", (e, d) => { okCounty = d.id; drawOKMap(); renderOKCountyInfo(); })
        .on("pointermove", (e, d) => { if (e.pointerType === "mouse") { okCounty = d.id; drawOKMap(); renderOKCountyInfo(); } }))
      .attr("fill", (d) => colorScale(marginOf(race.counties[d.id])))
      .classed("sel", (d) => d.id === okCounty);
    o.selectAll("path.okc.sel").raise();
  }
  function renderOKCountyInfo() {
    const race = state.okHist && state.okHist.races.find((r) => r.id === okRace), box = $("#okInfo");
    if (!race || !box) return;
    const v = okCounty && race.counties[okCounty];
    if (!v) { box.innerHTML = "Tap a county to see how it voted."; return; }
    const name = (okFeatures().find((d) => d.id === okCounty) || { properties: { name: okCounty } }).properties.name;
    box.innerHTML = `<div class="mi-head"><b>${esc(name)} County</b><span>${marginLabel(marginOf(v))}</span></div>
      <div class="tt-row"><span class="sw" style="--c:var(--dem)"></span>${esc(race.dem)} (D)<span class="v">${fmt(v[0])} · ${pct(v[0] / v[2])}</span></div>
      <div class="tt-row"><span class="sw" style="--c:var(--rep)"></span>${esc(race.rep)} (R)<span class="v">${fmt(v[1])} · ${pct(v[1] / v[2])}</span></div>
      <div class="tt-margin">${fmt(v[2])} total votes${v[2] - v[0] - v[1] > 0 ? ` · ${fmt(v[2] - v[0] - v[1])} for others` : ""}</div>`;
  }

  function renderOKNow() {
    const ok = state.ok, el = $("#okBody");
    if (!ok) { el.innerHTML = '<p class="race-pending">Oklahoma results could not be loaded.</p>'; return; }
    el.innerHTML = `
      <div class="status-banner"><div><b>November 3, 2026 general election.</b> ${esc(ok.statusNote)}
        <a href="${OK_OFFICIAL}" rel="noopener">Official results</a></div></div>
      ${ok.groups.map((g) => `<h3 class="group-title">${esc(g.name)}</h3>${g.races.map(raceCard).join("")}`).join("")}
      <h3 class="group-title">State legislature</h3>
      ${(ok.legislature || []).map(chamberCard).join("")}
      ${ok.judicialRetention && ok.judicialRetention.summary ? `<h3 class="group-title">Judicial retention</h3>
        <div class="race-card"><p class="race-pending" style="color:var(--ink-2)">${esc(ok.judicialRetention.summary)}</p>
        <a class="race-src" href="${ok.judicialRetention.source}" rel="noopener">Source</a></div>` : ""}
      <p class="fineprint">Compiled from Wikipedia, which cites the Oklahoma State Election Board's unofficial results. Legislative results show winners only.</p>`;
  }

  function renderResults() {
    hideTip(); drawMap(); renderSummary(); renderCharts(); renderLists();
    if (!sheet.hidden && state.selected) renderSheet();
  }
  function onThemeChange() {
    buildColors();
    if (state.data) renderResults();
    if (state.mode === "gov") renderGov();
    if (state.mode === "ok") renderOK();
  }

  // ---------- load ----------
  route();
  buildColors();
  const optional = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  Promise.all([fetch("data/results.json").then((r) => r.json()), fetch("data/counties-albers-10m.json").then((r) => r.json()),
    optional("data/governors.json"), optional("data/oklahoma-2026.json"), optional("data/oklahoma-history.json"), optional("data/oklahoma-years.json"), optional("data/oklahoma-local.json")])
    .then(([data, us, gov, ok, okHist, okYears, okLocal]) => {
      state.okLocal = okLocal;
      state.data = data; state.gov = gov; state.ok = ok; state.okHist = okHist; state.okYears = okYears;
      statesGeo = topojson.feature(us, us.objects.states).features;
      countiesGeo = topojson.feature(us, us.objects.counties).features;
      stateMesh = topojson.mesh(us, us.objects.states, (a, b) => a !== b);
      renderHome(); renderResults();
      if (pendingMode) { setMode(pendingMode); pendingMode = null; }
    })
    .catch((err) => {
      console.error(err);
      $("#homeLatest").innerHTML = '<div class="skeleton">Election data could not be loaded. Check your connection.</div>';
    });

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
