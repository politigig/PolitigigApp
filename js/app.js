/* Politigig app: routing, home, services, election results explorer */
(function () {
  "use strict";
  const M = window.ELECTIONS;
  const YEARS = M.years;
  const LATEST = YEARS[YEARS.length - 1];
  const state = { year: LATEST, level: "state", selected: null, data: null };
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
      '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>'],
    ["Compliance & finance", "Treasurers, filings and payroll", "Treasurers, FEC and state filings, and payroll for every gig, all handled in one place.",
      '<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>']
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
      if (m == null) return cssVar("--surface-2");
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

  function setYear(y) {
    state.year = y;
    yearSeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", b.dataset.year === y));
    renderResults();
  }
  function setLevel(l) {
    state.level = l;
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
      .attr("fill", (d) => colorScale(marginOf(unitValue(d))));
    gBorders.selectAll("path").data(state.level === "county" ? [stateMesh] : []).join("path").attr("class", "state-border").attr("d", path);
    svg.attr("aria-label", `Map of ${state.year} presidential results by ${state.level}`);
    drawHighlight();
  }
  function drawHighlight() {
    const f = state.selected && statesGeo ? statesGeo.filter((d) => d.id === state.selected) : [];
    gHl.selectAll("path").data(f).join("path").attr("class", "hl").attr("d", path);
  }

  function unitTitle(d) {
    const st = M.states[d.id.slice(0, 2)];
    const isCounty = state.level === "county" && state.data[state.year].counties[d.id];
    return isCounty ? `${d.properties.name}, ${st[1]}` : st[0];
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
  function resetInfo() { mapInfo.innerHTML = "Tap a state to see its results. Pinch to zoom."; }
  function onTap(evt, d) {
    hideTip();
    const fips = d.id.slice(0, 2);
    state.selected = fips; drawHighlight();
    if (state.level === "state") { openSheet(fips); return; }
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

  function renderResults() {
    hideTip(); drawMap(); renderSummary(); renderCharts(); renderLists();
    if (!sheet.hidden && state.selected) renderSheet();
  }
  function onThemeChange() {
    buildColors();
    if (state.data) renderResults();
  }

  // ---------- load ----------
  route();
  buildColors();
  Promise.all([fetch("data/results.json").then((r) => r.json()), fetch("data/counties-albers-10m.json").then((r) => r.json())])
    .then(([data, us]) => {
      state.data = data;
      statesGeo = topojson.feature(us, us.objects.states).features;
      countiesGeo = topojson.feature(us, us.objects.counties).features;
      stateMesh = topojson.mesh(us, us.objects.states, (a, b) => a !== b);
      renderHome(); renderResults();
    })
    .catch((err) => {
      console.error(err);
      $("#homeLatest").innerHTML = '<div class="skeleton">Election data could not be loaded. Check your connection.</div>';
    });

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
