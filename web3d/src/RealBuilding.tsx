import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  buildingFootprint,
  buildingHeight,
  entranceLayout,
  floorHeight,
  sauranSections,
} from "./domain";
import { Boxes, Box, type Solid } from "./SceneGeometry";
import { useBuildingModel } from "./BuildingContext";
import { isSauran } from "./buildingModel";
import { activePalette } from "./palette";
import { useView } from "./store";

function extrusion(height: number, snow = false) {
  const shape = new THREE.Shape(
    buildingFootprint.map(([x, z]) => new THREE.Vector2(x, -z)),
  );
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: snow,
    steps: 1,
    bevelThickness: 0.14,
    bevelSize: 0.22,
    bevelSegments: 2,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}
const walls = extrusion(buildingHeight);
const plinth = extrusion(floorHeight);
const roofSnow = extrusion(0.1, true);
const entranceSigns = entranceLayout.map(({ entrance }) => {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#2B505C";
  context.fillRect(0, 0, 128, 64);
  context.fillStyle = "#FBFCFE";
  context.font = 'bold 46px "Libre Franklin", Arial';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(entrance), 64, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
});

export function RealBuilding() {
  const model = useBuildingModel(),
    focus = useView((v) => v.focus),
    cinematic = useView((v) => v.cinematic);
  const group = useRef<THREE.Group>(null!);
  useLayoutEffect(() => {
    if (focus === null || cinematic) return;
    const originals = new Map<THREE.Color, THREE.Color>();
    group.current.traverse((object) => {
      const material = (object as THREE.Mesh).material;
      for (const m of material
        ? Array.isArray(material)
          ? material
          : [material]
        : []) {
        const color = (m as THREE.MeshStandardMaterial).color;
        if (color && !originals.has(color)) {
          originals.set(color, color.clone());
          color.multiplyScalar(0.84);
        }
      }
    });
    return () =>
      originals.forEach((original, color) => color.copy(original));
  }, [focus, cinematic, model]);
  return (
    <group ref={group}>
      {isSauran(model.building) &&
      model.building.floors === 9 &&
      model.entrances.length === 3 ? (
        <SauranBuilding />
      ) : (
        <MappedBuilding />
      )}
    </group>
  );
}

