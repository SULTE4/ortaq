import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useView } from "./store";
function Solid({
  at,
  size,
  color,
}: {
  at: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={at} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}
function Neighbour({
  x,
  z,
  coat,
  phase,
}: {
  x: number;
  z: number;
  coat: string;
  phase: number;
}) {
  const ref = useRef<THREE.Group>(null!);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  useFrame(({ clock }) => {
    if (!reduced)
      ref.current.position.z =
        z + Math.sin(clock.elapsedTime * 0.16 + phase) * 1.2;
  });
  return (
    <group ref={ref} position={[x, 0.3, z]} rotation={[0, phase, 0]}>
      <mesh position={[0, 1.37, 0]} castShadow>
        <sphereGeometry args={[0.17, 8, 8]} />
        <meshStandardMaterial color="#bba28c" />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.19, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#cbb889" />
      </mesh>
      <Solid at={[0, 0.94, 0]} size={[0.38, 0.65, 0.25]} color={coat} />
      <Solid at={[0, 1.2, 0.15]} size={[0.4, 0.11, 0.09]} color="#bdb899" />
      {[-1, 1].map((i) => (
        <Solid
          key={i}
          at={[i * 0.11, 0.38, 0]}
          size={[0.14, 0.55, 0.16]}
          color="#233f4a"
        />
      ))}
      <Solid at={[0.35, 0.65, 0]} size={[0.25, 0.32, 0.2]} color="#d4c4a0" />
    </group>
  );
}
export function NeighbourhoodDetails() {
  const { night, winter } = useView();
  return (
    <group>
      {[-8, 0, 8].map((x) => (
        <group key={x}>
          <Solid
            at={[x, 0.32, 7.5]}
            size={[1.8, 0.06, 8]}
            color={winter ? "#aebdc0" : "#bfc8bb"}
          />
          <mesh position={[x, 2.08, 2.76]}>
            <boxGeometry args={[1.55, 0.1, 0.7]} />
            <meshStandardMaterial
              color="#e5c285"
              emissive="#f5c779"
              emissiveIntensity={night ? 2.3 : 0.15}
            />
          </mesh>
          {night && (
            <pointLight
              position={[x, 1.9, 3]}
              color="#ffd99b"
              intensity={12}
              distance={5}
              decay={2}
            />
          )}
          <Solid
            at={[x - 2.5, 6, 2.05]}
            size={[0.32, 11.7, 0.18]}
            color="#40606b"
          />
          {[3, 6, 9].map((f) => (
            <group key={f} position={[x + 2.1, 1.1 + (f - 0.5) * 1.16, 2.5]}>
              <Solid
                at={[0, -0.45, 0]}
                size={[1.6, 0.11, 0.8]}
                color="#96a7a9"
              />
              <Solid
                at={[0, -0.1, 0.4]}
                size={[1.65, 0.06, 0.04]}
                color="#5b7379"
              />
              {[-0.75, 0, 0.75].map((v) => (
                <Solid
                  key={v}
                  at={[v, -0.26, 0.4]}
                  size={[0.04, 0.38, 0.04]}
                  color="#5b7379"
                />
              ))}
            </group>
          ))}
        </group>
      ))}
      {[-10, 6].map((x, i) => (
        <group key={x} position={[x, 0.4, 5.5]}>
          <Solid at={[0, 0.45, 0]} size={[2, 0.15, 0.65]} color="#927b60" />
          <Solid at={[0, 0.85, -0.25]} size={[2, 0.55, 0.1]} color="#927b60" />
          {[-0.7, 0.7].map((v) => (
            <Solid
              key={v}
              at={[v, 0.22, 0]}
              size={[0.12, 0.5, 0.5]}
              color="#364f56"
            />
          ))}
        </group>
      ))}
      {winter &&
        [-8, 0, 8].flatMap((x) =>
          Array.from({ length: 8 }, (_, i) => (
            <mesh
              key={`${x}-${i}`}
              position={[x + (i % 2 ? 0.15 : -0.15), 0.37, 3.8 + i * 0.65]}
              rotation={[-Math.PI / 2, 0, 0.1]}
            >
              <circleGeometry args={[0.07, 5]} />
              <meshStandardMaterial color="#7c959b" roughness={1} />
            </mesh>
          )),
        )}
      <Neighbour x={-10.5} z={4.3} coat="#8a6655" phase={0.7} />
      <Neighbour x={5.2} z={4.5} coat="#416b72" phase={3.9} />
      <Solid at={[-13, 0.7, 12]} size={[0.18, 1.1, 2.8]} color="#3b5964" />
      <Solid at={[-11.5, 0.7, 12]} size={[0.18, 1.1, 2.8]} color="#3b5964" />
    </group>
  );
}
