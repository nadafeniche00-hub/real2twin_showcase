// 3D mode: CesiumJS loaded on demand, showing the same 3D Tiles / terrain that VC Map serves for Etteln.
// This is not Google Earth: the meshes are the village's own photogrammetry (b3dm tiles) plus NRW LoD2 and point clouds.
const View3D = (() => {
  const CDN = "https://cdn.jsdelivr.net/npm/cesium@1.119.0/Build/Cesium/";
  const GROUND = 160; // approx. ground height of Etteln in metres, used to aim the camera
  let viewer = null, loading = null, baseLayer = null, baseKey = null;
  const sets = {}, ovLayers = {};

  function load() {
    if (loading) return loading;
    loading = new Promise((res, rej) => {
      window.CESIUM_BASE_URL = CDN;
      document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href: CDN + "Widgets/widgets.css" }));
      document.head.append(Object.assign(document.createElement("script"), { src: CDN + "Cesium.js", onload: res, onerror: () => { loading = null; rej(new Error("Cesium could not be loaded (offline?)")); } }));
    }).then(init);
    return loading;
  }

  async function init() {
    Cesium.Ion.defaultAccessToken = ""; // no Cesium ion: every source below is public or self-hosted
    viewer = new Cesium.Viewer("cesium", {
      baseLayer: false, baseLayerPicker: false, geocoder: false, timeline: false, animation: false,
      homeButton: false, sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false
    });
    viewer.scene.globe.depthTestAgainstTerrain = true;
    try { viewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromUrl(T + "3774ed6d-cf2e-4337-a05e-3c24405e00ed/"); }
    catch (e) { console.warn("1 m terrain unavailable, using ellipsoid", e); }
    return viewer;
  }

  const imagery = (d) => d.wms
    ? new Cesium.WebMapServiceImageryProvider({ url: d.wms, layers: d.layers, parameters: { format: d.fmt, transparent: d.fmt === "image/png" }, credit: d.attr || "" })
    : new Cesium.UrlTemplateImageryProvider({
        url: d.url.replace("{y}", d.tms ? "{reverseY}" : "{y}"), minimumLevel: d.minZoom || 0, maximumLevel: d.maxZoom || 19, credit: d.attr || "",
        rectangle: d.bbox ? Cesium.Rectangle.fromDegrees(...d.bbox) : undefined
      });

  function setBase(def) {
    if (!viewer || baseKey === def.id) return;
    if (baseLayer) viewer.imageryLayers.remove(baseLayer, true);
    baseLayer = viewer.imageryLayers.add(new Cesium.ImageryLayer(imagery(def)), 0);
    baseKey = def.id;
  }
  function setOverlays(defs, on, opacity) {
    if (!viewer) return;
    defs.forEach((d) => {
      if (on[d.id] && !ovLayers[d.id]) ovLayers[d.id] = viewer.imageryLayers.add(new Cesium.ImageryLayer(imagery(d)));
      if (!on[d.id] && ovLayers[d.id]) { viewer.imageryLayers.remove(ovLayers[d.id], true); delete ovLayers[d.id]; }
      if (ovLayers[d.id]) ovLayers[d.id].alpha = opacity[d.id];
    });
  }

  // tilesets: defs = ETTELN.tilesets, on = { id: bool }
  async function setTilesets(defs, on) {
    if (!viewer) return;
    for (const d of defs) {
      if (on[d.id] && !sets[d.id]) {
        sets[d.id] = "loading";
        try {
          const ts = await Cesium.Cesium3DTileset.fromUrl(T + d.path, { maximumScreenSpaceError: d.sse || 8 });
          if (d.points) ts.pointCloudShading.attenuation = true;
          viewer.scene.primitives.add(ts);
          ts.show = !!on[d.id];
          sets[d.id] = ts;
        } catch (e) { console.warn("tileset failed", d.id, e); delete sets[d.id]; }
      }
      if (sets[d.id] && sets[d.id] !== "loading") sets[d.id].show = !!on[d.id];
    }
  }

  function setPoints(items) {
    if (!viewer) return;
    viewer.entities.removeAll();
    items.forEach((p) => viewer.entities.add({
      name: p.name,
      description: `<pre style="white-space:pre-wrap">${String(p.text || "").replace(/[<&]/g, (c) => ({ "<": "&lt;", "&": "&amp;" }[c]))}</pre>`,
      position: Cesium.Cartesian3.fromDegrees(p.lon, p.lat),
      point: { pixelSize: 11, color: Cesium.Color.fromCssColorString(p.color || "#c0392b"), outlineColor: Cesium.Color.WHITE, outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
      label: { text: p.name, font: "12px sans-serif", pixelOffset: new Cesium.Cartesian2(0, -18), showBackground: true,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY, distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 600) }
    }));
  }

  // 2D zoom level <-> camera distance (Web Mercator metres per pixel, 60 degree vertical fov)
  const rangeFor = (lat, z, hPx) => (156543.03 * Math.cos((lat * Math.PI) / 180) / 2 ** z) * hPx / (2 * Math.tan(Math.PI / 6));
  function flyTo(v, hPx, opts = {}) {
    const target = Cesium.Cartesian3.fromDegrees(v.lon, v.lat, GROUND);
    const hpr = new Cesium.HeadingPitchRange(Cesium.Math.toRadians(opts.heading ?? 0), Cesium.Math.toRadians(opts.pitch ?? -45), rangeFor(v.lat, v.zoom, hPx));
    if (opts.instant) viewer.camera.lookAt(target, hpr);
    else viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(target, 1), { offset: hpr, duration: 1.4 });
    if (opts.instant) viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  }
  function getView(hPx) {
    const c = viewer.camera, ray = c.getPickRay(new Cesium.Cartesian2(viewer.canvas.clientWidth / 2, viewer.canvas.clientHeight / 2));
    const hit = ray && viewer.scene.globe.pick(ray, viewer.scene);
    const cart = Cesium.Cartographic.fromCartesian(hit || c.positionWC);
    const lat = Cesium.Math.toDegrees(cart.latitude), lon = Cesium.Math.toDegrees(cart.longitude);
    const dist = hit ? Cesium.Cartesian3.distance(c.positionWC, hit) : Math.max(50, c.positionCartographic.height);
    const z = Math.log2((156543.03 * Math.cos(cart.latitude) * hPx) / (2 * Math.tan(Math.PI / 6) * dist));
    return { lat, lon, zoom: Math.max(3, Math.min(19, Math.round(z))) };
  }
  const resize = () => viewer && viewer.resize();

  return { get viewer() { return viewer; }, load, setBase, setOverlays, setTilesets, setPoints, flyTo, getView, resize, get ready() { return !!viewer; } };
})();
