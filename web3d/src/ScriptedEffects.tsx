import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useView } from "./store";
import { apartmentCell, issuePosition } from "./domain";
import { C } from "./strings";
import { cinematicClock } from "./cinematic";
const scratch = new THREE.Object3D();
export function ScriptedEffects() {
  const time = useView((s) => s.time);
  const sparks = useRef<THREE.InstancedMesh>(null!);
  const worker = useRef<THREE.Group>(null!);
  const left = useRef<THREE.Mesh>(null!),
    right = useRef<THREE.Mesh>(null!);
  const ripple = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    const time = cinematicClock.time;
    if (sparks.current) {
      sparks.current.visible = time >= 20 && time < 30;
      for (let i = 0; i < 3; i++) {
        const t = ((time - 20) * 0.35 + i * 0.25) % 1;
        const from = apartmentCell([44, 46, 49][i]).position,
          to = issuePosition({ entrance: 2, floor: 5, area: "" });
        scratch.position.set(
          THREE.MathUtils.lerp(from[0], to[0], t),
          THREE.MathUtils.lerp(from[1], to[1], t) + Math.sin(Math.PI * t),
          THREE.MathUtils.lerp(from[2], to[2], t) + Math.sin(Math.PI * t) * 2,
        );
        scratch.updateMatrix();
        sparks.current.setMatrixAt(i, scratch.matrix);
      }
      sparks.current.instanceMatrix.needsUpdate = true;
    }
    if (worker.current) {
      worker.current.visible = time >= 30 && time < 40;
      const t = THREE.MathUtils.smoothstep(time, 30, 38);
      worker.current.position.set(-12 + 12 * t, 0.45, 12 - 9 * t);
      left.current.rotation.x = Math.sin(time * 6) * 0.5;
      right.current.rotation.x = -Math.sin(time * 6) * 0.5;
    }
    if (ripple.current) {
      ripple.current.visible = time >= 40 && time < 50;
      const t = (time - 40) % 3;
      ripple.current.scale.setScalar(0.6 + t * 1.2);
      (ripple.current.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        0.8 - t * 0.27,
      );
    }
  });
  const apt = apartmentCell(45).position;
  return (
    <group>
      <instancedMesh ref={sparks} args={[undefined, undefined, 3]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial color="#ffd48b" toneMapped={false} />
      </instancedMesh>
      <group ref={worker}>
        <mesh position={[0, 1.35, 0]}>
          <sphereGeometry args={[0.18, 10, 10]} />
          <meshStandardMaterial color="#d6b39b" />
        </mesh>
        <mesh position={[0, 1.5, 0]}>
          <sphereGeometry
            args={[0.22, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          <meshStandardMaterial color="#f2b74f" />
        </mesh>
        <mesh position={[0, 0.94, 0]}>
          <boxGeometry args={[0.42, 0.55, 0.28]} />
          <meshStandardMaterial color="#e2aa4a" />
        </mesh>
        {[-1, 1].map((s, i) => (
          <mesh
            key={s}
            ref={i === 0 ? left : right}
            position={[s * 0.12, 0.4, 0]}
          >
            <boxGeometry args={[0.15, 0.55, 0.17]} />
            <meshStandardMaterial color="#254b73" />
          </mesh>
        ))}
        <mesh position={[0.4, 0.73, 0]}>
          <boxGeometry args={[0.35, 0.25, 0.22]} />
          <meshStandardMaterial color="#5b7b9b" />
        </mesh>
      </group>
      <mesh ref={ripple} position={[apt[0], apt[1], apt[2] + 0.17]}>
        <ringGeometry args={[0.9, 1, 36]} />
        <meshBasicMaterial
          color="#5de4bc"
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {time >= 40 && time < 50 && (
        <Html position={[0, 8.4, 3.2]} center>
          <div className="resolved-label">{C.resolved}</div>
        </Html>
      )}
      {time >= 70 && time < 80 && (
        <Html position={[0, 15, 0]} center distanceFactor={40}>
          <div className="roof-poll">
            {C.poll}
            <div>
              <i style={{ width: `${Math.min(68, (time - 70) * 10)}%` }} />
            </div>
            <span>
              {Math.min(68, Math.floor((time - 70) * 10))}% {C.yes}
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}
