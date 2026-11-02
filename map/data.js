// Everything here comes from the research notes (see ../Real2twin_Shadow/Investigation_Etteln/findings.md).
// No sensor or object coordinates were available, so layers start empty; add points on the map or import GeoJSON.
const T = "https://tiles.plattform.etteln.didoz.de/tiles/datasource-data/";
const FROST = "https://frost.plattform.etteln.didoz.de/FROST-Server/v1.1/";
const ETTELN = {
  // viewpoints taken from the public VC Map project config
  views: [
    { name: "Overview", lat: 51.6226, lon: 8.7671, zoom: 15 },
    { name: "Mitfahrbank", lat: 51.6281, lon: 8.7625, zoom: 17 },
    { name: "Gemeindehalle", lat: 51.6285, lon: 8.7635, zoom: 19 },
    { name: "Church", lat: 51.6311, lon: 8.7610, zoom: 18 }
  ],
  bases: [
    { id: "osm", name: "OpenStreetMap", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attr: "OpenStreetMap contributors" },
    { id: "topplus", name: "TopPlus Open (BKG)", wms: "https://sgx.geodatenzentrum.de/wms_topplus_open", layers: "web", fmt: "image/png", attr: "BKG" },
    { id: "dop", name: "Aerial NRW (DOP)", wms: "https://www.wms.nrw.de/geobasis/wms_nw_dop", layers: "nw_dop_rgb", fmt: "image/jpeg", attr: "Geobasis NRW" }
  ],
  overlays: [
    { id: "ortho", name: "Etteln ortho 3 cm (June 2023)", url: T + "dfb574cd-4b06-42f7-99cc-87c03a8447be/{z}/{x}/{y}.png", tms: true, minZoom: 12, maxZoom: 21, bbox: [8.7378, 51.6167, 8.7888, 51.6446], opacity: 1 },
    { id: "alkis", name: "ALKIS land use NRW", wms: "https://www.wms.nrw.de/geobasis/wms_nw_alkis", layers: "adv_alkis_tatsaechliche_nutzung", fmt: "image/png", opacity: 0.7 },
    { id: "flood", name: "Flood depths NRW", wms: "https://www.wms.nrw.de/umwelt/wasser/HW_Gefahrenkarte", layers: "Tiefen_Ueberflutungsgebiet_nw", fmt: "image/png", opacity: 0.7 }
  ],
  // 3D Tiles served by the Etteln platform (same files VC Map loads). path is relative to T.
  tilesets: [
    { id: "mesh24", name: "3D mesh 2024 (village)", path: "Mesh_Lieferung_2024/Etteln_Tiled_Model_gesamt_mit_Aussparung_b3dm_v2/tileset.json", on: true },
    { id: "mesh24s", name: "3D mesh 2024 (single plot, low res)", path: "Mesh_Lieferung_2024/Etteln_Tiled_Model_Einzelgrundstueck_geringe_Aufloesung_b3dm_v2/tileset.json" },
    { id: "meshsum", name: "3D mesh summer (June 2023)", path: "etteln_mesh_20230609/tileset.json" },
    { id: "mesh3cm", name: "3D mesh winter (3 cm texture)", path: "Etteln_Tiled_Model_gesamt_Textur_3cm/tileset.json" },
    { id: "lod2", name: "LoD2 buildings (NRW)", path: "b743aec0-fd46-4c27-925d-4575b10b7c3c/tileset.json" },
    { id: "pcc", name: "Point cloud, coloured", path: "91260705-8d86-49ab-893e-c70b70d2948d/tileset.json", points: true },
    { id: "class", name: "Mesh classification (experimental)", path: "afffb327-db6e-4a94-9aa0-c3c7f059abc2/tileset.json" }
  ],
  // honest project status, used by the Report button. status: done | partial | todo
  progress: [
    { area: "Context research", item: "Steckbrief, task list and briefing reviewed; Etteln / DiDoZ platform inventoried (VC Map layers, 3D Tiles, sensors)", status: "done" },
    { area: "Context research", item: "Open questions for TH OWL and Etteln collected (see briefing, section 8)", status: "partial", note: "Drafted, not yet asked." },
    { area: "Data access", item: "Public Etteln 3D Tiles, ortho, terrain and FROST sensor API reachable from the web app", status: "done" },
    { area: "Data access", item: "Raw drone images, flight logs, ground control points from DiDoZ", status: "todo", note: "Not requested yet; not public." },
    { area: "Data access", item: "BIM / IFC / CAD model of a reference building", status: "todo", note: "No building chosen yet; LoD2 is only a coarse baseline." },
    { area: "Tooling", item: "Interactive 2D/3D web viewer (this app)", status: "done" },
    { area: "Tooling", item: "Local QGIS project with services, 3D Tiles and Real2Twin working layers", status: "done" },
    { area: "Tooling", item: "QGIS pre-config import (web app points into QGIS)", status: "done" },
    { area: "Vector base data", item: "ALKIS buildings, parcels and land-use polygons for the pilot area in QGIS (snappable), plus DXF export for AutoCAD", status: "done", note: "Open NRW cadastre data; 350 m around the Gemeindehalle only." },
    { area: "Vector base data", item: "Attribute schema for buildings, parcels, equipment points and lines", status: "done" },
    { area: "Vector base data", item: "Equipment checklist built from the Etteln digital strategy (what to locate and who to ask)", status: "done" },
    { area: "Vector base data", item: "Existing GIS data found online, downloaded and inspected (Kreis Paderborn ALKIS package for Borchen, Open.NRW GeoPackage, Energieatlas NRW)", status: "done", note: "No ArcMap (.mxd) project found for Etteln; official data is ALKIS shapefiles, usable in ArcGIS and QGIS." },
    { area: "Vector base data", item: "Attribute values filled for buildings, parcels and equipment (visits, then Etteln)", status: "partial", note: "Seeded from ALKIS, LoD2 and Energieatlas: addresses (1382 of 1647 buildings), building type (1162), roof type and height (1530), 17 PV flags, 62 equipment points. Nothing is verified on site yet." },
    { area: "Vector base data", item: "NRW LoD2 loaded: roof type, height and elevations joined to 1530 of 1647 buildings", status: "done", note: "Roof code names come from the AdV code list from memory, to verify. No floors in LoD2 either." },
    { area: "Vector base data", item: "Sources documented (links, licences, checksums) and the source files stored in the repo", status: "done", note: "Some licences are still unverified (LoD2 page, Energieatlas, DiDoZ services)." },
    { area: "Field verification", item: "Verification database (sources, photos, field checks) and photo ingest script, tested on synthetic photos", status: "done", note: "Empty until the field visit." },
    { area: "Field verification", item: "Field visit: 10-15 photos per building for a sample of buildings and equipment points (planned week of 2 Nov 2026)", status: "todo" },
    { area: "Field verification", item: "Compare online data with reality (match rates per layer) and decide which sources to trust", status: "todo" },
    { area: "Field verification", item: "Building recognition from photos: retrieval with pretrained embeddings plus geometric verification", status: "todo", note: "Needs the photo set and camera intrinsics first." },
    { area: "Vector base data", item: "Road and river centrelines (lines layer)", status: "todo", note: "ALKIS only gives road and water polygons; centrelines need another source." },
    { area: "Stage A (images to structured 3D)", item: "Capture protocol and first captures", status: "todo" },
    { area: "Stage A (images to structured 3D)", item: "Camera poses and Gaussian splat training (COLMAP + nerfstudio / gsplat)", status: "todo" },
    { area: "Stage A (images to structured 3D)", item: "Segmentation with SAM, Grounding DINO, Depth Anything and label lifting to 3D", status: "todo" },
    { area: "Stage A (images to structured 3D)", item: "Metric scale and georeferencing, accuracy target in cm", status: "todo" },
    { area: "Stage B (twin update)", item: "Registration to a BIM / GIS model and change detection", status: "todo" },
    { area: "Stage B (twin update)", item: "Revit add-in or IFC write-back with human approval", status: "todo" },
    { area: "Project management", item: "Licence table, DSGVO and drone-licence checks, project charter", status: "todo" },
    { area: "Project management", item: "Evaluation (dimension error, precision / recall, time saved)", status: "todo" }
  ],
  limitations: [
    ["Splat geometry", "Gaussian splats are optimised for appearance, not metric geometry. Scale, georeferencing and measurable accuracy must still be engineered and proven (core research risk)."],
    ["No pipeline yet", "Nothing in this app segments images or builds splats. It is a viewer and data workspace; stages A and B of the pipeline are not implemented."],
    ["Existing 3D is a mesh", "The village 3D model is a photogrammetry mesh with LoD2 buildings. It is not BIM: no walls, openings or attributes per element."],
    ["Data not owned or confirmed", "Raw images, flight logs, accuracy statements and the LOI are not in hand. Ownership, reuse and open-data rules are unclear."],
    ["Sensor data quality", "Some sensors have not reported for months (e.g. last readings in 2025 or early 2026) and one container reports a height of 65535 cm, which looks like a sentinel value. Values are shown as received, not validated."],
    ["Live data is a snapshot", "Sensor values come from the public FROST server at load time. The QGIS project stores one dated snapshot and does not refresh itself."],
    ["Web app scope", "Measuring works in 2D only. User points are stored in this browser only (localStorage) until exported. The classification mesh layer is experimental and untested."],
    ["Dependencies", "Needs internet: OpenStreetMap, NRW and BKG services, the Etteln tile server, and Cesium from a CDN. Third-party services can change or go offline."],
    ["Licences", "Reference 3D Gaussian Splatting code and some model weights are non-commercial. This matters for the planned start-up and open-source toolbox; no licence table exists yet."],
    ["Legal", "Drone flights over the village may need more than the A1/A3 certificate, plus airspace and DSGVO steps. Not yet clarified."],
    ["Photo-based recognition", "Recognising each building from 10 to 15 photos is a retrieval problem plus a geometric check, not a classifier trained per building. GPS and compass already identify most photos. The photo set will cover a sample of buildings, not all 1647, and look-alike buildings (garages, identical houses) are the main risk."],
    ["Existing GIS data", "No ready-made ArcMap/ArcGIS project for Etteln was found. The official sources are the cadastre (ALKIS) and the Energieatlas. ALKIS has no number of floors and no roof or height data (LoD2 would add roof shape and height, not yet loaded). The Energieatlas (Stand 2021-12-31) lists only registered plants: 22 PV plants near Etteln versus the 230+ PV roofs the strategy mentions."],
    ["Vector coverage", "Cadastral vectors cover only a 350 m area around the Gemeindehalle. Positions come from the cadastre (decimetre-level, not surveyed as-built). Equipment and attribute values are not collected yet, and the village-wide area is not loaded."],
    ["Pilot area", "The 120 m pilot box around the Gemeindehalle is a placeholder, not an agreed site."]
  ],
  // live sensors: layer id -> FROST ObservedProperty name
  frost: { water: "Water Level", clothing: "Filling Level", bike: "Fahrrad" },
  center: { lat: 51.6286, lon: 8.7635, zoom: 16 }, // Gemeindehalle area, from the VC Map viewpoints (earlier 51.512/8.745 was wrong)
  layers: [
    { id: "water", name: "Water levels", color: "#2a7de1", text: "Groundwater and water-level sensors; basis for the flood early-warning use case." },
    { id: "clothing", name: "Clothing containers", color: "#8e44ad", text: "Clothing collection containers shown as a layer in VC Map." },
    { id: "bike", name: "Bicycle counters", color: "#e67e22", text: "Counting stations for bicycle traffic." },
    { id: "buildings", name: "Building scans", color: "#7f8c8d", text: "Scanned buildings, used e.g. to simulate construction projects." },
    { id: "street", name: "Street-scan point clouds", color: "#16a085", text: "Point clouds captured along streets." },
    { id: "mesh", name: "3D meshes", color: "#c0392b", text: "Textured 3D model of the village. The drone-based textured point cloud was connected to the platform." }
  ],
  facts: [
    ["Name", "DiDoZ, Digitaler Dorf Zwilling"],
    ["Place", "Etteln, district of Borchen, Kreis Paderborn, NRW"],
    ["Duration", "1 Nov 2022 – 31 Oct 2025"],
    ["Lead", "Municipality of Borchen"],
    ["Funding", "about €1.3M, BMEL"],
    ["Platform", "VC Map (Virtual City Systems)"],
    ["Award", "IEEE Smart City Award 2024, first place (31 Oct 2024), per press"]
  ],
  people: [
    ["Municipality of Borchen", "Project lead"],
    ["Virtual City Systems", "VC Map provider"],
    ["svGeosolutions", "Involved in the twin"],
    ["FIWARE Foundation", "Partner"],
    ["Gaia-X", "Partner"],
    ["Fraunhofer IEE", "Partner"],
    ["dena", "Partner"]
  ],
  sources: [
    ["Kreis Paderborn: ALKIS-Daten der Gemeinde Borchen (Shape, open data, no owner data)", "https://www.kreis-paderborn.de/opendata/alkis/pakete_pro_gemeinde/Borchen_SHAPE.html"],
    ["Open.NRW catalogue entry: ALKIS-Daten der Gemeinde Borchen", "https://ckan.open.nrw.de/dataset/361fd93e-3530-4551-9498-29ffd8db9cf3"],
    ["Energieatlas NRW (LANUV): renewable plants, copy hosted on the Etteln platform", null],
    ["Open.NRW: Grundrissdaten vereinfacht (ALKIS buildings and parcels, one GeoPackage per Kreis, dl-de/zero-2.0)", "https://www.opengeodata.nrw.de/produkte/geobasis/lk/akt/gru_vereinfacht_gpkg/"],
    ["Geobasis NRW: ALKIS vereinfacht WFS (used for the QGIS vectors)", "https://www.wfs.nrw.de/geobasis/wfs_nw_alkis_vereinfacht?service=WFS&request=GetCapabilities"],
    ["Datenlizenz Deutschland Zero 2.0", "https://www.govdata.de/dl-de/zero-2-0"],
    ["vc.systems: Etteln article and Digitaler Dorfzwilling page", null],
    ["business-geomatics.com article", null],
    ["borchen.de DiDoZ page", null],
    ["kommunal.de Datenraum article", null],
    ["leinetal24: IEEE Smart City Award", "https://www.leinetal24.de/welt/wettbewerb-etteln-nrw-digitalstes-dorf-deutschlands-auszeichnung-vor-hongkong-borchen-paderborn-zr-93429536.html"],
    ["inside-digital: Das smarteste Dorf der Welt", "https://www.inside-digital.de/news/das-smarteste-dorf-der-welt-unterwegs-in-etteln"]
  ]
};
