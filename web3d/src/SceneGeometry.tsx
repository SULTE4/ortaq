import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Vec3 } from "./types";

const geometries = new Map<string, THREE.BufferGeometry>();
export function roundedGeometry(size: Vec3) {
  const key = size.join(",");
  if (!geometries.has(key))
    geometries.set(
      key,
      new RoundedBoxGeometry(
        ...size,
        1,
        Math.min(0.12, Math.min(...size) * 0.24),
      ),
    );
  return geometries.get(key)!;
}
function windowOpening(width: number, height: number, radius: number) {
  const shape = new THREE.Shape(),
    x = -width / 2,
    y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}
export const windowFrameGeometry = (() => {
  const frame = windowOpening(1.05, 0.88, 0.06);
  frame.holes.push(
    new THREE.Path(windowOpening(0.89, 0.72, 0.04).getPoints(3).reverse()),
  );
  const geometry = new THREE.ExtrudeGeometry(frame, {
    depth: 0.16,
    steps: 1,
    bevelEnabled: false,
    curveSegments: 2,
  });
  geometry.translate(0, 0, -0.08);
  return geometry;
})();
export type Solid = {
  at: Vec3;
  size: Vec3;
  color: string;
  rotation?: Vec3;
};
export function Box({
  at,
  size,
  color = "#e1e5df",
  ...props
}: Omit<Solid, "color"> & {
  color?: string;
}) {
  return (
    <mesh position={at} geometry={roundedGeometry(size)} {...props}>
      <meshStandardMaterial color={color} roughness={0.92} metalness={0} />
    </mesh>
  );
}
function Instances({
  items,
  geometry,
  unlit = false,
}: {
  items: Solid[];
  geometry: THREE.BufferGeometry;
  unlit?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    const object = new THREE.Object3D(),
      color = new THREE.Color();
    items.forEach((item, i) => {
      object.position.set(...item.at);
      object.rotation.set(...(item.rotation ?? [0, 0, 0]));
      if (geometry === crownGeometry) object.scale.set(...item.size);
      else object.scale.set(1, 1, 1);
      object.updateMatrix();
      ref.current.setMatrixAt(i, object.matrix);
      ref.current.setColorAt(i, color.set(item.color));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [items, geometry]);
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, items.length]}>
      {unlit ? (
        <meshBasicMaterial />
      ) : (
        <meshStandardMaterial roughness={0.9} metalness={0} />
      )}
    </instancedMesh>
  );
}
export function Boxes({
  items,
  unlit = false,
}: {
  items: Solid[];
  unlit?: boolean;
}) {
  const groups = useMemo(() => {
    const groups = new Map<string, Solid[]>();
    for (const item of items) {
      const key = item.size.join(",");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return [...groups.entries()];
  }, [items]);
  return (
    <>
      {groups.map(([key, group]) => (
        <Instances
          key={key}
          items={group}
          unlit={unlit}
          geometry={roundedGeometry(group[0].size)}
        />
      ))}
    </>
  );
}
const crownGeometry = new THREE.SphereGeometry(1, 12, 10);
export function SoftForms({ items }: { items: Solid[] }) {
  return <Instances items={items} geometry={crownGeometry} />;
}
