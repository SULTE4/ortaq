import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  CameraControls,
  ContactShadows,
  Environment,
  Html,
  Lightformer,
  RoundedBox,
} from "@react-three/drei";
import {
  Bloom,
  DepthOfField,
  EffectComposer,
  N8AO,
} from "@react-three/postprocessing";
import * as THREE from "three";
import { useView } from "./store";
import {
  apartmentCell,
  categoryColors,
  effectiveExpenses,
  groupExpenses,
  issuePosition,
  money,
  statusColors,
} from "./domain";
import { S } from "./strings";
import { cameraAt, scriptIssue, cinematicClock } from "./cinematic";
import { ScriptedEffects } from "./ScriptedEffects";
import type { Issue, Vec3 } from "./types";

function Box({
  at,
  size,
  color = "#e8eff7",
  ...props
}: {
  at: Vec3;
  size: Vec3;
  color?: string;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  return (
    <mesh position={at} castShadow receiveShadow {...props}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.75} />
    </mesh>
  );
}
function Windows({
  x = 0,
  z = 0,
  ghost = false,
}: {
  x?: number;
  z?: number;
  ghost?: boolean;
}) {
  const temp = useMemo(() => new THREE.Object3D(), []);
  const ref = useRef<THREE.InstancedMesh>(null!);
  const frame = useRef<THREE.InstancedMesh>(null!);
  const { night, snapshot, balances, cinematic, time } = useView();
  const voted =
    cinematic && time >= 70
      ? Array.from(
          { length: Math.min(100, Math.floor((time - 70) * 12)) },
          (_, i) => i + 1,
        )
      : ((snapshot?.polls.find((p) => !p.closed) ?? snapshot?.polls[0])
          ?.voted_apartments ?? []);
  const votedKey = voted.join(",");
  const base = useRef<THREE.Color[]>([]),
    waveStart = useRef(-100),
    previousAnnouncement = useRef(snapshot?.announcements[0]?.id),
    wasWaving = useRef(false);
  useEffect(() => {
    const id = snapshot?.announcements[0]?.id;
    if (id !== previousAnnouncement.current) {
      waveStart.current = performance.now() / 1000;
      previousAnnouncement.current = id;
    }
  }, [snapshot?.announcements[0]?.id]);
  useFrame(() => {
    if (ghost || !ref.current || base.current.length !== 120) return;
    const elapsed = cinematic
      ? time >= 60 && time < 70
        ? (time - 60) % 4
        : -1
      : performance.now() / 1000 - waveStart.current;
    const waving = elapsed >= 0 && elapsed < 4;
    if (waving || wasWaving.current) {
      for (let i = 0; i < 120; i++) {
        const p = apartmentCell(i + 1).position;
        const arrival = ((p[0] + 12) / 24) * 2 + p[1] / 12;
        const pulse = waving
          ? Math.max(0, 1 - Math.abs(elapsed - arrival) * 2)
          : 0;
        ref.current.setColorAt(
          i,
          base.current[i]
            .clone()
            .lerp(new THREE.Color("#b6e9ff"), pulse * 0.95),
        );
      }
      if (ref.current.instanceColor)
        ref.current.instanceColor.needsUpdate = true;
    }
    wasWaving.current = waving;
  });
  useLayoutEffect(() => {
    const c = new THREE.Color();
    for (let i = 0; i < 120; i++) {
      const cell = apartmentCell(i + 1);
      temp.scale.set(1, 1, 1);
      temp.position.set(...cell.position);
      temp.position.x += x;
      temp.position.z += z;
      temp.updateMatrix();
      ref.current.setMatrixAt(i, temp.matrix);
      frame.current.setMatrixAt(i, temp.matrix);
      let color = ghost
        ? cinematic && time >= 80
          ? "#d2bc88"
          : "#8c9cac"
        : night
          ? i % 5 === 0
            ? "#294765"
            : "#e8bc77"
          : "#244e76";
      if (!ghost && voted.includes(i + 1)) color = "#5cd9b4";
      if (!ghost && balances && !cinematic) {
        const b = snapshot?.balances?.find((b) => b.apartment === i + 1);
        if (b)
          color =
            b.amount < 0 ? "#ef7781" : b.amount > 0 ? "#7ea6ff" : "#4bc4a0";
      }
      if (!ghost && !cinematic && snapshot?.apartment === i + 1)
        color = voted.includes(i + 1) ? "#77ffe1" : "#f6c36c";
      if (!ghost && cinematic && i === 44 && time >= 10)
        color = time >= 40 ? "#48e4b3" : "#f08d82";
      c.set(color);
      ref.current.setColorAt(i, c);
      base.current[i] = c.clone();
    }
    ref.current.instanceMatrix.needsUpdate = true;
    frame.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [
    x,
    z,
    ghost,
    night,
    snapshot,
    balances,
    votedKey,
    cinematic,
    Math.floor(time),
  ]);
  return (
    <>
      <instancedMesh ref={frame} args={[undefined, undefined, 120]}>
        <boxGeometry args={[1.05, 0.88, 0.13]} />
        <meshStandardMaterial color={ghost ? "#94a2b3" : "#d7e3ef"} />
      </instancedMesh>
      <instancedMesh
        ref={ref}
        args={[undefined, undefined, 120]}
        position={[0, 0, 0.08]}
      >
        <boxGeometry args={[0.85, 0.68, 0.12]} />
        <meshStandardMaterial
          toneMapped={!night}
          roughness={0.25}
          metalness={0.2}
          emissive={night ? "#b88f56" : "#74a9c5"}
          emissiveIntensity={night ? 0.45 : 0.12}
        />
      </instancedMesh>
    </>
  );
}
function Building({
  x = 0,
  z = 0,
  ghost = false,
}: {
  x?: number;
  z?: number;
  ghost?: boolean;
}) {
  const { winter, cinematic, time } = useView();
  const light = ghost && cinematic && time >= 80;
  return (
    <group position={[x, 0, z]}>
      {[-8, 0, 8].map((v, i) => (
        <group key={i}>
          <Box
            at={[v, 6, 0]}
            size={[7.8, 11.6, 4]}
            color={
              ghost
                ? light
                  ? "#d0ddeb"
                  : "#b5c0cc"
                : i === 1
                  ? "#d8e3ee"
                  : "#e7edf4"
            }
          />
          <Box
            at={[v, 12, 0]}
            size={[8.1, 0.45, 4.3]}
            color={winter ? "#fbfdff" : ghost ? "#a4b2c3" : "#294a70"}
          />
          <Box
            at={[v, 6, -2.06]}
            size={[0.5, 11.8, 0.15]}
            color={ghost ? "#91a3b5" : "#56789d"}
          />
          <Box
            at={[v, 1.1, 2.09]}
            size={[1.5, 1.9, 0.17]}
            color={ghost ? "#8d9cae" : "#173c63"}
          />
          <Box
            at={[v, 2.2, 2.65]}
            size={[2.3, 0.18, 1.6]}
            color={ghost ? "#9facb9" : "#587a9e"}
          />
          <Box at={[v, 0.32, 2.7]} size={[2.5, 0.32, 1.6]} color="#c5d0df" />
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((f) => (
            <Box
              key={f}
              at={[v, 1.1 + f * 1.16, 2.05]}
              size={[7.8, 0.07, 0.16]}
              color={ghost ? "#a9b7c8" : "#a6bacf"}
            />
          ))}
          {!ghost && (
            <Html position={[v, 2.1, 3]} center distanceFactor={26}>
              <div className="entrance-tag">0{i + 1}</div>
            </Html>
          )}
        </group>
      ))}
      <Windows ghost={ghost} />
      {ghost ? (
        <Html position={[0, 14, 0]} center distanceFactor={40}>
          <div className="neighbour-label">{S.neighbours}</div>
        </Html>
      ) : (
        <Html position={[0, 13, 0]} center distanceFactor={38}>
          <div className="building-label">
            ЖК Ortaq Demo<span>{S.buildingTag}</span>
          </div>
        </Html>
      )}
    </group>
  );
}
function Tree({ at, small = false }: { at: Vec3; small?: boolean }) {
  const winter = useView((s) => s.winter);
  return (
    <group position={at} scale={small ? 0.7 : 1}>
      <Box at={[0, 0.65, 0]} size={[0.2, 1.3, 0.2]} color="#7a6f69" />
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 1.15 + i * 0.55, 0]} castShadow>
          <coneGeometry args={[1.05 - i * 0.2, 1.5, 7]} />
          <meshStandardMaterial
            color={winter ? "#d6e6eb" : i % 2 ? "#4e8779" : "#3d7169"}
            roughness={1}
          />
        </mesh>
      ))}
    </group>
  );
}
function Courtyard() {
  const { winter, night } = useView();
  return (
    <group>
      <RoundedBox
        args={[91, 1, 77]}
        radius={0.45}
        smoothness={3}
        position={[-8, -0.6, -6]}
        receiveShadow
      >
        <meshStandardMaterial color="#8198b3" roughness={0.9} />
      </RoundedBox>
      <RoundedBox
        args={[90.8, 0.25, 76.8]}
        radius={0.1}
        smoothness={2}
        position={[-8, 0.02, -6]}
        receiveShadow
      >
        <meshStandardMaterial color={winter ? "#e9f0f6" : "#a5c4ae"} />
      </RoundedBox>
      <Box at={[0, 0.23, 4.4]} size={[28, 0.14, 1.8]} color="#c5d2df" />
      <Box at={[-13, 0.24, 8]} size={[1.6, 0.14, 9]} color="#c5d2df" />
      <Box
        at={[0, 0.2, 14]}
        size={[47, 0.15, 5]}
        color={winter ? "#becbd9" : "#8c9eac"}
      />
      {Array.from({ length: 12 }, (_, i) => (
        <Box
          key={i}
          at={[-21 + i * 3.8, 0.31, 14]}
          size={[1.8, 0.03, 0.1]}
          color="#f1f6fb"
        />
      ))}
      {[-18, -13, -8, 14, 19].map((v, i) => (
        <group key={i} position={[v, 0, 9.5]}>
          <Box
            at={[0, 0.56, 0]}
            size={[2.6, 0.65, 1.25]}
            color={["#31567c", "#c6d3de", "#f2f4f5", "#567c9d", "#a77374"][i]}
          />
          <Box at={[0, 1.05, 0]} size={[1.6, 0.5, 1.1]} color="#385574" />
          {[-0.8, 0.8].flatMap((x) =>
            [-0.65, 0.65].map((z) => (
              <mesh
                key={`${x}${z}`}
                position={[x, 0.4, z]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <cylinderGeometry args={[0.25, 0.25, 0.1, 10]} />
                <meshStandardMaterial color="#2e4054" />
              </mesh>
            )),
          )}
        </group>
      ))}
      <RoundedBox args={[9, 0.13, 6]} radius={0.05} position={[-3, 0.3, 8]}>
        <meshStandardMaterial color={winter ? "#d8dde9" : "#d5b49a"} />
      </RoundedBox>
      <group position={[-5, 0.4, 7.5]}>
        <Box at={[0, 1.15, 0]} size={[0.12, 2.3, 0.12]} color="#d98e76" />
        <Box at={[2, 1.15, 0]} size={[0.12, 2.3, 0.12]} color="#d98e76" />
        <Box at={[1, 2.3, 0]} size={[2.3, 0.15, 0.15]} color="#d98e76" />
        {[0.7, 1.3].map((x) => (
          <Box
            key={x}
            at={[x, 1.55, 0]}
            size={[0.03, 1.5, 0.03]}
            color="#6a829c"
          />
        ))}
        <Box at={[1, 0.8, 0]} size={[0.9, 0.12, 0.5]} color="#355d86" />
      </group>
      <group position={[0, 0.4, 7]}>
        <Box at={[0, 0.8, 0]} size={[1.1, 1.6, 1.1]} color="#638bb4" />
        <mesh position={[0.9, 0.8, 0.8]} rotation={[0.6, 0, -0.6]}>
          <boxGeometry args={[0.8, 0.14, 2.7]} />
          <meshStandardMaterial color="#d99b7c" />
        </mesh>
        <mesh position={[0, 1.9, 0]}>
          <coneGeometry args={[1, 1, 4]} />
          <meshStandardMaterial color="#52789c" />
        </mesh>
      </group>
      {[-20, -15, 15, 20].flatMap((x) =>
        [-8, 4, 18].map((z) => (
          <Tree key={`${x}${z}`} at={[x, 0.25, z]} small={z === 18} />
        )),
      )}
      {[-11, 11].flatMap((x) =>
        [4, 17].map((z) => (
          <group key={`${x}${z}`} position={[x, 0.3, z]}>
            <Box at={[0, 1.7, 0]} size={[0.1, 3.4, 0.1]} color="#526d89" />
            <mesh position={[0, 3.5, 0]}>
              <sphereGeometry args={[0.25, 8, 8]} />
              <meshStandardMaterial
                color="#fff2cd"
                emissive="#ffe0a0"
                emissiveIntensity={night ? 3 : 0.1}
              />
            </mesh>
            {night && (
              <pointLight
                position={[0, 3.5, 0]}
                color="#ffdbab"
                intensity={5}
                distance={6}
              />
            )}
          </group>
        )),
      )}
    </group>
  );
}
function Skyline() {
  return (
    <group position={[0, 0, -44]}>
      {Array.from({ length: 20 }, (_, i) => {
        const h = 4 + ((i * 7) % 11);
        return (
          <Box
            key={i}
            at={[-55 + i * 5.7, h / 2, 0]}
            size={[3, h, 3]}
            color="#b5c6d8"
          />
        );
      })}
      <mesh position={[25, 12, -3]}>
        <sphereGeometry args={[3.6, 12, 10]} />
        <meshStandardMaterial color="#bdc9cc" metalness={0.4} roughness={0.4} />
      </mesh>
      <Box at={[25, 4, -3]} size={[0.5, 11, 0.5]} color="#a5b7ca" />
    </group>
  );
}
function Snow() {
  const ref = useRef<THREE.Points>(null!);
  const coords = useMemo(() => {
    const values = new Float32Array(260 * 3);
    for (let i = 0; i < 260; i++) {
      values[i * 3] = (Math.sin(i * 7.23) * 0.5 + 0.5) * 56 - 28;
      values[i * 3 + 1] = (i * 3.37) % 24;
      values[i * 3 + 2] = (Math.cos(i * 2.7) * 0.5 + 0.5) * 48 - 20;
    }
    return values;
  }, []);
  useFrame((_, d) => {
    const a = ref.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < 260; i++) {
      a[i * 3 + 1] -= d * (0.6 + (i % 3) * 0.2);
      if (a[i * 3 + 1] < 0.3) a[i * 3 + 1] = 23;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[coords, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.09}
        color="white"
        transparent
        opacity={0.65}
        depthWrite={false}
      />
    </points>
  );
}
function Pin({ issue }: { issue: Issue }) {
  const set = useView((s) => s.set),
    selected = useView((s) => s.selected);
  const ref = useRef<THREE.Group>(null!);
  const color = statusColors[issue.status],
    size = 0.32 + Math.min(issue.supporters.length, 20) * 0.027;
  const at = issuePosition(issue.location);
  const hash = [...issue.id].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  at[0] += ((hash % 3) - 1) * 0.7;
  useFrame(({ clock }) => {
    ref.current.position.y =
      at[1] + Math.sin(clock.elapsedTime * 2 + at[0]) * 0.1;
  });
  return (
    <group
      ref={ref}
      position={at}
      onClick={(e) => {
        e.stopPropagation();
        set({ selected: issue.id });
      }}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <mesh>
        <sphereGeometry
          args={[selected === issue.id ? size * 1.3 : size, 16, 12]}
        />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.7}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[size * 1.8, 0.035, 6, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.65} />
      </mesh>
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.7, 6]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {selected === issue.id && (
        <Html position={[0, 0.8, 0]} center>
          <div className="pin-tooltip">{issue.title}</div>
        </Html>
      )}
    </group>
  );
}
function Flow() {
  const temp = useMemo(() => new THREE.Object3D(), []);
  const { snapshot, month, cinematic, time } = useView();
  const report = snapshot?.reports.find((r) => r.month === month);
  const groups = cinematic
    ? Object.entries({
        Cleaning: 240000,
        Elevator: 180000,
        Security: 420000,
        Utilities: 310000,
        Repairs: 260000,
        Salary: 350000,
      })
    : report
      ? groupExpenses(effectiveExpenses(report))
      : [];
  const core: Vec3 = [-18, 3, 0];
  const positions = groups.map(
    (_, i) =>
      [
        -18 + Math.cos((i / 6) * Math.PI * 2) * 5,
        2 + Math.sin((i / 6) * Math.PI * 2) * 1.6,
        Math.sin((i / 6) * Math.PI * 2) * 5,
      ] as Vec3,
  );
  const particles = useRef<THREE.InstancedMesh>(null!);
  const visible = groups.length > 0 && (!cinematic || time >= 50);
  useFrame(({ clock }) => {
    if (!particles.current) return;
    for (let i = 0; i < 54; i++) {
      let t =
        ((cinematic ? cinematicClock.time : clock.elapsedTime) * 0.25 +
          i * 0.037) %
        1;
      const index = i % groups.length;
      let from: Vec3, to: Vec3;
      if (i < 30) {
        from = apartmentCell(i * 3 + 1).position;
        to = core;
      } else {
        from = core;
        to = positions[index] ?? core;
      }
      temp.position.set(
        THREE.MathUtils.lerp(from[0], to[0], t),
        THREE.MathUtils.lerp(from[1], to[1], t) + Math.sin(t * Math.PI) * 2,
        THREE.MathUtils.lerp(from[2], to[2], t),
      );
      temp.scale.setScalar(0.055);
      temp.updateMatrix();
      particles.current.setMatrixAt(i, temp.matrix);
    }
    particles.current.instanceMatrix.needsUpdate = true;
  });
  if (!visible) return null;
  return (
    <group>
      <mesh position={core}>
        <icosahedronGeometry args={[0.9, 1]} />
        <meshStandardMaterial
          color="#84c9ff"
          emissive="#74bfff"
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>
      <Html position={[-18, 4.7, 0]} center distanceFactor={40}>
        <div className="fund-label">
          {S.fund}
          <b>{money(groups.reduce((s, e) => s + e[1], 0))}</b>
        </div>
      </Html>
      {groups.map(([cat, amount], i) => (
        <group key={cat} position={positions[i]}>
          <mesh>
            <sphereGeometry
              args={[0.2 + Math.sqrt(amount / 1000000), 14, 12]}
            />
            <meshStandardMaterial
              color={categoryColors[cat]}
              emissive={categoryColors[cat]}
              emissiveIntensity={0.6}
            />
          </mesh>
          <Html position={[0, 1.1, 0]} center distanceFactor={40}>
            <div className="category-label" title={money(amount)}>
              {cat}
              <span>{money(amount)}</span>
            </div>
          </Html>
        </group>
      ))}
      <instancedMesh ref={particles} args={[undefined, undefined, 54]}>
        <sphereGeometry args={[1, 6, 5]} />
        <meshBasicMaterial color="#78baff" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
function AnnouncementRipple() {
  const { snapshot, cinematic, time } = useView();
  const id = snapshot?.announcements[0]?.id;
  const ref = useRef<THREE.Mesh>(null!);
  const start = useRef(-99),
    previous = useRef(id);
  useEffect(() => {
    if (id !== previous.current) {
      start.current = performance.now() / 1000;
      previous.current = id;
    }
  }, [id]);
  useFrame(() => {
    const scripted = cinematic && time >= 60 && time < 70;
    const elapsed = scripted
      ? (time - 60) % 4
      : performance.now() / 1000 - start.current;
    ref.current.visible = elapsed >= 0 && elapsed < 5;
    ref.current.scale.setScalar(1 + elapsed * 6);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(
      0,
      0.7 - elapsed * 0.14,
    );
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.4, 1]}>
      <ringGeometry args={[0.98, 1.02, 64]} />
      <meshBasicMaterial
        color="#80bcff"
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
function CameraRig() {
  const ref = useRef<CameraControls>(null!);
  const selected = useView((s) => s.selected),
    snapshot = useView((s) => s.snapshot),
    cinematic = useView((s) => s.cinematic);
  useEffect(() => {
    if (cinematic) return;
    const issue = snapshot?.issues.find((i) => i.id === selected);
    if (issue) {
      const p = issuePosition(issue.location);
      ref.current?.setLookAt(p[0] + 10, p[1] + 7, p[2] + 18, ...p, true);
    } else ref.current?.setLookAt(33, 25, 39, 0, 5, 1, true);
  }, [selected, cinematic]);
  useFrame(() => {
    const state = useView.getState();
    if (state.cinematic && ref.current) {
      const shot = cameraAt(cinematicClock.time);
      ref.current.setLookAt(...shot.position, ...shot.target, false);
    }
  });
  return (
    <CameraControls
      ref={ref}
      makeDefault
      enabled={!cinematic}
      minDistance={12}
      maxDistance={105}
      maxPolarAngle={Math.PI / 2.05}
      smoothTime={0.7}
    />
  );
}
function LivePoll() {
  const { snapshot, cinematic } = useView();
  if (cinematic) return null;
  const poll = snapshot?.polls.find((p) => !p.closed) ?? snapshot?.polls[0];
  if (!poll) return null;
  const pct =
    poll.closed && poll.results
      ? (poll.results[0] / Math.max(1, poll.total_votes)) * 100
      : (poll.total_votes / 120) * 100;
  return (
    <Html position={[0, 15.2, 0]} center distanceFactor={46}>
      <div className="roof-poll live-roof-poll">
        <small>{S.advisory}</small>
        {poll.question}
        <div>
          <i style={{ width: `${pct}%` }} />
        </div>
        <span>
          {poll.closed
            ? `${Math.round(pct)}% ${poll.options[0]}`
            : `${poll.total_votes}/120 ${S.voted}`}
        </span>
      </div>
    </Html>
  );
}
export function Scene() {
  const {
    winter,
    night,
    quality,
    snapshot,
    money: showMoney,
    cinematic,
    time,
  } = useView();
  const issues = cinematic
    ? time >= 10
      ? [scriptIssue(time)]
      : []
    : (snapshot?.issues ?? []);
  return (
    <Canvas
      shadows={quality}
      dpr={quality ? [1, 1.5] : 1}
      camera={{ position: [33, 25, 39], fov: 43, near: 0.1, far: 240 }}
      gl={{ antialias: !quality, powerPreference: "high-performance" }}
    >
      <color attach="background" args={[night ? "#102540" : "#eaf0f7"]} />
      <fog attach="fog" args={[night ? "#102540" : "#eaf0f7", 65, 145]} />
      <ambientLight intensity={night ? 0.55 : 0.65} />
      <hemisphereLight args={["#dcecff", "#7891a7", night ? 0.5 : 0.9]} />
      <directionalLight
        position={[-18, 30, 16]}
        intensity={night ? 0.65 : 2.0}
        color={night ? "#96baff" : "#fff2de"}
        castShadow={quality}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0005}
      />
      <Environment resolution={64}>
        <Lightformer
          position={[0, 20, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={40}
          intensity={1.4}
        />
      </Environment>
      <Courtyard />
      <Building />
      <LivePoll />
      <Building x={-32} z={-20} ghost />
      <Building x={9} z={-29} ghost />
      <Skyline />
      {issues.map((i) => (
        <Pin key={i.id} issue={i} />
      ))}
      {cinematic && <ScriptedEffects />}
      {(showMoney || cinematic) && <Flow />}
      <AnnouncementRipple />
      {winter && <Snow />}
      <ContactShadows
        position={[0, 0.17, 3]}
        opacity={night ? 0.2 : 0.24}
        scale={65}
        blur={2.5}
        far={18}
        resolution={quality ? 512 : 128}
        frames={1}
      />
      <CameraRig />
      {quality && (
        <EffectComposer multisampling={0}>
          {[
            <N8AO key="ao" aoRadius={1.4} intensity={0.7} />,
            <Bloom
              key="bloom"
              luminanceThreshold={1}
              intensity={0.25}
              mipmapBlur
            />,
            ...(cinematic
              ? [
                  <DepthOfField
                    key="dof"
                    focusDistance={0.14}
                    focalLength={0.1}
                    bokehScale={0.4}
                    height={360}
                  />,
                ]
              : []),
          ]}
        </EffectComposer>
      )}
    </Canvas>
  );
}
