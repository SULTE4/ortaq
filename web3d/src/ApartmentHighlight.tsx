import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { floorHeight } from './domain';
import type { ApartmentCell } from './apartmentPlan';

export function ApartmentHighlight({ cell }: { cell: ApartmentCell }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(
      cell.outline.map(([x, z]) => new THREE.Vector2(x - cell.centre[0], -(z - cell.centre[2]))),
    );
    const walls = new THREE.ExtrudeGeometry(shape, {
      depth: floorHeight - 0.12,
      bevelEnabled: false,
    });
    walls.rotateX(-Math.PI / 2);
    const slab = new THREE.ExtrudeGeometry(shape, {
      depth: 0.06,
      bevelEnabled: false,
    });
    slab.rotateX(-Math.PI / 2);
    return { walls, slab, edges: new THREE.EdgesGeometry(walls) };
  }, [cell]);

  useEffect(
    () => () => {
      geometry.walls.dispose();
      geometry.slab.dispose();
      geometry.edges.dispose();
    },
    [geometry],
  );

  return (
    <group
      name={`apartment-volume-${cell.apartment}`}
      position={[cell.centre[0], (cell.floor - 1) * floorHeight + 0.06, cell.centre[2]]}
      scale={[0.985, 1, 0.985]}
    >
      <mesh geometry={geometry.walls} renderOrder={20}>
        <meshBasicMaterial
          color="#E2942A"
          transparent
          opacity={0.14}
          depthTest={false}
          depthWrite={false}
          toneMapped={true}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={geometry.slab} renderOrder={21}>
        <meshBasicMaterial
          color="#E2942A"
          transparent
          opacity={0.28}
          depthTest={false}
          depthWrite={false}
          toneMapped={true}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineSegments geometry={geometry.edges} renderOrder={22}>
        <lineBasicMaterial
          color="#F6DFBE"
          transparent
          opacity={0.86}
          depthTest={false}
          depthWrite={false}
          toneMapped={true}
        />
      </lineSegments>
    </group>
  );
}
