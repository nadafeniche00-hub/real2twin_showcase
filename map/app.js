(() => {
  const $ = (s) => document.querySelector(s);
  const el = (tag, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    kids.forEach((k) => n.append(k));
    return n;
  };
  const TILE = 256, ORIGIN = 20037508.342789244, MINZ = 3, MAXZ = 19;
  const mapEl = $("#map"), tilesEl = $("#tiles"), markersEl = $("#markers"), vecEl = $("#vec"),
    popup = $("#popup"), hint = $("#hint"), coords = $("#coords"), attrEl = $("#attr");
  const view = { ...ETTELN.center };
  const visible = Object.fromEntries(ETTELN.layers.map((l) => [l.id, true]));
  let adding = null, measure = null, baseId = "osm", liveText = "Loading live sensors…";
  let mode3d = false, swipe = 100;
  const tsOn = Object.fromEntries(ETTELN.tilesets.map((t) => [t.id, !!t.on]));
  const overlayOn = {}, overlayOpacity = Object.fromEntries(ETTELN.overlays.map((o) => [o.id, o.opacity ?? 1]));
  ETTELN.overlays.forEach((o) => (overlayOn[o.id] = false));

  // user-added points survive reloads
  const KEY = "etteln-features-v1";
  let features = [], live = [];
  try { features = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(features)); } catch (e) {} };

  // ---------- Web Mercator ----------
  const toPx = (lat, lon, z) => {
    const s = TILE * 2 ** z, r = (lat * Math.PI) / 180;
    return { x: ((lon + 180) / 360) * s, y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * s };
  };
  const toLL = (x, y, z) => {
    const s = TILE * 2 ** z, n = Math.PI - (2 * Math.PI * y) / s;
    return { lat: (180 / Math.PI) * Math.atan(Math.sinh(n)), lon: (x / s) * 360 - 180 };
  };
  const hav = (a, b) => {
    const R = 6371008.8, k = Math.PI / 180, dl = (b.lat - a.lat) * k, dn = (b.lon - a.lon) * k;
    const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * k) * Math.cos(b.lat * k) * Math.sin(dn / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const polyArea = (pts) => {
    const R = 6371008.8, k = Math.PI / 180, l0 = pts[0].lat * k;
    const xy = pts.map((p) => [R * p.lon * k * Math.cos(l0), R * p.lat * k]);
    let s = 0;
    xy.forEach((p, i) => { const q = xy[(i + 1) % xy.length]; s += p[0] * q[1] - q[0] * p[1]; });
    return Math.abs(s) / 2;
  };
  const fmtLen = (m) => (m >= 1000 ? (m / 1000).toFixed(2) + " km" : m.toFixed(1) + " m");
  const fmtArea = (m2) => (m2 >= 1e4 ? (m2 / 1e4).toFixed(2) + " ha" : m2.toFixed(0) + " m²");

  // ---------- tile layers (cached per layer, so panning never reloads what is on screen) ----------
  const layerDefs = () => {
    const b = ETTELN.bases.find((x) => x.id === baseId);
    const list = [{ key: "base:" + b.id, def: b, opacity: 1 }];
    ETTELN.overlays.forEach((o) => overlayOn[o.id] && list.push({ key: "ov:" + o.id, def: o, opacity: overlayOpacity[o.id] }));
    return list;
  };
  const tileUrl = (d, z, x, y) => {
    if (d.wms) {
      const size = (2 * ORIGIN) / 2 ** z, minx = -ORIGIN + x * size, maxy = ORIGIN - y * size;
      return `${d.wms}?service=WMS&version=1.1.1&request=GetMap&layers=${d.layers}&styles=&format=${d.fmt}` +
        `&transparent=${d.fmt === "image/png"}&srs=EPSG:3857&width=256&height=256&bbox=${minx},${maxy - size},${minx + size},${maxy}`;
    }
    return d.url.replace("{z}", z).replace("{x}", x).replace("{y}", d.tms ? 2 ** z - 1 - y : y);
  };
  const containers = new Map(); // key -> { div, tiles: Map(url -> img) }
  function renderTiles(ox, oy, w, h, z) {
    const active = layerDefs(), keys = new Set(active.map((l) => l.key)), max = 2 ** z;
    containers.forEach((c, k) => { if (!keys.has(k)) { c.div.remove(); containers.delete(k); } });
    active.forEach((L, i) => {
      let c = containers.get(L.key);
      if (!c) { c = { div: el("div", { className: "tl" }), tiles: new Map() }; containers.set(L.key, c); tilesEl.append(c.div); }
      c.div.style.zIndex = i; c.div.style.opacity = L.opacity;
      c.div.style.clipPath = L.key.startsWith("ov:") && swipe < 100 ? `inset(0 ${100 - swipe}% 0 0)` : "";
      const need = new Set();
      if (!(L.def.minZoom && z < L.def.minZoom)) {
        for (let ty = Math.floor(oy / TILE); ty <= Math.floor((oy + h) / TILE); ty++) {
          if (ty < 0 || ty >= max) continue;
          for (let tx = Math.floor(ox / TILE); tx <= Math.floor((ox + w) / TILE); tx++) {
            const wx = ((tx % max) + max) % max, url = tileUrl(L.def, z, wx, ty);
            need.add(url);
            let img = c.tiles.get(url);
            if (!img) {
              img = el("img", { alt: "", draggable: false, src: url });
              img.onerror = () => (img.style.visibility = "hidden"); // no coverage here
              c.tiles.set(url, img); c.div.append(img);
            }
            img.style.left = tx * TILE - ox + "px";
            img.style.top = ty * TILE - oy + "px";
          }
        }
      }
      c.tiles.forEach((img, url) => { if (!need.has(url)) { img.remove(); c.tiles.delete(url); } });
    });
  }

  // ---------- render ----------
  let raf = 0;
  const render = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => (mode3d ? sync3d() : draw())); };
  const allPoints = () => [
    ...live.filter((f) => visible[f.layer]).map((f) => ({ ...f, color: ETTELN.layers.find((l) => l.id === f.layer).color })),
    ...features.filter((f) => visible[f.layer]).map((f) => ({ ...f, text: ETTELN.layers.find((l) => l.id === f.layer).name, color: ETTELN.layers.find((l) => l.id === f.layer).color }))
  ];
  // push the shared state (basemap, overlays, 3D tilesets, points) into the Cesium view
  function sync3d() {
    if (!View3D.ready) return;
    View3D.setBase(ETTELN.bases.find((b) => b.id === baseId));
    View3D.setOverlays(ETTELN.overlays, overlayOn, overlayOpacity);
    View3D.setTilesets(ETTELN.tilesets, tsOn);
    View3D.setPoints(allPoints());
  }
  async function set3d(on) {
    const btn = $("#m3d");
    if (on) {
      btn.textContent = "…";
      try { await View3D.load(); } catch (e) { btn.textContent = "3D"; alert(e.message); return; }
      mode3d = true; $("#cesium").hidden = false; btn.textContent = "2D"; btn.classList.add("on");
      popup.hidden = true; hint.style.display = "none"; if (measure) stopMeasure();
      View3D.resize(); sync3d();
      View3D.flyTo(view, mapEl.clientHeight, { instant: true });
    } else {
      if (View3D.ready) Object.assign(view, View3D.getView(mapEl.clientHeight));
      mode3d = false; $("#cesium").hidden = true; btn.textContent = "3D"; btn.classList.remove("on");
      render();
    }
    renderLayers();
  }
  $("#m3d").onclick = () => set3d(!mode3d);
  const appState = () => ({ features, live, visible, overlayOn, tsOn, baseId, baseName: ETTELN.bases.find((b) => b.id === baseId).name, view, mode3d });
  function draw() {
    const w = mapEl.clientWidth, h = mapEl.clientHeight, z = view.zoom;
    const c = toPx(view.lat, view.lon, z), ox = c.x - w / 2, oy = c.y - h / 2;
    renderTiles(ox, oy, w, h, z);
    const pos = (lat, lon) => { const p = toPx(lat, lon, z); return { x: p.x - ox, y: p.y - oy }; };

    markersEl.replaceChildren();
    const place = (lat, lon, cls, color, onclick, title) => {
      const p = pos(lat, lon);
      if (p.x < -20 || p.y < -20 || p.x > w + 20 || p.y > h + 20) return;
      const m = el("div", { className: "mk " + cls, title: title || "" });
      m.style.left = p.x + "px"; m.style.top = p.y + "px";
      if (color) m.style.background = color;
      m.addEventListener("click", (e) => { e.stopPropagation(); onclick(m); });
      markersEl.append(m);
    };
    ETTELN.views.forEach((v) => {
      if (v.name !== "Overview") place(v.lat, v.lon, "view", null, (m) => showPopup(m, v.name, "Saved viewpoint from VC Map.", null, v), v.name);
    });
    live.forEach((f) => {
      const L = ETTELN.layers.find((l) => l.id === f.layer);
      if (visible[f.layer]) place(f.lat, f.lon, "live", L.color, (m) => showPopup(m, f.name, f.text, null, null, f), f.name);
    });
    features.forEach((f) => {
      const L = ETTELN.layers.find((l) => l.id === f.layer);
      if (L && visible[L.id]) place(f.lat, f.lon, "", L.color, (m) => showPopup(m, f.name, L.name, f), f.name);
    });

    // measurement overlay (SVG)
    vecEl.replaceChildren();
    vecEl.setAttribute("width", w); vecEl.setAttribute("height", h);
    if (measure && measure.pts.length) {
      const P = measure.pts.map((p) => pos(p.lat, p.lon)), d = P.map((p) => `${p.x},${p.y}`).join(" ");
      const ns = "http://www.w3.org/2000/svg";
      const shape = document.createElementNS(ns, measure.mode === "area" && P.length > 2 ? "polygon" : "polyline");
      shape.setAttribute("points", d); shape.setAttribute("class", "mshape");
      vecEl.append(shape);
      P.forEach((p) => { const c = document.createElementNS(ns, "circle"); c.setAttribute("cx", p.x); c.setAttribute("cy", p.y); c.setAttribute("r", 4); c.setAttribute("class", "mpt"); vecEl.append(c); });
    }
    attrEl.replaceChildren("© ", ...[...new Set(layerDefs().map((l) => l.def.attr).filter(Boolean))].flatMap((a, i) => [i ? ", " : "", a]));
    writeHash();
  }

  // ---------- shareable URL state ----------
  let hashTimer = 0;
  function writeHash() {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(() => {
      const ov = Object.keys(overlayOn).filter((k) => overlayOn[k]).join(",");
      history.replaceState(null, "", `#${view.zoom}/${view.lat.toFixed(5)}/${view.lon.toFixed(5)}/${baseId}/${ov}`);
    }, 150);
  }
  (function readHash() {
    const [z, lat, lon, b, ov] = location.hash.slice(1).split("/");
    if (!isFinite(+z) || !isFinite(+lat) || !isFinite(+lon) || z === "") return;
    Object.assign(view, { zoom: Math.max(MINZ, Math.min(MAXZ, +z)), lat: +lat, lon: +lon });
    if (ETTELN.bases.some((x) => x.id === b)) baseId = b;
    (ov || "").split(",").forEach((k) => { if (k in overlayOn) overlayOn[k] = true; });
  })();

  // ---------- popup ----------
  function showPopup(m, title, text, feat, vw, lv) {
    popup.replaceChildren(el("h3", { textContent: title }), el("div", { textContent: text }));
    if (feat) {
      popup.append(el("div", { textContent: `${feat.lat.toFixed(5)}, ${feat.lon.toFixed(5)}` }));
      popup.append(el("button", { className: "sm", textContent: "Rename", onclick: () => {
        const n = prompt("New name", feat.name); if (n) { feat.name = n; save(); popup.hidden = true; render(); }
      } }), el("button", { className: "sm", textContent: "Delete", onclick: () => {
        features = features.filter((x) => x !== feat); save(); popup.hidden = true; render(); renderLayers();
      } }));
    }
    if (vw) popup.append(el("button", { className: "sm", textContent: "Fly here", onclick: () => flyTo(vw.lat, vw.lon, vw.zoom) }));
    if (lv) popup.append(el("div", { className: "sub", textContent: `${lv.lat.toFixed(5)}, ${lv.lon.toFixed(5)}` }));
    popup.hidden = false;
    popup.style.left = Math.min(parseFloat(m.style.left) + 14, mapEl.clientWidth - 280) + "px";
    popup.style.top = Math.max(parseFloat(m.style.top) - 10, 8) + "px";
  }

  // ---------- navigation: drag, wheel, pinch, dblclick, keyboard, animated fly ----------
  const pointers = new Map();
  let drag = null, moved = 0, pinch = null;
  const px2ll = (px, py) => {
    const c = toPx(view.lat, view.lon, view.zoom);
    return toLL(c.x - mapEl.clientWidth / 2 + px, c.y - mapEl.clientHeight / 2 + py, view.zoom);
  };
  const local = (e) => { const r = mapEl.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  mapEl.addEventListener("pointerdown", (e) => {
    if (mode3d) return;
    if (e.target.closest("#ctrl,#popup,#measurebar")) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    mapEl.setPointerCapture(e.pointerId);
    if (pointers.size === 1) { drag = { x: e.clientX, y: e.clientY }; moved = 0; mapEl.classList.add("drag"); }
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: view.zoom }; drag = null; moved = 99; }
  });
  mapEl.addEventListener("pointermove", (e) => {
    if (mode3d) return;
    const p = local(e), ll = px2ll(p.x, p.y);
    coords.textContent = `${ll.lat.toFixed(5)}, ${ll.lon.toFixed(5)} · z${view.zoom}`;
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()], r = mapEl.getBoundingClientRect();
      const nz = Math.round(pinch.z + Math.log2(Math.hypot(a.x - b.x, a.y - b.y) / pinch.d));
      zoomTo(nz, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag = { x: e.clientX, y: e.clientY };
    moved += Math.abs(dx) + Math.abs(dy);
    const c = toPx(view.lat, view.lon, view.zoom), n = toLL(c.x - dx, c.y - dy, view.zoom);
    view.lat = Math.max(-85, Math.min(85, n.lat)); view.lon = n.lon;
    render();
  });
  const endPointer = (e) => {
    if (mode3d) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    mapEl.classList.remove("drag");
    if (!drag) return;
    drag = null;
    if (moved > 4 || e.type === "pointercancel") return;
    popup.hidden = true;
    const p = local(e), ll = px2ll(p.x, p.y);
    if (measure) addMeasurePoint(ll);
    else if (adding) addFeature(ll);
  };
  mapEl.addEventListener("pointerup", endPointer);
  mapEl.addEventListener("pointercancel", endPointer);
  mapEl.addEventListener("dblclick", (e) => {
    if (mode3d) return;
    if (e.target.closest("#ctrl,#popup,#measurebar,.mk")) return;
    if (measure) { finishMeasure(); return; }
    const p = local(e), ll = px2ll(p.x, p.y);
    flyTo(ll.lat, ll.lon, view.zoom + 1);
  });

  function zoomTo(z, px, py) {
    z = Math.max(MINZ, Math.min(MAXZ, z));
    if (z === view.zoom) return;
    const w = mapEl.clientWidth, h = mapEl.clientHeight;
    px = px ?? w / 2; py = py ?? h / 2;
    const ll = px2ll(px, py);
    view.zoom = z;
    const p = toPx(ll.lat, ll.lon, z), n = toLL(p.x - px + w / 2, p.y - py + h / 2, z);
    view.lat = n.lat; view.lon = n.lon;
    render();
  }
  mapEl.addEventListener("wheel", (e) => {
    if (mode3d) return;
    e.preventDefault();
    const p = local(e);
    zoomTo(view.zoom + (e.deltaY < 0 ? 1 : -1), p.x, p.y);
  }, { passive: false });

  let fly = 0;
  function flyTo(lat, lon, zoom) {
    if (mode3d) { Object.assign(view, { lat, lon, zoom: zoom ?? view.zoom }); return View3D.flyTo(view, mapEl.clientHeight); }
    cancelAnimationFrame(fly);
    zoom = Math.max(MINZ, Math.min(MAXZ, zoom ?? view.zoom));
    const from = { ...view }, t0 = performance.now(), dur = 900;
    const a = toPx(from.lat, from.lon, 20), b = toPx(lat, lon, 20); // interpolate in a fixed pixel space
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const ll = toLL(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e, 20);
      view.lat = ll.lat; view.lon = ll.lon;
      view.zoom = Math.round(from.zoom + (zoom - from.zoom) * e);
      render();
      if (k < 1) fly = requestAnimationFrame(step);
    };
    fly = requestAnimationFrame(step);
  }

  mapEl.addEventListener("keydown", (e) => {
    if (mode3d) return;
    const k = e.key, s = 120;
    if (k === "Escape") { if (measure) stopMeasure(); adding = null; mapEl.classList.remove("add"); hint.style.display = "none"; renderLayers(); return; }
    if (k === "+" || k === "=") return zoomTo(view.zoom + 1);
    if (k === "-") return zoomTo(view.zoom - 1);
    const d = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[k];
    if (!d) return;
    e.preventDefault();
    const c = toPx(view.lat, view.lon, view.zoom), n = toLL(c.x + d[0], c.y + d[1], view.zoom);
    view.lat = n.lat; view.lon = n.lon; render();
  });
  $("#zin").onclick = () => zoomTo(view.zoom + 1);
  $("#zout").onclick = () => zoomTo(view.zoom - 1);
  $("#home").onclick = () => flyTo(ETTELN.center.lat, ETTELN.center.lon, ETTELN.center.zoom);
  $("#locate").onclick = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((p) => flyTo(p.coords.latitude, p.coords.longitude, 17), () => alert("Location unavailable."));
  };
  $("#link").onclick = async () => {
    writeHash(); await new Promise((r) => setTimeout(r, 200));
    try { await navigator.clipboard.writeText(location.href); $("#link").textContent = "✓"; setTimeout(() => ($("#link").textContent = "🔗"), 1200); } catch (e) { prompt("Copy this link", location.href); }
  };
  window.addEventListener("resize", render);

  // ---------- measure tool ----------
  function startMeasure(mode) {
    adding = null; mapEl.classList.remove("add");
    measure = { mode, pts: [], done: false };
    mapEl.classList.add("add");
    hint.style.display = "block";
    hint.textContent = mode === "area" ? "Click to add corners, double-click to finish (Esc cancels)" : "Click to add points, double-click to finish (Esc cancels)";
    updateMeasure(); renderLayers(); render();
  }
  function stopMeasure() { measure = null; mapEl.classList.remove("add"); hint.style.display = "none"; $("#measurebar").hidden = true; renderLayers(); render(); }
  function finishMeasure() { if (measure) { measure.done = true; hint.style.display = "none"; mapEl.classList.remove("add"); updateMeasure(); } }
  function addMeasurePoint(ll) {
    if (measure.done) measure = { mode: measure.mode, pts: [], done: false };
    measure.pts.push(ll); updateMeasure(); render();
  }
  function updateMeasure() {
    const bar = $("#measurebar"); bar.hidden = !measure;
    if (!measure) return;
    const P = measure.pts;
    const len = P.reduce((s, p, i) => (i ? s + hav(P[i - 1], p) : 0), 0);
    const closed = measure.mode === "area" && P.length > 2 ? hav(P[P.length - 1], P[0]) : 0;
    let t = measure.mode === "area" ? (P.length > 2 ? `Area ${fmtArea(polyArea(P))} · perimeter ${fmtLen(len + closed)}` : "Add at least 3 corners") : (P.length > 1 ? `Length ${fmtLen(len)}` : "Add at least 2 points");
    $("#measureout").textContent = t;
  }
  $("#mundo").onclick = () => { if (measure && measure.pts.length) { measure.pts.pop(); updateMeasure(); render(); } };
  $("#mclear").onclick = () => { if (measure) { measure.pts = []; measure.done = false; updateMeasure(); render(); } };
  $("#mexit").onclick = stopMeasure;

  // ---------- user points ----------
  function addFeature(ll) {
    const L = ETTELN.layers.find((l) => l.id === adding);
    const n = features.filter((f) => f.layer === adding).length + 1;
    const name = prompt("Name for this point", `${L.name} ${n}`);
    if (name === null) return;
    features.push({ layer: adding, name, lat: ll.lat, lon: ll.lon });
    visible[adding] = true;
    save(); render(); renderLayers();
  }

  // ---------- live sensors from the FROST server behind VC Map ----------
  async function loadLive() {
    liveText = "Loading live sensors…"; renderLayers();
    const out = [];
    await Promise.all(Object.entries(ETTELN.frost).map(async ([layer, prop]) => {
      const q = `Things?$top=1000&$filter=Datastreams/ObservedProperty/name eq '${prop}'` +
        `&$expand=Locations($top=1),Datastreams($top=3;$expand=Observations($top=1;$orderby=phenomenonTime desc))`;
      try {
        const r = await fetch(FROST + encodeURI(q));
        const d = await r.json();
        (d.value || []).forEach((t) => {
          const loc = t.Locations && t.Locations[0] && t.Locations[0].location;
          const c = loc && (loc.coordinates || (loc.geometry && loc.geometry.coordinates));
          if (!c) return;
          const obs = (t.Datastreams || []).map((ds) => {
            const o = ds.Observations && ds.Observations[0], u = ds.unitOfMeasurement && ds.unitOfMeasurement.symbol;
            return o ? `${ds.name}: ${o.result}${u ? " " + u : ""} (${String(o.phenomenonTime).slice(0, 16).replace("T", " ")})` : null;
          }).filter(Boolean);
          out.push({ layer, name: t.name || "Sensor", lon: c[0], lat: c[1], text: obs.join("\n") || "No recent measurement" });
        });
      } catch (e) { /* network or CORS: layer simply stays empty */ }
    }));
    live = out;
    liveText = out.length ? `${out.length} live sensors, updated ${new Date().toLocaleTimeString()}` : "Live sensors unavailable (network or CORS).";
    render(); renderLayers();
  }

  // ---------- side panel ----------
  function renderLayers() {
    const root = $("#tab-layers");
    root.replaceChildren();

    root.append(el("h2", { textContent: "Go to" }),
      el("div", { className: "row" }, ...ETTELN.views.map((v) => el("button", { className: "sm", textContent: v.name, onclick: () => flyTo(v.lat, v.lon, v.zoom) }))));

    root.append(el("h2", { textContent: "Basemap" }));
    ETTELN.bases.forEach((b) => {
      const rb = el("input", { type: "radio", name: "base", checked: baseId === b.id, onchange: () => { baseId = b.id; render(); } });
      root.append(el("label", { className: "opt" }, rb, b.name));
    });

    root.append(el("h2", { textContent: "Overlays" }));
    ETTELN.overlays.forEach((o) => {
      const cb = el("input", { type: "checkbox", checked: overlayOn[o.id], onchange: () => { overlayOn[o.id] = cb.checked; render(); renderLayers(); } });
      root.append(el("label", { className: "opt" }, cb, o.name));
      if (overlayOn[o.id]) root.append(el("input", { type: "range", min: 0, max: 1, step: 0.05, value: overlayOpacity[o.id], className: "op", oninput: (e) => { overlayOpacity[o.id] = +e.target.value; render(); } }));
    });

    if (!mode3d && Object.values(overlayOn).some(Boolean)) {
      root.append(el("label", { className: "opt", textContent: "Swipe: overlays left of the line, basemap right" }),
        el("input", { type: "range", min: 0, max: 100, value: swipe, className: "op", oninput: (e) => {
          swipe = +e.target.value; const sl = $("#swipeline"); sl.hidden = swipe >= 100; sl.style.left = swipe + "%"; render();
        } }));
    }

    root.append(el("h2", { textContent: "3D layers" }),
      el("div", { className: "note", textContent: mode3d ? "These are the village's own 3D Tiles (photogrammetry mesh, point clouds, LoD2), not Google Earth. Drag to orbit, right-drag to tilt, wheel to zoom." : "Press 3D (top right of the map) to open the 3D view. Choices below apply there." }));
    ETTELN.tilesets.forEach((t) => {
      const cb = el("input", { type: "checkbox", checked: tsOn[t.id], onchange: () => { tsOn[t.id] = cb.checked; if (mode3d) sync3d(); } });
      root.append(el("label", { className: "opt" }, cb, t.name));
    });

    root.append(el("h2", { textContent: "Tools" }),
      el("div", { className: "row" },
        el("button", { className: "sm" + (measure && measure.mode === "dist" ? " on" : ""), textContent: "Measure length", onclick: () => (measure && measure.mode === "dist" ? stopMeasure() : startMeasure("dist")) }),
        el("button", { className: "sm" + (measure && measure.mode === "area" ? " on" : ""), textContent: "Measure area", onclick: () => (measure && measure.mode === "area" ? stopMeasure() : startMeasure("area")) })),
      el("div", { className: "row" },
        el("button", { className: "sm", textContent: "Progress report", title: "Status and current limitations, opens in a new tab", onclick: () => Report.open(appState()) }),
        el("button", { className: "sm", textContent: "Download report", onclick: () => Report.save(appState()) }),
        el("button", { className: "sm", textContent: "QGIS pre-config", title: "JSON that build_project.py --preconfig imports into QGIS", onclick: () => Report.savePreconfig(appState()) })));

    root.append(el("h2", { textContent: "Data layers" }),
      el("div", { className: "note", id: "livestatus", textContent: liveText }),
      el("div", { className: "row" }, el("button", { className: "sm", textContent: "Refresh live data", onclick: loadLive })));
    ETTELN.layers.forEach((L) => {
      const mine = features.filter((f) => f.layer === L.id).length, lv = live.filter((f) => f.layer === L.id).length;
      const cb = el("input", { type: "checkbox", checked: visible[L.id], onchange: () => { visible[L.id] = cb.checked; render(); } });
      const dot = el("span", { className: "dot" }); dot.style.background = L.color;
      const add = el("button", { className: "sm" + (adding === L.id ? " on" : ""), textContent: adding === L.id ? "Adding… (stop)" : "Add points", onclick: () => {
        if (measure) stopMeasure();
        adding = adding === L.id ? null : L.id;
        mapEl.classList.toggle("add", !!adding);
        hint.style.display = adding ? "block" : "none";
        hint.textContent = adding ? `Click the map to add to "${L.name}" (Esc stops)` : "";
        renderLayers();
      } });
      root.append(el("div", { className: "layer" },
        el("label", {}, cb, dot, `${L.name} (${lv ? lv + " live" : ""}${lv && mine ? ", " : ""}${mine ? mine + " mine" : ""}${!lv && !mine ? "0" : ""})`),
        el("p", { textContent: L.text }),
        el("div", { className: "row" }, add, el("button", { className: "sm", textContent: "Import GeoJSON", onclick: () => importGeo(L.id) }))));
    });
    root.append(el("div", { className: "row" },
      el("button", { className: "sm", textContent: "Export my points", onclick: exportGeo }),
      el("button", { className: "sm", textContent: "Clear my points", onclick: () => { if (confirm("Delete all added points?")) { features = []; save(); render(); renderLayers(); } } })));
  }
  function importGeo(layer) {
    const inp = el("input", { type: "file", accept: ".geojson,.json" });
    inp.onchange = async () => {
      try {
        const gj = JSON.parse(await inp.files[0].text()), added = [];
        (gj.features || []).forEach((f, i) => {
          if (f.geometry && f.geometry.type === "Point") {
            const n = { layer, name: (f.properties && (f.properties.name || f.properties.id)) || `Imported ${i + 1}`, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] };
            features.push(n); added.push(n);
          }
        });
        save(); render(); renderLayers();
        if (added.length) flyTo(added[0].lat, added[0].lon, 17);
      } catch (e) { alert("Could not read that file as GeoJSON points."); }
    };
    inp.click();
  }
  function exportGeo() {
    const gj = { type: "FeatureCollection", features: features.map((f) => ({ type: "Feature", properties: { name: f.name, layer: f.layer }, geometry: { type: "Point", coordinates: [f.lon, f.lat] } })) };
    el("a", { href: URL.createObjectURL(new Blob([JSON.stringify(gj, null, 2)], { type: "application/geo+json" })), download: "etteln-points.geojson" }).click();
  }
  const table = (rows, head) => {
    const t = el("table");
    if (head) t.append(el("tr", {}, ...head.map((h) => el("th", { textContent: h }))));
    rows.forEach((r) => t.append(el("tr", {}, ...r.map((c) => el("td", { textContent: c })))));
    return t;
  };
  $("#tab-project").append(table(ETTELN.facts));
  $("#tab-people").append(table(ETTELN.people));
  $("#tab-sources").append(el("ul", {}, ...ETTELN.sources.map(([t, u]) =>
    el("li", {}, u ? el("a", { href: u, textContent: t, target: "_blank", rel: "noopener" }) : t))));
  $("#tabs").addEventListener("click", (e) => {
    const t = e.target.dataset.tab;
    if (!t) return;
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b === e.target));
    document.querySelectorAll("#panel section").forEach((s) => (s.hidden = s.id !== "tab-" + t));
  });

  renderLayers();
  render();
  loadLive();
})();
