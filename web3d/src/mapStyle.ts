import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";
import type { ManagedBuilding } from "./buildingModel.ts";
import { activePalette } from "./palette.ts";

export const tileHost = "https://tiles.openfreemap.org";
export function managedFilter(
  buildings: ManagedBuilding[],
): ExpressionSpecification {
  const masks = buildings.map((b) => {
    const ring = b.footprint.map(([x, y]) => [
      b.lon + (x - b.lon) * 1.08,
      b.lat + (y - b.lat) * 1.08,
    ]);
    return [
      "!",
      ["within", { type: "Polygon", coordinates: [[...ring, ring[0]]] }],
    ];
  });
  return ["all", ...masks] as ExpressionSpecification;
}
export const facadePalette = activePalette.map.neighborFacades;
export function buildingTint(night: boolean): ExpressionSpecification {
  const hash: ExpressionSpecification = [
    "%",
    [
      "floor",
      [
        "abs",
        [
          "+",
          ["*", ["to-number", ["id"], 0], 31],
          ["*", ["to-number", ["get", "render_height"], 6], 17],
        ],
      ],
    ],
    facadePalette.length,
  ];
  const fallback = [
    "match",
    hash,
    ...facadePalette.slice(0, -1).flatMap((color, i) => [i, color]),
    facadePalette[4],
  ] as ExpressionSpecification;
  const facade: ExpressionSpecification = [
    "to-color",
    ["get", "colour"],
    fallback,
  ];
  if (!night) return facade as ExpressionSpecification;
  const [mr, mg, mb] = activePalette.map.nightMult;
  return [
    "let",
    "rgb",
    ["to-rgba", facade],
    [
      "rgb",
      ["*", ["at", 0, ["var", "rgb"]], mr],
      ["*", ["at", 1, ["var", "rgb"]], mg],
      ["*", ["at", 2, ["var", "rgb"]], mb],
    ],
  ] as ExpressionSpecification;
}
export function cityStyle(
  winter: boolean,
  night: boolean,
  buildingsOrReduced: boolean | ManagedBuilding[] = [],
  maybeBuildings?: ManagedBuilding[],
): StyleSpecification {
  const buildings = Array.isArray(buildingsOrReduced)
    ? buildingsOrReduced
    : (maybeBuildings ?? []);
  const m = activePalette.map;
  const land = night
    ? winter
      ? m.snowGroundNight
      : "#2B3630"
    : winter
      ? m.snowGroundDay
      : "#DFE4D9";
  const road = night ? m.roadNight : m.roadDay;
  const source = { source: "city", "source-layer": "transportation" };
  return {
    version: 8,
    glyphs: `${tileHost}/fonts/{fontstack}/{range}.pbf`,
    sources: {
      city: {
        type: "vector",
        url: `${tileHost}/planet`,
        attribution: "(c) OpenMapTiles (c) OpenStreetMap contributors",
      },
      "building-patches": {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
      hover: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
    },
    light: {
      anchor: "viewport",
      color: night ? "#DCE2EA" : "#FAFBFD",
      intensity: night ? 0.34 : 0.36,
      position: [1.5, 200, 35],
    },
    transition: { duration: 220, delay: 0 },
    layers: [
      { id: "night-ground", type: "background", paint: { "background-color": land } },
      {
        id: "blocks",
        type: "fill",
        source: "city",
        "source-layer": "landuse",
        paint: {
          "fill-color": night
            ? winter
              ? m.blockNight
              : "#383B35"
            : winter
              ? m.blockDay
              : "#D5DBD0",
          "fill-opacity": 0.58,
        },
      },
      {
        id: "parks",
        type: "fill",
        source: "city",
        "source-layer": "park",
        paint: {
          "fill-color": winter
            ? night
              ? m.parkNight
              : m.parkDay
            : night
              ? "#29382E"
              : "#C4D6BD",
          "fill-opacity": 0.68,
        },
      },
      {
        id: "landcover",
        type: "fill",
        source: "city",
        "source-layer": "landcover",
        paint: {
          "fill-color": winter
            ? night
              ? m.parkNight
              : m.parkDay
            : night
              ? "#2D3C31"
              : "#CADBC3",
          "fill-opacity": 0.45,
        },
      },
      {
        id: "water",
        type: "fill",
        source: "city",
        "source-layer": "water",
        paint: {
          "fill-color": winter
            ? night
              ? m.waterNight
              : m.waterDay
            : night
              ? "#1E303D"
              : "#B2CEDE",
        },
      },
      {
        id: "waterways",
        type: "line",
        source: "city",
        "source-layer": "waterway",
        paint: {
          "line-color": winter
            ? night
              ? m.waterNight
              : m.waterDay
            : night
              ? "#1E303D"
              : "#B2CEDE",
          "line-width": 2,
        },
      },
      {
        id: "roads-casing",
        type: "line",
        ...source,
        filter: ["!=", ["get", "class"], "path"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": night ? m.roadCasingNight : m.roadCasingDay,
          "line-width": [
            "interpolate",
            ["exponential", 1.7],
            ["zoom"],
            11,
            1,
            16,
            [
              "match",
              ["get", "class"],
              ["motorway", "trunk"],
              20,
              ["primary", "secondary"],
              15,
              ["tertiary", "minor"],
              9,
              5,
            ],
            19,
            70,
          ],
        },
      },
      {
        id: "roads",
        type: "line",
        ...source,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": [
            "match",
            ["get", "class"],
            ["path", "pedestrian", "footway", "steps"],
            night ? m.footwayNight : m.footwayDay,
            road,
          ],
          "line-width": [
            "interpolate",
            ["exponential", 1.7],
            ["zoom"],
            11,
            0.5,
            16,
            [
              "match",
              ["get", "class"],
              ["motorway", "trunk"],
              15,
              ["primary", "secondary"],
              10,
              ["tertiary", "minor"],
              6,
              ["path", "pedestrian"],
              1,
              3,
            ],
            19,
            60,
          ],
        },
      },
      {
        id: "road-markings",
        type: "line",
        ...source,
        minzoom: 15,
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["motorway", "trunk", "primary", "secondary"]],
        ],
        paint: {
          "line-color": night ? m.roadMarkingNight : m.roadMarkingDay,
          "line-width": ["interpolate", ["linear"], ["zoom"], 15, 0.5, 19, 1.2],
          "line-dasharray": [4, 6],
          "line-opacity": 0.38,
        },
      },
      {
        id: "building-pick",
        type: "fill",
        source: "city",
        "source-layer": "building",
        minzoom: 13,
        paint: { "fill-color": buildingTint(night), "fill-opacity": 1 },
      },
      {
        id: "city-buildings",
        type: "fill-extrusion",
        source: "city",
        "source-layer": "building",
        minzoom: 15,
        filter: managedFilter(buildings),
        paint: {
          "fill-extrusion-color": buildingTint(night),
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 1,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      {
        id: "city-building-patches",
        type: "fill-extrusion",
        source: "building-patches",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": buildingTint(night),
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 1,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      ...(["city-roofs", "city-patch-roofs"] as const).map((id) => ({
        id,
        type: "fill-extrusion" as const,
        source: id === "city-roofs" ? "city" : "building-patches",
        ...(id === "city-roofs"
          ? { "source-layer": "building", filter: managedFilter(buildings) }
          : {}),
        minzoom: 14,
        paint: {
          "fill-extrusion-color": night ? m.roofSnowNight : m.roofSnowDay,
          "fill-extrusion-base": [
            "coalesce",
            ["get", "render_height"],
            6,
          ] as ExpressionSpecification,
          "fill-extrusion-height": [
            "+",
            ["coalesce", ["get", "render_height"], 6],
            0.24,
          ] as ExpressionSpecification,
          "fill-extrusion-opacity": winter ? 1 : 0,
          "fill-extrusion-vertical-gradient": false,
        },
      })),
      {
        id: "building-hover",
        type: "line",
        source: "hover",
        paint: {
          "line-color": activePalette.building.homeGold,
          "line-width": 2.5,
          "line-opacity": 0.9,
        },
      },
      {
        id: "street-names",
        type: "symbol",
        source: "city",
        "source-layer": "transportation_name",
        minzoom: 14,
        layout: {
          "symbol-placement": "line",
          "text-field": [
            "coalesce",
            ["get", "name:kk"],
            ["get", "name:ru"],
            ["get", "name"],
          ],
          "text-font": ["Noto Sans Regular"],
          "text-size": 10.5,
          "text-max-angle": 25,
        },
        paint: {
          "text-color": night ? m.streetTextNight : m.streetTextDay,
          "text-halo-color": night ? m.streetHaloNight : m.streetHaloDay,
          "text-halo-width": 1.5,
          "text-opacity": 0.78,
        },
      },
      {
        id: "district-names",
        type: "symbol",
        source: "city",
        "source-layer": "place",
        maxzoom: 15,
        layout: {
          "text-field": [
            "coalesce",
            ["get", "name:kk"],
            ["get", "name:ru"],
            ["get", "name"],
          ],
          "text-font": ["Noto Sans Regular"],
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            12,
            14,
            15,
          ],
        },
        paint: {
          "text-color": night ? m.streetTextNight : m.streetTextDay,
          "text-halo-color": night ? m.streetHaloNight : m.streetHaloDay,
          "text-halo-width": 1.5,
          "text-opacity": 0.75,
        },
      },
    ],
  };
}
