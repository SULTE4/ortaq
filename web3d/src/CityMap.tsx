import { useEffect, useRef, useState } from "react";
import { createRoot, events, extend, type RootState } from "@react-three/fiber";
import * as THREE from "three";
import maplibregl, {
  type CustomLayerInterface,
  type GeoJSONSource,
  type Map as City,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BuildingContext } from "./BuildingContext";
import {
  bearing,
  isSauran,
  modelFor,
  sauran,
  validBuilding,
  type ManagedBuilding,
  type BuildingModel,
} from "./buildingModel";
import { DetailedScene } from "./Scene";
import { useView } from "./store";
import { cityStyle, managedFilter } from "./mapStyle";
import { activePalette } from "./palette";
import { parentOrigins } from "./session";
import { cameraAt } from "./cinematic";
import { useReducedMotion } from "./useReducedMotion";
import { mapFitZoom } from "./framing";
import {
  insideRing,
  polygons,
  repairBuildings,
  screenPolygon,
  interiorPoint,
} from "./tileBuildings";
import { floorHeight } from "./domain";
import type { Vec3 } from "./types";

extend(THREE);
const dev = (import.meta as unknown as { env: { DEV: boolean } }).env.DEV;
export type PickedBuilding = {
  osm_id: number;
  address: string;
  levels: number;
  lat: number;
  lon: number;
  footprint: [number, number][];
  already_managed?: boolean;
};
async function api(path: string, token = "", signal?: AbortSignal) {
  const response = await fetch("/api/v1" + path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Object.assign(
      new Error(
        value.error ||
          (response.status === 404
            ? "No building found here. Click its outline on the map."
            : "Map service busy or no internet. Please try again."),
      ),
      { status: response.status },
    );
  return value;
}
async function managedBuildings(
  signal: AbortSignal,
  token: string,
): Promise<ManagedBuilding[]> {
  try {
    const data = await api("/buildings/map", "", signal);
    if (!Array.isArray(data))
      throw new Error("Building map unavailable. Please try again.");
    return data.filter(validBuilding);
  } catch (error) {
    if (!dev || (error as { status: number }).status !== 404) throw error;
    let building;
    try {
      building = await api("/building", token, signal);
    } catch {
      try {
        const response = await fetch("/api/building", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal,
        });
        if (response.ok) building = await response.json();
      } catch {}
    }
    return [
      {
        ...sauran,
        ...(building?.id === 1 ? building : {}),
        lat: sauran.lat,
        lon: sauran.lon,
        footprint: sauran.footprint,
        osm_id: sauran.osm_id,
      },
    ];
  }
}
export function modelMatrix(b: ManagedBuilding): THREE.Matrix4 {
  const origin = maplibregl.MercatorCoordinate.fromLngLat([b.lon, b.lat]);
  const scale = origin.meterInMercatorCoordinateUnits() * 2.5,
    c = Math.cos(bearing),
    s = Math.sin(bearing);
  return new THREE.Matrix4().set(
    scale * c,
    0,
    -scale * s,
    origin.x,
    -scale * s,
    0,
    -scale * c,
    origin.y,
    0,
    scale,
    0,
    0,
    0,
    0,
    0,
    1,
  );
}
function sceneCoordinate(b: ManagedBuilding, p: Vec3) {
  const v = new THREE.Vector3(...p).applyMatrix4(modelMatrix(b));
  return new maplibregl.MercatorCoordinate(v.x, v.y, v.z).toLngLat();
}
function ManagedModels({
  buildings,
  active,
  interactiveId,
}: {
  buildings: ManagedBuilding[];
  active: ManagedBuilding;
  interactiveId: number | null;
}) {
  const city = useView((v) => v.city);
  const inverse = modelMatrix(active).invert();
  return (
    <>
      {buildings.map((b) => {
        const model = modelFor(b),
          interactive =
            b.id === interactiveId &&
            (isSauran(b) ||
              (b.apartments !== undefined && b.entrances !== undefined));
        return (
          <group
            key={b.id}
            matrix={inverse.clone().multiply(modelMatrix(b))}
            matrixAutoUpdate={false}
          >
            <BuildingContext.Provider value={model}>
              <DetailedScene interactive={interactive && !city} />
            </BuildingContext.Provider>
          </group>
        );
      })}
    </>
  );
}
function clearArea(map: City, focused: boolean, cinematic: boolean) {
  const width = map.getContainer().clientWidth,
    height = map.getContainer().clientHeight;
  if (cinematic) {
    const r = document.querySelector(".cinema-frame")?.getBoundingClientRect();
    if (r?.width && r.height)
      return {
        left: r.left,
        top: r.top,
        right: width - r.right,
        bottom: height - r.bottom,
      };
  }
  if (
    new URLSearchParams(location.search).get("embed") === "resident" ||
    new URLSearchParams(location.search).get("mini") === "1"
  )
    return { left: 26, right: 26, top: 44, bottom: 18 };
  if (width <= 600) {
    const sheet = document
      .querySelector(".scene-details.is-open")
      ?.getBoundingClientRect();
    return {
      left: 18,
      right: 18,
      top: focused ? 158 : 280,
      bottom: sheet ? height - sheet.top + 18 : 160,
    };
  }
  const panel = document
    .querySelector(".right-panel, .apartment-note")
    ?.getBoundingClientRect();
  const title = document.querySelector(".scene-title")?.getBoundingClientRect();
  return {
    left: focused ? 24 : width > 900 ? Math.max(336, (title?.right ?? 330) + 18) : 24,
    right: panel && width > 900 ? width - panel.left + 18 : 24,
    top: width > 900 ? 92 : 340,
    bottom: 92,
  };
}
function frameBuilding(
  map: City,
  model: BuildingModel,
  reduced: boolean,
  instant = false,
  buildings: ManagedBuilding[] = [model.building],
) {
  const view = useView.getState();
  if (view.city) {
    const bounds = new maplibregl.LngLatBounds();
    buildings.forEach((b) => b.footprint.forEach((p) => bounds.extend(p)));
    map.fitBounds(bounds, {
      linear: reduced || instant,
      maxZoom: 13.6,
      pitch: 45,
      bearing: -20,
      padding: {
        top: 135,
        bottom: 100,
        left: map.getContainer().clientWidth > 900 ? 350 : 20,
        right: 20,
      },
      duration: reduced || instant ? 0 : 1200,
    });
    return;
  }
  const isCompact =
    new URLSearchParams(location.search).get("embed") === "resident" ||
    new URLSearchParams(location.search).get("mini") === "1";
  const issue = view.snapshot?.issues.find((i) => i.id === view.selected);
  const focused = view.focus !== null || !!issue,
    padding = clearArea(map, focused, view.cinematic);
  const width = map.getContainer().clientWidth,
    height = map.getContainer().clientHeight;
  let points: [number, number][] =
    isCompact && !focused && isSauran(model.building)
      ? [...model.footprint, [20.4, -6.5], [-13.2, 8.6], [19.5, 8.6]]
      : model.footprint;
  let target: Vec3 =
      isCompact && !focused && isSauran(model.building)
        ? [3.5, model.height / 2, 0.8]
        : [2, model.height / 2, 0],
    zoomBonus = isCompact && !focused ? -0.24 : 0,
    bearingValue = isSauran(model.building)
      ? 230
      : (model.entrances[0].rotation * 180) / Math.PI -
        (bearing * 180) / Math.PI +
        205;
  if (focused) {
    const entrance =
      view.focus !== null
        ? model.location(view.focus).entrance
        : issue!.location.entrance;
    const e = model.entrances[Math.max(0, entrance - 1)] ?? model.entrances[0];
    target = [e.position[0], model.height / 2, e.position[2]];
    const length = Math.max(8, e.length),
      c = Math.cos(e.rotation),
      s = Math.sin(e.rotation);
    points = [-length / 2, length / 2].flatMap((along) =>
      [-1, 1].map(
        (depth) =>
          [
            e.position[0] + along * c + depth * s,
            e.position[2] - along * s + depth * c,
          ] as [number, number],
      ),
    );
    bearingValue =
      (e.rotation * 180) / Math.PI - (bearing * 180) / Math.PI + 205;
    zoomBonus = -0.65;
  }
  let subjectHeight = model.height,
    subjectY = model.height / 2;
  if (view.focus !== null) {
    const cell = model.cells.find((c) => c.apartment === view.focus);
    if (cell) {
      target = cell.centre;
      points = cell.outline;
      subjectHeight = Math.max(floorHeight * 4, model.height * 0.55);
      subjectY = cell.centre[1];
      zoomBonus = -0.5;
    }
  }
  let pitch = 58;
  if (view.money) {
    target = [-5, 5, 0];
    points = [...points, [-28, 4]];
  }
  if (view.cinematic && isSauran(model.building)) {
    const t = reduced ? Math.floor(view.time / 10) * 10 : view.time,
      shot = cameraAt(t);
    target = shot.target;
    const dx = shot.position[0] - target[0],
      dz = shot.position[2] - target[2];
    bearingValue =
      180 + (Math.atan2(dx, dz) * 180) / Math.PI - (bearing * 180) / Math.PI;
    pitch = Math.min(
      62,
      Math.max(
        45,
        (Math.atan2(Math.hypot(dx, dz), shot.position[1] - target[1]) * 180) /
          Math.PI,
      ),
    );
    if (t >= 10 && t < 50) {
      const e = model.entrances[1];
      points = [
        [e.position[0] - 7, -3],
        [e.position[0] + 7, 0],
      ];
      zoomBonus = -0.45;
    }
    if (t >= 50 && t < 60) points = [...points, [-29, 4]];
    if (t >= 80) zoomBonus = -1.8 * Math.min(1, (t - 76) / 8);
  }
  const clearWidth = Math.max(150, width - padding.left - padding.right),
    clearHeight = Math.max(150, height - padding.top - padding.bottom);
  const eastNorth = points.map(
    ([x, z]) =>
      [
        (x * Math.cos(bearing) - z * Math.sin(bearing)) * 2.5,
        (x * Math.sin(bearing) + z * Math.cos(bearing)) * 2.5,
      ] as [number, number],
  );
  const zoom =
    mapFitZoom(
      eastNorth,
      subjectHeight * 2.5,
      model.building.lat,
      bearingValue,
      pitch,
      clearWidth,
      clearHeight,
    ) + zoomBonus;
  const centre = sceneCoordinate(model.building, target);
  const metresPerPixel =
    (40075016.686 * Math.cos((model.building.lat * Math.PI) / 180)) /
    (512 * 2 ** zoom);
  const roofOffset =
    ((subjectY * 2 * 2.5) / metresPerPixel) *
    Math.sin((pitch * Math.PI) / 180) *
    0.45;
  const move =
    reduced || instant || view.cinematic
      ? map.easeTo.bind(map)
      : map.flyTo.bind(map);
  move({
    center: centre,
    zoom,
    bearing: bearingValue,
    pitch,
    padding,
    offset: [0, roofOffset],
    duration: reduced || instant ? 0 : view.cinematic ? 120 : 1200,
    essential: false,
  });
}

