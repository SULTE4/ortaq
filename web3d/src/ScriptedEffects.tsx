import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useView } from "./store";
import { apartmentFocus, issuePosition } from "./domain";
import { C } from "./strings";
import { cinematicClock } from "./cinematic";
import { SafeLabel } from "./SafeLabel";
import { useReducedMotion } from "./useReducedMotion";
const scratch = new THREE.Object3D();
export function ScriptedEffects() {
  const time = useView((s) => s.time);
  const reduced = useReducedMotion();
  const sparks = useRef<THREE.InstancedMesh>(null!);
  const ripple = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    const time = cinematicClock.time;
    if (sparks.current) {
      sparks.current.visible = !reduced && time >= 20 && time < 21.1;
      for (let i = 0; i < 3; i++) {
        const t = Math.min(1, Math.max(0, (time - 20 - i * .1) / .8));
        const from = apartmentFocus([44, 46, 49][i]),
          to = issuePosition({ entrance: 2, floor: 2, area: "" });
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
    if (ripple.current) {
      ripple.current.visible = time >= 40 && time < 50;
      const t = Math.min(1, (time - 40) / .8);
      ripple.current.scale.setScalar(1);
      (ripple.current.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        reduced ? 0.65 : 0.65 - t * 0.25,
      );
    }
  });
  const apt = apartmentFocus(45);
  return (
    <group>
      <instancedMesh ref={sparks} args={[undefined, undefined, 3]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial color="#F2B35B" toneMapped={false} />
      </instancedMesh>
      <mesh ref={ripple} position={[apt[0], apt[1], apt[2] + 0.17]}>
        <ringGeometry args={[0.9, 1, 36]} />
        <meshBasicMaterial
          color="#5DB88A"
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {time >= 40 && time < 50 && (
        <SafeLabel at={[apt[0], apt[1] + .65, apt[2] + .3]} className="resolved-label">{C.resolved}</SafeLabel>
      )}
      {time >= 70 && time < 80 && (
        <Html position={[5, 13, -3]} center distanceFactor={40}>
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