function SauranBuilding() {
  const { winter, night } = useView();
  const model = useBuildingModel();
  const b = activePalette.building;
  const snowColor = night ? "#C7D2DE" : b.roofSnow;
  const snowSideColor = night ? "#AEBAC8" : b.roofSnowSide;
  const sillDayNight = night ? "#C5D0DB" : b.sillColor;
  const details = useMemo(() => {
    const items: Solid[] = [];
    buildingFootprint.forEach(([x, z], i) => {
      const [bx, bz] = buildingFootprint[(i + 1) % buildingFootprint.length];
      const length = Math.hypot(bx - x, bz - z),
        angle = -Math.atan2(bz - z, bx - x);
      const sections = length > 20 ? 4 : length > 8 ? 2 : 1;
      for (let part = 0; part < sections; part++) {
        const t = (part + 0.5) / sections;
        items.push({
          at: [x + (bx - x) * t, 6, z + (bz - z) * t],
          size: [length / sections, 9.6, 0.065],
          rotation: [0, angle, 0],
          color: [b.tealMain, b.tealAlt, b.brickMain, b.brickAlt][part % 4],
        });
      }
      items.push({
        at: [(x + bx) / 2, 10.94, (z + bz) / 2],
        size: [length + 0.12, 0.28, 0.22],
        rotation: [0, angle, 0],
        color: b.tealDark,
      });
    });
    for (const [x, z] of [
      [-9.7, 4],
      [-9.7, -0.5],
      [-2, -4],
      [9, -4],
      [16, -4],
    ]) {
      items.push({
        at: [x, 11.65, z],
        size: [1.8, 1.25, 1.5],
        color: b.tealAlt,
      });
      items.push({
        at: [x, 11.75, z + 0.77],
        size: [0.65, 0.32, 0.04],
        color: b.tealDark,
      });
      if (winter)
        items.push({
          at: [x, 12.36, z],
          size: [2.14, 0.32, 1.84],
          color: snowColor,
        });
    }
    for (const w of model.windows) {
      const s = Math.sin(w.rotation),
        c = Math.cos(w.rotation);
      items.push({
        at: [w.position[0] + s * 0.07, w.position[1] - 0.37, w.position[2] + c * 0.07],
        size: [
          w.apartment === null ? 0.32 : (w.width ?? 0.48) + 0.12,
          winter ? 0.065 : 0.045,
          0.21,
        ],
        rotation: [0, w.rotation, 0],
        color: winter ? sillDayNight : "#8B99A6",
      });
    }
    return items;
  }, [winter, snowColor, sillDayNight, model, b]);
  return (
    <group name="sauran-6-osm-425124327">
      <mesh geometry={walls}>
        <meshStandardMaterial
          color={b.tealMain}
          roughness={0.86}
          metalness={0.02}
        />
      </mesh>
      <mesh geometry={plinth}>
        <meshStandardMaterial color={b.plinth} roughness={0.9} metalness={0} />
      </mesh>
      {winter && (
        <mesh name="roof-snow" geometry={roofSnow} position={[0, 11.14, 0]}>
          <meshStandardMaterial
            attach="material-0"
            color={snowColor}
            emissive={b.roofEmissive}
            emissiveIntensity={b.roofEmissiveIntensity}
            roughness={0.92}
          />
          <meshStandardMaterial
            attach="material-1"
            color={snowSideColor}
            emissive={b.roofEmissive}
            emissiveIntensity={b.roofEmissiveIntensity * 0.7}
            roughness={0.94}
          />
        </mesh>
      )}
      <Boxes items={details} />
      {entranceLayout.map(({ entrance, position, rotation, length }) => (
        <group key={entrance} position={position} rotation={[0, rotation, 0]}>
          <FacadeBays entrance={entrance} winter={winter} />
          <Box at={[0, 0.65, 0.12]} size={[1, 1.3, 0.15]} color={b.tealDark} />
          <Box
            at={[0, 0.68, 0.22]}
            size={[0.035, 1.25, 0.035]}
            color="#D0C7B8"
          />
          <Box at={[0, 1.5, 0.6]} size={[2, 0.18, 1.35]} color={b.tealAlt} />
          {winter && (
            <Box
              at={[0, 1.72, 0.6]}
              size={[2.22, 0.32, 1.56]}
              color={snowColor}
            />
          )}
          <Box at={[0, 0.17, 0.8]} size={[2.1, 0.2, 1.8]} color="#BAC4CE" />
          <mesh position={[0, 1.8, 1.32]}>
            <planeGeometry args={[0.55, 0.275]} />
            <meshBasicMaterial
              map={entranceSigns[entrance - 1]}
              toneMapped={true}
            />
          </mesh>
          {[-1, 1].map((side) => (
            <group key={side} position={[side * length * 0.3, 0.65, 0.1]}>
              <Box
                at={[0, 0, 0]}
                size={[length * 0.25, 1.05, 0.12]}
                color={b.tealDark}
              />
              <Box
                at={[0, 0.56, 0.04]}
                size={[length * 0.25, 0.12, 0.18]}
                color="#B8C2CC"
              />
              {[-0.3, 0.3].map((x) => (
                <Box
                  key={x}
                  at={[x * length * 0.25, 0, 0.1]}
                  size={[0.04, 1.05, 0.06]}
                  color="#7D8C99"
                />
              ))}
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

function FacadeBays({
  entrance,
  winter,
}: {
  entrance: number;
  winter: boolean;
}) {
  const model = useBuildingModel();
  const b = activePalette.building;
  const details = useMemo(() => {
    const layout = model.entrances[entrance - 1],
      section = sauranSections[entrance - 1],
      flipAlong =
        Math.cos((section?.rotation ?? layout.rotation) - layout.rotation) < 0,
      items: Solid[] = [];
    const homes = model.cells.filter(
      (c) => c.entrance === entrance && c.floor === 2,
    );
    homes.forEach((cell, index) => {
      const color =
        entrance === 2
          ? index % 2
            ? b.brickMain
            : b.brickAlt
          : index % 2
            ? b.tealAlt
            : b.tealMain;
      const bayStart = flipAlong ? -cell.end : cell.start,
        bayEnd = flipAlong ? -cell.start : cell.end;
      for (const face of ["courtyard", "street"] as const) {
        const panes = model.windows.filter(
          (w) => w.apartment === cell.apartment && w.side === face,
        );
        const pane = panes[0];
        if (!pane || Math.abs(Math.sin(pane.rotation - layout.rotation)) > 0.01)
          continue;
        const dx = pane.position[0] - layout.position[0],
          dz = pane.position[2] - layout.position[2];
        const depth =
          dx * Math.sin(layout.rotation) + dz * Math.cos(layout.rotation);
        const side = Math.cos(pane.rotation - layout.rotation) > 0 ? 1 : -1;
        const x = (bayStart + bayEnd) / 2,
          width = bayEnd - bayStart;
        items.push({
          at: [x, 6, depth - side * 0.045],
          size: [width - 0.12, 9.6, 0.06],
          color,
        });
        for (const edge of [bayStart, bayEnd])
          items.push({
            at: [edge, 6, depth + side * 0.025],
            size: [0.08, 9.6, 0.16],
            color,
          });
        if (!cell.loggiaSides?.includes(face)) continue;
        for (let floor = 2; floor <= 9; floor++) {
          const y = (floor - 0.5) * floorHeight,
            span = Math.max(0.3, width - 0.24);
          items.push({
            at: [x, y - 0.45, depth + side * 0.3],
            size: [span, 0.2, 0.16],
            color,
          });
          for (const edge of [-1, 1])
            items.push({
              at: [x + (edge * span) / 2, y, depth + side * 0.17],
              size: [0.08, 0.94, 0.32],
              color,
            });
          items.push({
            at: [x, y - 0.32, depth + side * 0.3],
            size: [span + 0.06, winter ? 0.055 : 0.035, 0.24],
            color: winter ? b.sillColor : "#8B99A6",
          });
        }
      }
    });
    const pane = model.windows.find((w) => w.id === `stair-${entrance}-2`);
    if (!pane) return items;
    const dx = pane.position[0] - layout.position[0],
      dz = pane.position[2] - layout.position[2];
    const x =
        dx * Math.cos(layout.rotation) - dz * Math.sin(layout.rotation),
      depth =
        dx * Math.sin(layout.rotation) + dz * Math.cos(layout.rotation);
    const side = Math.cos(pane.rotation - layout.rotation) > 0 ? 1 : -1;
    items.push({
      at: [x, 6.15, depth - side * 0.04],
      size: [0.62, 9.9, 0.06],
      color: b.tealDark,
    });
    for (const edge of [-1, 1])
      items.push({
        at: [x + edge * 0.36, 6.15, depth + side * 0.03],
        size: [0.08, 9.9, 0.2],
        color: b.tealAlt,
      });
    return items;
  }, [model, entrance, winter, b]);
  return <Boxes items={details} />;
}

function MappedBuilding() {
  const model = useBuildingModel(),
    { winter } = useView();
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(
      model.footprint.map(([x, z]) => new THREE.Vector2(x, -z)),
    );
    const walls = new THREE.ExtrudeGeometry(shape, {
      depth: model.height,
      bevelEnabled: false,
    });
    walls.rotateX(-Math.PI / 2);
    const snow = new THREE.ExtrudeGeometry(shape, {
      depth: 0.18,
      bevelEnabled: true,
      bevelSize: 0.14,
      bevelThickness: 0.12,
      bevelSegments: 2,
    });
    snow.rotateX(-Math.PI / 2);
    return { walls, snow };
  }, [model]);
  const details = useMemo(() => {
    const sills: Solid[] = model.windows.map((w) => ({
      at: [w.position[0], w.position[1] - 0.36, w.position[2]],
      size: [(w.width ?? 0.48) + 0.12, 0.07, 0.22],
      rotation: [0, w.rotation, 0],
      color: winter ? "#E5ECF2" : "#8B99A6",
    }));
    for (const core of model.cores) {
      const pane = model.windows.find(
        (w) => w.id === `stair-${core.entrance}-2`,
      );
      if (pane)
        sills.push({
          at: [
            pane.position[0] - Math.sin(pane.rotation) * 0.04,
            (model.height + floorHeight) / 2,
            pane.position[2] - Math.cos(pane.rotation) * 0.04,
          ],
          size: [0.62, model.height - floorHeight, 0.06],
          rotation: [0, pane.rotation, 0],
          color: "#2B505C",
        });
    }
    return sills;
  }, [model, winter]);
  return (
    <group name={`managed-building-${model.building.id}`}>
      <mesh geometry={geometry.walls}>
        <meshStandardMaterial color="#3E7484" roughness={0.88} metalness={0} />
      </mesh>
      {winter && (
        <mesh geometry={geometry.snow} position={[0, model.height + 0.1, 0]}>
          <meshStandardMaterial
            color="#F3F6FA"
            roughness={0.94}
          />
        </mesh>
      )}
      <Boxes items={details} />
      {model.entrances.map((e) => (
        <group
          key={e.entrance}
          position={e.position}
          rotation={[0, e.rotation, 0]}
        >
          <Box at={[0, 0.65, 0.13]} size={[0.9, 1.3, 0.18]} color="#2B505C" />
          <Box at={[0, 1.5, 0.55]} size={[1.8, 0.15, 1.1]} color="#9F5541" />
          {winter && (
            <Box at={[0, 1.67, 0.55]} size={[2, 0.23, 1.3]} color="#F3F6FA" />
          )}
        </group>
      ))}
    </group>
  );
}
