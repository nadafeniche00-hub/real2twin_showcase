// Progress report and QGIS pre-config, both built from the live state of the app. All text in English.
const Report = (() => {
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LABEL = { done: "Done", partial: "In progress", todo: "Not started" };
  const download = (name, text, type) => {
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([text], { type })), download: name });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  function build(s) {
    const now = new Date(), P = ETTELN.progress;
    const n = (st) => P.filter((p) => p.status === st).length, pct = Math.round(((n("done") + 0.5 * n("partial")) / P.length) * 100);
    const byArea = [...new Set(P.map((p) => p.area))];
    const sensorsByLayer = ETTELN.layers.map((l) => [l.name, s.live.filter((f) => f.layer === l.id).length, s.features.filter((f) => f.layer === l.id).length]);
    const enabled3d = ETTELN.tilesets.filter((t) => s.tsOn[t.id]).map((t) => t.name);
    const overlays = ETTELN.overlays.filter((o) => s.overlayOn[o.id]).map((o) => o.name);
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Real2Twin progress report</title>
<style>
:root{--bg:#fff;--fg:#1d2420;--mut:#5d6862;--line:#dcdad2;--acc:#1f6f54;--warn:#a85a00;--bad:#b3261e}
@media (prefers-color-scheme:dark){:root{--bg:#141815;--fg:#e8ece9;--mut:#9aa6a0;--line:#2d3731;--acc:#5cc4a0;--warn:#e8a04a;--bad:#ff8a80}}
body{margin:0 auto;max-width:860px;padding:24px 16px;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,sans-serif}
h1{margin:0}h2{margin:28px 0 8px;font-size:1.15rem}.sub{color:var(--mut);margin:2px 0 16px}
table{width:100%;border-collapse:collapse;font-size:.9rem}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.bar{height:12px;background:var(--line);border-radius:6px;overflow:hidden}.bar i{display:block;height:100%;background:var(--acc)}
.tag{display:inline-block;padding:1px 8px;border-radius:10px;font-size:.78rem;font-weight:600;border:1px solid currentColor}
.done{color:var(--acc)}.partial{color:var(--warn)}.todo{color:var(--bad)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.card{border:1px solid var(--line);border-radius:8px;padding:8px 10px}.card b{font-size:1.4rem;display:block}
button{padding:6px 12px;border:1px solid var(--line);background:none;color:var(--fg);border-radius:6px;cursor:pointer}
@media print{button{display:none}body{max-width:none}}
</style></head><body>
<h1>Real2Twin: progress report</h1>
<p class="sub">Etteln digital twin workspace · generated ${esc(now.toISOString().slice(0, 16).replace("T", " "))} UTC · <button onclick="print()">Print / save as PDF</button></p>

<h2>1. Summary</h2>
<p>Real2Twin aims to keep BIM/GIS digital twins in sync with the real world using Gaussian splats and AI segmentation (SAM, Grounding DINO, Depth Anything), with Etteln as pilot partner.
So far the work is <b>preparation and tooling</b>: the context is researched and the existing Etteln twin is mapped and viewable in 2D and 3D. <b>The core pipeline (capture, splat, segmentation, BIM update) has not been started</b>, and key inputs (raw images, a reference BIM model, ground truth) are not yet available.</p>
<div class="bar" role="progressbar" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
<p class="sub">${n("done")} done, ${n("partial")} in progress, ${n("todo")} not started, of ${P.length} tracked items. The ${pct}% figure weights in-progress items at half and is a rough indicator only.</p>

<h2>2. Status by area</h2>
${byArea.map((a) => `<h3 style="margin:14px 0 4px;font-size:1rem">${esc(a)}</h3><table>${P.filter((p) => p.area === a).map((p) =>
  `<tr><td style="width:110px"><span class="tag ${p.status}">${LABEL[p.status]}</span></td><td>${esc(p.item)}${p.note ? `<br><span class="sub">${esc(p.note)}</span>` : ""}</td></tr>`).join("")}</table>`).join("")}

<h2>3. Current state of this workspace</h2>
<div class="cards">
  <div class="card"><b>${s.live.length}</b>live sensors loaded</div>
  <div class="card"><b>${s.features.length}</b>user points (this browser)</div>
  <div class="card"><b>${enabled3d.length}</b>3D layers selected</div>
  <div class="card"><b>${esc(s.baseName)}</b>basemap</div>
</div>
<table style="margin-top:10px"><tr><th>Data layer</th><th>Live</th><th>User points</th></tr>${sensorsByLayer.map(([nm, l, u]) => `<tr><td>${esc(nm)}</td><td>${l}</td><td>${u}</td></tr>`).join("")}</table>
<p class="sub">Overlays on: ${esc(overlays.join(", ") || "none")}. 3D layers selected: ${esc(enabled3d.join(", ") || "none")}. View: ${s.view.lat.toFixed(5)}, ${s.view.lon.toFixed(5)}, zoom ${s.view.zoom}, mode ${s.mode3d ? "3D" : "2D"}.</p>

<h2>4. Current limitations</h2>
<table>${ETTELN.limitations.map(([t, d]) => `<tr><td style="width:190px"><b>${esc(t)}</b></td><td>${esc(d)}</td></tr>`).join("")}</table>

<h2>5. Suggested next steps</h2>
<ol>
<li>Confirm funding, start date and weekly hours; get the LOI and agree a minimum and a stretch goal.</li>
<li>Choose one reference building that has plans or a Revit model, and agree the pilot area with Etteln.</li>
<li>Send the data request to DiDoZ / Gemeinde Borchen (raw images with EXIF and flight logs, native 3D model, ground control points).</li>
<li>Run a first small capture, a baseline splat and a segmentation test; define the accuracy target in cm.</li>
<li>Start the licence table and the legal checks (drone category, airspace, DSGVO).</li>
</ol>
<p class="sub">Sources: project documents and the public VC Map configuration of the Etteln platform. Status entries are maintained by hand in <code>data.js</code> (<code>progress</code>, <code>limitations</code>).</p>
</body></html>`;
  }

  function open(state) {
    const html = build(state);
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const w = window.open(url, "_blank");
    if (!w) download("real2twin-progress-report.html", html, "text/html"); // popup blocked: download instead
  }
  function save(state) { download("real2twin-progress-report.html", build(state), "text/html"); }

  // Everything build_project.py needs to pre-fill the QGIS project (coordinates in WGS84).
  function preconfig(s) {
    const pt = (name, lat, lon, props = {}) => ({ type: "Feature", properties: { name, ...props }, geometry: { type: "Point", coordinates: [lon, lat] } });
    return {
      schema: "etteln-preconfig/1",
      generated: new Date().toISOString(),
      crs: "EPSG:4326",
      view: { lat: s.view.lat, lon: s.view.lon, zoom: s.view.zoom },
      visible: { basemap: s.baseId, overlays: Object.keys(s.overlayOn).filter((k) => s.overlayOn[k]), tilesets: ETTELN.tilesets.filter((t) => s.tsOn[t.id]).map((t) => t.id) },
      capture_sessions: { type: "FeatureCollection", features: s.features.map((f, i) => pt(f.name, f.lat, f.lon, { session_id: f.name || "S" + String(i + 1).padStart(3, "0"), source_layer: f.layer })) },
      sensors_snapshot: { type: "FeatureCollection", features: s.live.map((f) => pt(f.name, f.lat, f.lon, { layer: f.layer, last_value: f.text })) },
      views: ETTELN.views.map((v) => ({ name: v.name, lat: v.lat, lon: v.lon, zoom: v.zoom }))
    };
  }
  function savePreconfig(state) { download("etteln_preconfig.json", JSON.stringify(preconfig(state), null, 2), "application/json"); }

  return { open, save, savePreconfig, build, preconfig };
})();