export function Scene({
  token = "",
  picker = false,
}: {
  token?: string;
  picker?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null!);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const lookupRef = useRef<AbortController>();
  const projectionRef = useRef(new THREE.Matrix4());
  const mapRef = useRef<City>();
  const [mapReady, setMapReady] = useState(false),
    [offline, setOffline] = useState(false);
  const [buildings, setBuildings] = useState<ManagedBuilding[]>([]),
    [error, setError] = useState("");
  const [chosenId, setChosenId] = useState<number | null>(null);
  const [picked, setPicked] = useState<PickedBuilding | null>(null),
    [busy, setBusy] = useState(false);
  const view = useView(),
    reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const registry = useRef<ManagedBuilding[]>([]),
    activeRef = useRef<ManagedBuilding>();
  const rootRef = useRef<ReturnType<typeof createRoot>>(),
    stateRef = useRef<RootState>();
  const activeScene = view.cinematic
    ? buildings.find(isSauran)
    : view.snapshot?.building ?? buildings.find((b) => b.id === chosenId);
  let active = activeScene
    ? validBuilding(activeScene)
      ? activeScene
      : buildings.find((b) => b.id === activeScene.id)
    : buildings.find(isSauran) ?? buildings[0];
  if (active && activeScene?.id === active.id)
    active = {
      ...active,
      ...activeScene,
      lat: active.lat,
      lon: active.lon,
      footprint: active.footprint,
    };
  const activeKey = JSON.stringify(active);
  registry.current = buildings.map((b) => (b.id === active?.id ? active! : b));
  if (active && !registry.current.some((b) => b.id === active.id))
    registry.current.push(active);
  activeRef.current = active ?? buildings.find(isSauran) ?? buildings[0];
  useEffect(() => {
    const controller = new AbortController();
    managedBuildings(controller.signal, token)
      .then(setBuildings)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [token]);
  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current,
      style: cityStyle(
        activePalette.defaultWinter,
        activePalette.defaultNight,
        [],
      ),
      center: [sauran.lon, sauran.lat],
      zoom: picker ? 16 : 13.6,
      pitch: picker ? 48 : 52,
      bearing: picker ? 0 : 28,
      attributionControl: false,
      canvasContextAttributes: { antialias: true, preserveDrawingBuffer: true },
      maxPitch: 65,
      minZoom: 9,
      maxZoom: 21,
      pixelRatio: Math.min(devicePixelRatio, 1.5),
      renderWorldCopies: false,
    });
    mapRef.current = map;
    if (dev) Object.assign(container.current, { ortaqMap: map });
    const unsubscribe = useView.subscribe(() => {
      animateUntil = performance.now() + 450;
      map.triggerRepaint();
    });
    let disposed = false,
      receivedTiles = false,
      hasLayer = false;
    let repaintTimer = 0,
      animateUntil = performance.now() + 450;
    let repairTimer = 0,
      repairKey = "",
      needsRepair = true;
    const repair = () => {
      if (!map.getLayer("city-buildings") || disposed) return;
      const features = map.querySourceFeatures("city", {
        sourceLayer: "building",
      });
      const patch = repairBuildings(features, registry.current);
      const key = JSON.stringify(patch);
      if (key === repairKey) return;
      repairKey = key;
      for (const id of ["city-buildings", "city-roofs"])
        map.setFilter(id, [
          "all",
          managedFilter(registry.current),
          ["!", ["in", ["id"], ["literal", patch.ids]]],
        ]);
      (map.getSource("building-patches") as GeoJSONSource).setData(patch.data);
    };
    map.on("ortaq-refresh", () => {
      needsRepair = true;
      repair();
    });
    const timeout = window.setTimeout(() => {
      if (!receivedTiles && !disposed) setOffline(true);
    }, 6500);
    map.on("sourcedata", (e) => {
      if (e.sourceId === "city" && e.sourceDataType === "content") {
        needsRepair = true;
        clearTimeout(repairTimer);
        repairTimer = window.setTimeout(repair, 150);
      }
      if (
        e.sourceId === "city" &&
        e.sourceDataType === "content" &&
        map.querySourceFeatures("city", { sourceLayer: "building" }).length > 0
      ) {
        receivedTiles = true;
        clearTimeout(timeout);
        setOffline(false);
      }
    });
    map.on("render", () => {
      if (
        needsRepair &&
        map.getSource("city") &&
        map.isSourceLoaded("city") &&
        map.areTilesLoaded()
      ) {
        repair();
        needsRepair = false;
      }
      if (
        !receivedTiles &&
        map.getSource("city") &&
        map.isSourceLoaded("city") &&
        map.areTilesLoaded() &&
        map.querySourceFeatures("city", { sourceLayer: "building" }).length > 0
      ) {
        receivedTiles = true;
        clearTimeout(timeout);
        setOffline(false);
      }
    });
    map.on("moveend", repair);
    map.on("error", () => {});
    map.on("style.load", () => {
      if (disposed || hasLayer) return;
      hasLayer = true;
      const layer: CustomLayerInterface = {
        id: "ortaq-managed",
        type: "custom",
        renderingMode: "3d",
        onAdd: (_map, context) => {
          const renderer = new THREE.WebGLRenderer({
            canvas: map.getCanvas(),
            context: context as WebGL2RenderingContext,
            antialias: true,
          });
          renderer.autoClear = false;
          renderer.shadowMap.enabled = false;
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          const camera = new THREE.PerspectiveCamera();
          Object.assign(camera, { manual: true });
          const root = createRoot(map.getCanvas());
          rootRef.current = root;
          root.configure({
            gl: renderer,
            camera,
            frameloop: "never",
            dpr: map.getPixelRatio(),
            events,
            size: {
              width: container.current.clientWidth,
              height: container.current.clientHeight,
              top: 0,
              left: 0,
            },
            onCreated: (state) => {
              stateRef.current = state;
              if (dev) Object.assign(container.current, { ortaqState: state });
              state.events.connect?.(map.getCanvasContainer());
            },
          });
          root.render(
            <ManagedModels
              buildings={registry.current}
              active={activeRef.current ?? sauran}
              interactiveId={picker ? null : activeRef.current?.id ?? null}
            />,
          );
        },
        render: (_gl, args) => {
          projectionRef.current.fromArray(
            args.defaultProjectionData.mainMatrix as unknown as number[],
          );
          const state = stateRef.current,
            active = activeRef.current;
          if (!state || !active) return;
          const matrix = projectionRef.current
            .clone()
            .multiply(modelMatrix(active));
          const inverse = matrix.clone().invert();
          const eye = new THREE.Vector4(0, 0, 1, 0).applyMatrix4(inverse);
          eye.multiplyScalar(1 / eye.w);
          const forward = new THREE.Vector3(0, 0, 0).applyMatrix4(inverse);
          const camera = state.camera;
          camera.position.set(eye.x, eye.y, eye.z);
          camera.up.set(0, 1, 0);
          camera.lookAt(forward);
          camera.updateMatrixWorld(true);
          camera.projectionMatrix.copy(matrix).multiply(camera.matrixWorld);
          camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
          state.gl.autoClear = false;
          state.gl.resetState();
          state.advance(performance.now() / 1000, true);
          const v = useView.getState();
          if (
            !reducedRef.current &&
            ((v.cinematic && v.playing) || performance.now() < animateUntil)
          ) {
            clearTimeout(repaintTimer);
            repaintTimer = window.setTimeout(() => {
              if (!disposed) map.triggerRepaint();
            }, 16);
          }
        },
        onRemove: () => {
          rootRef.current?.unmount();
          rootRef.current = undefined;
          stateRef.current = undefined;
        },
      };
      map.addLayer(layer);
      setMapReady(true);
    });
    const resize = new ResizeObserver(() => {
      if (disposed) return;
      map.resize();
      stateRef.current?.setSize(
        container.current.clientWidth,
        container.current.clientHeight,
      );
      if (activeRef.current && !picker)
        frameBuilding(
          map,
          modelFor(activeRef.current),
          reducedRef.current,
          true,
          registry.current,
        );
    });
    resize.observe(container.current);
    const pick = async (lat: number, lon: number) => {
      if (!tokenRef.current) {
        setError("Sign in to management to select a building.");
        return;
      }
      lookupRef.current?.abort();
      const controller = new AbortController();
      lookupRef.current = controller;
      setBusy(true);
      setError("");
      setPicked(null);
      try {
        const building = await api(
          `/geo/building?lat=${lat}&lon=${lon}`,
          tokenRef.current,
          controller.signal,
        );
        if (!disposed && !controller.signal.aborted) setPicked(building);
      } catch (e) {
        if (!disposed && !controller.signal.aborted)
          setError((e as Error).message);
      } finally {
        if (!disposed && lookupRef.current === controller) setBusy(false);
      }
    };
    if (picker) {
      const hovered = (point: maplibregl.PointLike, lngLat: maplibregl.LngLat) => {
        if (!map.getLayer("building-pick")) return;
        const features = map.queryRenderedFeatures(point, {
          layers: [
            "city-buildings",
            "city-building-patches",
            "building-pick",
          ],
        });
        const project = (p: number[], height: number) => {
          const coordinate = maplibregl.MercatorCoordinate.fromLngLat(
            [p[0], p[1]],
            height,
          );
          const v = new THREE.Vector3(
            coordinate.x,
            coordinate.y,
            coordinate.z,
          ).applyMatrix4(projectionRef.current);
          return [
            ((v.x + 1) * container.current.clientWidth) / 2,
            ((1 - v.y) * container.current.clientHeight) / 2,
          ];
        };
        for (const feature of features) {
          const polygon = screenPolygon(
            feature,
            [
              maplibregl.Point.convert(point).x,
              maplibregl.Point.convert(point).y,
            ],
            project,
          );
          if (polygon) return polygon;
        }
        return features
          .flatMap((f) => polygons(f.geometry))
          .find((p) => insideRing([lngLat.lng, lngLat.lat], p[0]));
      };
      map.on("mousemove", (e) => {
        const polygon = hovered(e.point, e.lngLat);
        (map.getSource("hover") as GeoJSONSource)?.setData({
          type: "FeatureCollection",
          features: polygon
            ? [
                {
                  type: "Feature",
                  properties: {},
                  geometry: { type: "Polygon", coordinates: polygon },
                },
              ]
            : [],
        });
        map.getCanvas().style.cursor = polygon ? "pointer" : "";
      });
      map.on("click", (e) => {
        const polygon = hovered(e.point, e.lngLat);
        const point = polygon
          ? interiorPoint(polygon)
          : [e.lngLat.lng, e.lngLat.lat];
        void pick(point[1], point[0]);
      });
    }
    const message = (event: MessageEvent) => {
      if (
        !picker ||
        event.source !== window.parent ||
        !parentOrigins.includes(event.origin)
      )
        return;
      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (
          data?.type === "ortaq:picker-focus" &&
          Number.isFinite(data.lat) &&
          Math.abs(data.lat) <= 85 &&
          Number.isFinite(data.lon) &&
          Math.abs(data.lon) <= 180
        ) {
          setPicked(null);
          setError("");
          map.flyTo({
            center: [data.lon, data.lat],
            zoom: 18,
            pitch: 45,
            duration: reducedRef.current ? 0 : 1200,
          });
        }
      } catch {}
    };
    window.addEventListener("message", message);
    return () => {
      disposed = true;
      lookupRef.current?.abort();
      unsubscribe();
      clearTimeout(timeout);
      clearTimeout(repaintTimer);
      clearTimeout(repairTimer);
      resize.disconnect();
      window.removeEventListener("message", message);
      map.remove();
      setMapReady(false);
    };
  }, [picker]);
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const style = cityStyle(view.winter, view.night, buildings);
    map.setLight(style.light!);
    for (const layer of style.layers)
      if (map.getLayer(layer.id)) {
        for (const [key, value] of Object.entries(layer.paint ?? {})) {
          if (/-(color|opacity)$/.test(key))
            map.setPaintProperty(layer.id, key + "-transition", {
              duration: reduced ? 0 : 220,
              delay: 0,
            });
          map.setPaintProperty(layer.id, key, value);
        }
      }
    if (offline) {
      map.setPaintProperty(
        "night-ground",
        "background-color",
        view.night ? "#222933" : "#E7EDF3",
      );
    }
    for (const layer of style.layers)
      if (
        "source" in layer &&
        (layer.source === "city" || layer.source === "building-patches")
      ) {
        const key =
          layer.type === "line"
            ? "line-opacity"
            : layer.type === "symbol"
              ? "text-opacity"
              : layer.type === "fill-extrusion"
                ? "fill-extrusion-opacity"
                : "fill-opacity";
        map.setPaintProperty(
          layer.id,
          key,
          offline ? 0 : (layer.paint as Record<string, unknown>)?.[key] ?? 1,
        );
      }
    map.triggerRepaint();
  }, [mapReady, offline, view.winter, view.night, buildings, reduced]);
  useEffect(() => {
    const origin = activeRef.current;
    if (!mapReady || !origin) return;
    rootRef.current?.render(
      <ManagedModels
        buildings={registry.current}
        active={origin}
        interactiveId={picker ? null : active?.id ?? null}
      />,
    );
    mapRef.current?.fire("ortaq-refresh");
    if (!picker && active) {
      useView.getState().set({
        mapBuilding: isSauran(active) ? modelFor(active).building : active,
      });
    }
    if (!picker && active)
      frameBuilding(
        mapRef.current!,
        modelFor(active),
        reduced,
        false,
        registry.current,
      );
    const sheet = document.querySelector(".scene-details");
    const observer = new ResizeObserver(() => {
      if (!picker && active)
        frameBuilding(
          mapRef.current!,
          modelFor(active),
          reduced,
          true,
          registry.current,
        );
    });
    if (sheet) observer.observe(sheet);
    mapRef.current?.triggerRepaint();
    return () => observer.disconnect();
  }, [
    mapReady,
    activeKey,
    buildings,
    picker,
    reduced,
    view.focus,
    view.selected,
    view.money,
    view.cameraReset,
    view.cinematic,
    view.city,
  ]);
  useEffect(() => {
    if (!mapReady || !view.cinematic || !active || picker) return;
    frameBuilding(mapRef.current!, modelFor(active), reduced, !view.playing);
    mapRef.current?.triggerRepaint();
  }, [view.time, mapReady, picker]);
  useEffect(() => {
    if (!mapReady || !active || token || picker || reduced) return;
    const map = mapRef.current!;
    const bounds = new maplibregl.LngLatBounds();
    registry.current.forEach((b) =>
      b.footprint.forEach((p) => bounds.extend(p)),
    );
    map.fitBounds(bounds, {
      maxZoom: 13.6,
      pitch: 48,
      bearing: -20,
      padding: {
        top: 135,
        bottom: 100,
        left: container.current.clientWidth > 900 ? 350 : 20,
        right: 20,
      },
      duration: 0,
      linear: true,
    });
    let started = false,
      timer = 0;
    const arrive = (instant = false) => {
      if (!useView.getState().city && activeRef.current?.id === active.id)
        frameBuilding(map, modelFor(active!), reduced, instant);
    };
    const ready = () => {
      if (
        started ||
        !map.getSource("city") ||
        !map.isSourceLoaded("city") ||
        !map.areTilesLoaded() ||
        !map.querySourceFeatures("city", { sourceLayer: "building" }).length
      )
        return;
      started = true;
      timer = window.setTimeout(() => arrive(), 800);
    };
    map.on("render", ready);
    ready();
    const fallback = window.setTimeout(() => {
      if (!started) {
        started = true;
        arrive(true);
      }
    }, 6000);
    return () => {
      map.off("render", ready);
      clearTimeout(timer);
      clearTimeout(fallback);
    };
  }, [mapReady, !!active, token, picker, reduced]);
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current!;
    const markers =
      (!token || picker) &&
      !view.cinematic &&
      view.focus === null &&
      !view.selected &&
      !view.money
        ? buildings.map((b) => {
            const el = document.createElement("button");
            el.className = "managed-map-label";
            el.textContent = b.address;
            el.setAttribute("aria-label", `View ${b.address}`);
            el.onclick = () => {
              if (!picker) {
                setChosenId(b.id);
                useView.getState().set({
                  city: false,
                  focus: null,
                  selected: null,
                  cameraReset: useView.getState().cameraReset + 1,
                });
              }
            };
            return new maplibregl.Marker({ element: el, anchor: "bottom" })
              .setLngLat([b.lon, b.lat])
              .addTo(map);
          })
        : [];
    return () => markers.forEach((m) => m.remove());
  }, [
    mapReady,
    buildings,
    token,
    picker,
    view.cinematic,
    view.focus,
    view.selected,
    view.money,
    reduced,
  ]);
  return (
    <>
      <div
        className="city-map"
        ref={container}
        aria-label={
          picker ? "Choose a real building on the map" : "Live map of Astana"
        }
      />
      {offline && (
        <div className="map-notice" role="status">
          Map unavailable offline
        </div>
      )}
      {picker && (
        <>
          <div className="picker-instructions">
            <strong>Find your building</strong>
            <span>
              Click its real outline to check the address and floors.
            </span>
          </div>
          {(busy || picked || error) && (
            <section className="picker-card" aria-live="polite">
              {busy ? (
                <p>Looking up this building…</p>
              ) : error ? (
                <p role="alert">{error}</p>
              ) : (
                picked && (
                  <>
                    <small>OpenStreetMap building</small>
                    <h2>{picked.address || "Address not mapped"}</h2>
                    <p>
                      {picked.levels
                        ? `${picked.levels} floors`
                        : "Floor count not mapped. Set it in the form."}
                    </p>
                    {picked.already_managed ? (
                      <p role="alert">This building is already managed.</p>
                    ) : (
                      <button
                        disabled={!picked.address}
                        onClick={() =>
                          window.parent.postMessage(
                            { type: "ortaq:building-picked", building: picked },
                            `http://${location.hostname}:8082`,
                          )
                        }
                      >
                        This is the building
                      </button>
                    )}
                  </>
                )
              )}
              <button
                className="text-button"
                onClick={() => {
                  lookupRef.current?.abort();
                  setBusy(false);
                  setPicked(null);
                  setError("");
                }}
              >
                Close
              </button>
            </section>
          )}
        </>
      )}
      {!picker && !active && view.snapshot && (
        <div className="map-error" role="status">
          This building has no mapped outline yet. Choose its outline in
          management.
        </div>
      )}
      {!picker && error && (
        <div className="map-error" role="alert">
          {error}
        </div>
      )}
      <div className="map-attribution">
        (c) OpenMapTiles (c) OpenStreetMap contributors
      </div>
    </>
  );
}
