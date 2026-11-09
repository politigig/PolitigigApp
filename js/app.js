/* Politigig — election results explorer */
(function () {
  "use strict";
  const M = window.ELECTIONS;
  const YEARS = M.years;
  const state = { year: "2024", level: "state", selected: null, data: null, topo: null };
  const $ = (s) => document.querySelector(s);
  const fmt = d3.format(",");
  const pct = (x) => (x * 100).toFixed(1) + "%";
  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  document.getElementById("yr").textContent = new Date().getFullYear();

  // ---------- helpers ----------
  function marginOf(v) { return v && v[2] ? (v[0] - v[1]) / v[2] : null; }
  function marginLabel(m) {
    if (m == null) return "No data";
    const p = Math.abs(m * 100).toFixed(1);
    return (m >= 0 ? "D +" : "R +") + p;
  }
  function stateEV(year, fips) { return M.electors[year][M.states[fips][1]]; }

  let colorScale;
  function buildColors() {
    const dem = cssVar("--dem"), rep = cssVar("--rep"), neu = cssVar("--neutral");
    const stops = [
      d3.color(rep).darker(0.9).formatHex(), rep, d3.interpolateLab(rep, neu)(0.62), neu,
      d3.interpolateLab(dem, neu)(0.62), dem, d3.color(dem).darker(0.9).formatHex()
    ];
    const interp = d3.interpolateRgbBasis(stops);
    // sqrt easing so narrow wins still read as a clear lean
    colorScale = (m) => {
      if (m == null) return cssVar("--surface-2");
      const t = Math.sign(m) * Math.sqrt(Math.min(1, Math.abs(m) / 0.4));
      return interp((t + 1) / 2);
    };
    $("#legendBar").style.background = "linear-gradient(90deg," + d3.range(0, 1.01, 0.1).map(interp).join(",") + ")";
  }

  // ---------- controls ----------
  const yearSeg = $("#yearSeg");
  YEARS.forEach((y) => {
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("role", "radio"); b.dataset.year = y; b.textContent = y;
    b.setAttribute("aria-checked", y === state.year);
    b.addEventListener("click", () => setYear(y));
    yearSeg.appendChild(b);
  });
  document.querySelectorAll("#levelSeg button").forEach((b) =>
    b.addEventListener("click", () => setLevel(b.dataset.level)));

  function setYear(y) {
    state.year = y;
    yearSeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", b.dataset.year === y));
    renderAll();
  }
  function setLevel(l) {
    state.level = l;
    document.querySelectorAll("#levelSeg button").forEach((b) => b.setAttribute("aria-checked", b.dataset.level === l));
    drawMap();
  }

  // ---------- map ----------
  const svg = d3.select("#map");
  const gRoot = svg.append("g");
  const gUnits = gRoot.append("g");
  const gBorders = gRoot.append("g");
  const gHl = gRoot.append("g");
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
    if (state.level === "county") {
      const v = yr.counties[d.id];
      return v || yr.states[d.id.slice(0, 2)]; // fall back to state (Alaska, renamed counties)
    }
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
      .on("pointermove", onHover)
      .on("pointerleave", hideTip)
      .on("click", onTap)
      .merge(sel)
      .attr("fill", (d) => colorScale(marginOf(unitValue(d))));

    gBorders.selectAll("path").data(state.level === "county" ? [stateMesh] : [])
      .join("path").attr("class", "state-border").attr("d", path);
    svg.attr("aria-label", `Map of ${state.year} presidential results by ${state.level}`);
    drawHighlight();
  }

  function drawHighlight() {
    const f = state.selected ? statesGeo.filter((d) => d.id === state.selected) : [];
    gHl.selectAll("path").data(f).join("path").attr("class", "hl").attr("d", path);
  }

  const tip = $("#tooltip"), wrap = $("#mapWrap");
  function tipHTML(d) {
    const race = M.races[state.year];
    const v = unitValue(d);
    const isCounty = state.level === "county" && state.data[state.year].counties[d.id];
    const stName = M.states[d.id.slice(0, 2)] ? M.states[d.id.slice(0, 2)][0] : "";
    const title = isCounty ? `${d.properties.name}, ${M.states[d.id.slice(0, 2)][1]}` : stName;
    if (!v) return `<div class="tt-title">${title}</div><div class="tt-margin">No data</div>`;
    return `<div class="tt-title">${title}</div>
      <div class="tt-row"><span class="sw" style="--c:var(--dem)"></span>${race.dem}<span class="v">${pct(v[0] / v[2])}</span></div>
      <div class="tt-row"><span class="sw" style="--c:var(--rep)"></span>${race.rep}<span class="v">${pct(v[1] / v[2])}</span></div>
      <div class="tt-margin">${marginLabel(marginOf(v))} · ${fmt(v[2])} votes</div>`;
  }
  function placeTip(evt) {
    const r = wrap.getBoundingClientRect();
    let x = evt.clientX - r.left + 14, y = evt.clientY - r.top + 14;
    tip.hidden = false;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    if (x + tw > r.width) x = Math.max(4, evt.clientX - r.left - tw - 14);
    if (y + th > r.height) y = Math.max(4, evt.clientY - r.top - th - 14);
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  function onHover(evt, d) {
    if (evt.pointerType !== "mouse") return;
    tip.innerHTML = tipHTML(d); placeTip(evt);
  }
  function hideTip() { tip.hidden = true; }
  function onTap(evt, d) {
    tip.innerHTML = tipHTML(d); placeTip(evt);
    selectState(d.id.slice(0, 2), { zoom: false });
  }
  svg.on("click.bg", (e) => { if (e.target === svg.node()) hideTip(); });

  function zoomToState(fips) {
    const f = statesGeo.find((d) => d.id === fips);
    if (!f) return;
    const [[x0, y0], [x1, y1]] = path.bounds(f);
    const k = Math.min(10, 0.85 / Math.max((x1 - x0) / W, (y1 - y0) / H));
    svg.transition().duration(650).call(zoom.transform,
      d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2));
  }

  // ---------- summary ----------
  function renderSummary() {
    const race = M.races[state.year];
    const st = Object.values(state.data[state.year].states);
    const tot = st.reduce((a, v) => [a[0] + v[0], a[1] + v[1], a[2] + v[2]], [0, 0, 0]);
    const demWon = race.ev.dem > race.ev.rep;
    const card = (party, name, ev, votes, won, c) => `
      <div class="cand" style="--c:${c}">
        <div class="party">${party}</div>
        <div class="name">${name}${won ? '<span class="badge">Winner</span>' : ""}</div>
        <div class="ev">${ev}</div><div class="ev-label">electoral votes</div>
        <div class="pv">${pct(votes / tot[2])} · ${fmt(votes)}</div>
      </div>`;
    $("#summary").innerHTML =
      card("Democrat", race.dem, race.ev.dem, tot[0], demWon, "var(--dem)") +
      card("Republican", race.rep, race.ev.rep, tot[1], !demWon, "var(--rep)");
  }

  // ---------- state panel ----------
  let stateChart;
  function selectState(fips, opts = {}) {
    state.selected = fips;
    drawHighlight();
    renderStatePanel();
    if (opts.zoom) zoomToState(fips);
    if (opts.scroll) document.getElementById("mapWrap").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  $("#stateClose").onclick = () => {
    state.selected = null; drawHighlight(); $("#statePanel").hidden = true; hideTip();
  };

  function renderStatePanel() {
    const fips = state.selected;
    const panel = $("#statePanel");
    if (!fips) { panel.hidden = true; return; }
    const race = M.races[state.year];
    const v = state.data[state.year].states[fips];
    panel.hidden = false;
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
    const dem = cssVar("--dem"), rep = cssVar("--rep");
    const cfg = {
      type: "line",
      data: { labels: YEARS, datasets: [{
        label: "Margin", data: ms, borderColor: cssVar("--ink-3"), borderWidth: 2, tension: 0.25,
        pointRadius: YEARS.map((y) => (y === state.year ? 8 : 5)), pointHoverRadius: 9,
        pointBackgroundColor: ms.map((m) => (m >= 0 ? dem : rep)), pointBorderColor: cssVar("--surface"), pointBorderWidth: 2
      }] },
      options: baseOptions({
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => " " + marginLabel(c.parsed.y / 100) } } },
        scales: { y: { ticks: { callback: (t) => (t === 0 ? "Even" : (t > 0 ? "D+" : "R+") + Math.abs(t)) },
          grid: { color: (c) => (c.tick.value === 0 ? cssVar("--ink-3") : cssVar("--line")) } } }
      })
    };
    if (stateChart) stateChart.destroy();
    stateChart = new Chart($("#stateChart"), cfg);
  }

  // ---------- charts ----------
  function baseOptions(extra) {
    const ink2 = cssVar("--ink-2"), line = cssVar("--line");
    const o = {
      responsive: true, maintainAspectRatio: false, animation: { duration: 350 },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "top", align: "start", labels: { color: ink2, usePointStyle: true, pointStyle: "rectRounded", boxWidth: 10, padding: 14 } },
        tooltip: { backgroundColor: cssVar("--surface"), titleColor: cssVar("--ink"), bodyColor: cssVar("--ink"), borderColor: line,
          borderWidth: 1, padding: 10, cornerRadius: 10, boxPadding: 4, usePointStyle: true }
      },
      scales: {
        x: { ticks: { color: ink2 }, grid: { display: false }, border: { color: line } },
        y: { ticks: { color: ink2 }, grid: { color: line }, border: { display: false } }
      }
    };
    return deepMerge(o, extra || {});
  }
  function deepMerge(a, b) {
    for (const k in b) {
      if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && typeof b[k] !== "function") a[k] = deepMerge(a[k] || {}, b[k]);
      else a[k] = b[k];
    }
    return a;
  }

  // dashed 270-to-win reference line
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
    const share = (y, i) => {
      const st = Object.values(state.data[y].states);
      const t = st.reduce((a, v) => [a[0] + v[0], a[1] + v[1], a[2] + v[2]], [0, 0, 0]);
      return +((t[i] / t[2]) * 100).toFixed(2);
    };
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
      backgroundColor: YEARS.map((y) => (y === state.year ? c : d3.color(c).copy({ opacity: 0.55 }).formatRgb())),
      borderRadius: 4, borderSkipped: "start", borderColor: surf, borderWidth: { top: 0, left: 2, right: 2, bottom: 0 },
      categoryPercentage: 0.7, barPercentage: 0.9 });
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

  // ---------- closest states & table ----------
  function renderLists() {
    const rows = Object.entries(state.data[state.year].states)
      .filter(([f]) => M.states[f])
      .map(([f, v]) => ({ f, v, m: marginOf(v) }));
    const close = rows.slice().sort((a, b) => Math.abs(a.m) - Math.abs(b.m)).slice(0, 8);
    $("#closeTitle").textContent = `Closest states in ${state.year}`;
    $("#closeList").innerHTML = close.map((r) =>
      `<li><button type="button" data-f="${r.f}"><span class="sw" style="--c:${r.m >= 0 ? "var(--dem)" : "var(--rep)"}"></span>
        ${M.states[r.f][0]}<span class="m">${marginLabel(r.m)}</span></button></li>`).join("");

    rows.sort((a, b) => M.states[a.f][0].localeCompare(M.states[b.f][0]));
    $("#stateTable tbody").innerHTML = rows.map((r) =>
      `<tr data-f="${r.f}"><td>${M.states[r.f][0]}</td><td class="num">${pct(r.v[0] / r.v[2])}</td>
        <td class="num">${pct(r.v[1] / r.v[2])}</td><td class="num">${marginLabel(r.m)}</td></tr>`).join("");
  }
  $("#closeList").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-f]"); if (b) selectState(b.dataset.f, { zoom: true, scroll: true });
  });
  $("#stateTable").addEventListener("click", (e) => {
    const r = e.target.closest("tr[data-f]"); if (r) selectState(r.dataset.f, { zoom: true, scroll: true });
  });

  function renderAll() {
    hideTip(); drawMap(); renderSummary(); renderCharts(); renderLists(); renderStatePanel();
  }

  // theme changes -> recolor
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { buildColors(); renderAll(); });

  // ---------- load ----------
  buildColors();
  Promise.all([fetch("data/results.json").then((r) => r.json()), fetch("data/counties-albers-10m.json").then((r) => r.json())])
    .then(([data, us]) => {
      state.data = data;
      statesGeo = topojson.feature(us, us.objects.states).features;
      countiesGeo = topojson.feature(us, us.objects.counties).features;
      stateMesh = topojson.mesh(us, us.objects.states, (a, b) => a !== b);
      renderAll();
    })
    .catch((err) => {
      console.error(err);
      $("#summary").innerHTML = '<p class="source">Election data could not be loaded. Check your connection and try again.</p>';
    });

  // ---------- tab bar active state ----------
  const tabs = document.querySelectorAll(".tabbar a[href^='#']");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) tabs.forEach((t) => t.classList.toggle("active", t.getAttribute("href") === "#" + en.target.id));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  ["home", "services", "results", "how"].forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });

  // ---------- PWA ----------
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
