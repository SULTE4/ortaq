import { ApartmentHighlight } from "./ApartmentHighlight";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  Boxes,
  roundedGeometry,
  windowFrameGeometry,
} from "./SceneGeometry";
import { useView } from "./store";
import { statusColors } from "./domain";
import { S } from "./strings";
import { scriptIssue, scriptVotedApartments } from "./cinematic";
import { SafeLabel } from "./SafeLabel";
import { RealBuilding } from "./RealBuilding";
import { useBuildingModel } from "./BuildingContext";
import { modelFocus, modelIssue } from "./buildingModel";
import { embed } from "./session";
import { activePalette } from "./palette";
import type { Issue, Vec3 } from "./types";

function Windows({ interactive }: { interactive: boolean }) {
  const temp = useMemo(() => new THREE.Object3D(), []);
  const ref = useRef<THREE.InstancedMesh>(null!);
  const frame = useRef<THREE.InstancedMesh>(null!);
  const { night, snapshot, balances, cinematic, time, focus, set } = useView();
  const model = useBuildingModel();
  const panes = model.windows;
  const voted = !interactive
    ? []
    : cinematic
      ? scriptVotedApartments(time)
      : ((snapshot?.polls.find((p) => !p.closed) ?? snapshot?.polls[0])
          ?.voted_apartments ?? []);

  const curtains = useMemo(
    () =>
      panes
        .filter((w, i) => w.apartment !== null && i % 3 === 0)
        .map((w) => ({
          at: [
            w.position[0] + Math.sin(w.rotation) * 0.06,
            w.position[1],
            w.position[2] + Math.cos(w.rotation) * 0.06,
          ] as Vec3,
          size: [0.1, 0.59, 0.025] as Vec3,
          rotation: [0, w.rotation, 0] as Vec3,
          color: "#C4CDD4",
        })),
    [panes],
  );

  useLayoutEffect(() => {
    panes.forEach((w, i) => {
      temp.position.set(
        w.position[0] + Math.sin(w.rotation) * 0.075,
        w.position[1],
        w.position[2] + Math.cos(w.rotation) * 0.075,
      );
      temp.rotation.set(0, w.rotation, 0);
      const paneScale = (w.width ?? 0.48) / 0.48;
      temp.scale.set(w.apartment === null ? 0.5 : paneScale, 1, 1);
      temp.updateMatrix();
      ref.current.setMatrixAt(i, temp.matrix);
      temp.scale.set(w.apartment === null ? 0.28 : 0.56 * paneScale, 0.92, 0.6);
      temp.updateMatrix();
      frame.current.setMatrixAt(i, temp.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    frame.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
    frame.current.computeBoundingSphere();
  }, [panes]);

  useLayoutEffect(() => {
    const b = activePalette.building;
    panes.forEach((w, i) => {
      if (w.apartment === null) {
        ref.current.setColorAt(
          i,
          new THREE.Color(night ? b.windowUnlit[0] : "#6E8594"),
        );
        return;
      }
      let color = night
        ? w.apartment % 8 === 0
          ? b.windowUnlit[0]
          : w.apartment % 13 === 0
            ? b.windowUnlit[1]
            : b.windowGold[w.apartment % 4]
        : b.windowDay[w.apartment % 4];
      if (voted.includes(w.apartment)) color = b.votedEmerald;
      if (interactive && balances && !cinematic) {
        const balance = snapshot?.balances?.find(
          (bal) => bal.apartment === w.apartment,
        );
        if (balance)
          color =
            balance.amount < 0
              ? "#C94B4B"
              : balance.amount > 0
                ? b.homeGold
                : b.votedEmerald;
      }
      if (
        interactive &&
        !cinematic &&
        !balances &&
        snapshot?.apartment === w.apartment
      )
        color = b.homeGold;
      if (interactive && cinematic && w.apartment === 45 && time >= 10)
        color = time >= 40 ? b.votedEmerald : "#C94B4B";
      if (interactive && focus === w.apartment) color = "#F6DFBE";
      const c = new THREE.Color(color);
      if (interactive && focus !== null && focus !== w.apartment && !cinematic)
        c.multiplyScalar(0.8);
      ref.current.setColorAt(i, c);
    });
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [
    night,
    snapshot,
    balances,
    focus,
    voted.join(","),
    cinematic,
    Math.floor(time),
    panes,
    interactive,
  ]);

  return (
    <>
      <instancedMesh
        ref={frame}
        args={[windowFrameGeometry, undefined, panes.length]}
      >
        <meshStandardMaterial
          color={activePalette.building.windowFrame}
          roughness={0.88}
          metalness={0.04}
        />
      </instancedMesh>
      <instancedMesh
        ref={ref}
        name="apartment-panes"
        args={[roundedGeometry([0.48, 0.64, 0.06]), undefined, panes.length]}
        onClick={(e) => {
          if (
            interactive &&
            e.instanceId !== undefined &&
            panes[e.instanceId].apartment !== null
          ) {
            e.stopPropagation();
            set({
              focus: panes[e.instanceId].apartment,
              selected: null,
              money: false,
            });
          }
        }}
        onPointerOver={(e) => {
          if (
            interactive &&
            e.instanceId !== undefined &&
            panes[e.instanceId].apartment !== null
          )
            document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <meshStandardMaterial
          toneMapped={true}
          roughness={0.42}
          metalness={night ? 0 : 0.06}
          emissive="#ffffff"
          emissiveIntensity={night ? 0.34 : 0.04}
          onBeforeCompile={(shader) => {
            shader.vertexShader = shader.vertexShader
              .replace("#include <common>", "#include <common>\nvarying vec3 vWindowTint;")
              .replace(
                "#include <begin_vertex>",
                "#include <begin_vertex>\n#ifdef USE_INSTANCING_COLOR\nvWindowTint=instanceColor;\n#else\nvWindowTint=vec3(1.);\n#endif",
              );
            shader.fragmentShader = shader.fragmentShader
              .replace("#include <common>", "#include <common>\nvarying vec3 vWindowTint;")
              .replace(
                "#include <emissivemap_fragment>",
                "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vWindowTint;",
              );
          }}
        />
      </instancedMesh>
      <Boxes items={curtains} unlit />
    </>
  );
}

function FocusedWindow() {
  const { focus, cinematic, selected, money, snapshot, set } = useView();
  const compactEmbed =
    embed === "resident" ||
    new URLSearchParams(location.search).get("mini") === "1";
  const apartment = focus ?? snapshot?.apartment;
  const model = useBuildingModel();
  if (!apartment || cinematic || selected || money) return null;
  const cell = model.cells.find((c) => c.apartment === apartment);
  if (!cell) return null;
  const p = modelFocus(model, apartment);
  if (focus === null) {
    if (compactEmbed) return null;
    return (
      <SafeLabel
        at={[p[0], p[1] + 0.65, p[2]]}
        className="window-focus-label"
      >
        <button
          className="home-anchor"
          onClick={() =>
            set({ focus: apartment, selected: null, money: false })
          }
        >
          Apt {apartment}
        </button>
      </SafeLabel>
    );
  }
  return (
    <>
      <ApartmentHighlight key={apartment} cell={cell} />
      {model.windows
        .filter((w) => w.apartment === apartment)
        .map((w) => (
          <group
            key={w.id}
            position={[
              w.position[0] + Math.sin(w.rotation) * 0.075,
              w.position[1],
              w.position[2] + Math.cos(w.rotation) * 0.075,
            ]}
            rotation={[0, w.rotation, 0]}
            scale={[(w.width ?? 0.48) / 0.48, 1, 1]}
          >
            {[-1, 1].map((side) => (
              <group key={side}>
                <mesh position={[0, side * 0.41, 0.13]}>
                  <boxGeometry args={[0.65, 0.04, 0.04]} />
                  <meshBasicMaterial
                    color="#E2942A"
                    toneMapped={true}
                    depthTest={false}
                  />
                </mesh>
                <mesh position={[side * 0.32, 0, 0.13]}>
                  <boxGeometry args={[0.04, 0.84, 0.04]} />
                  <meshBasicMaterial
                    color="#E2942A"
                    toneMapped={true}
                    depthTest={false}
                  />
                </mesh>
              </group>
            ))}
          </group>
        ))}
      <SafeLabel
        at={[p[0], p[1] + 0.65, p[2] + 0.3]}
        className="window-focus-label"
      >
        {snapshot?.apartment === apartment
          ? `Your home · Apt ${apartment}`
          : `${S.apartmentNumber} ${apartment}`}
      </SafeLabel>
    </>
  );
}

function Pin({
  issue,
  slotIndex = 0,
  slotCount = 1,
}: {
  issue: Issue;
  slotIndex?: number;
  slotCount?: number;
}) {
  const set = useView((s) => s.set),
    selected = useView((s) => s.selected);
  const color = statusColors[issue.status],
    size = 0.28 + Math.min(issue.supporters.length, 20) * 0.02;
  const model = useBuildingModel();
  const baseAt = modelIssue(model, issue.location);
  const entrance =
    model.entrances[Math.max(0, issue.location.entrance - 1)] ??
    model.entrances[0];
  const rot = entrance.rotation;
  const isNearCanopy = !!issue.location.area || issue.location.floor <= 2;
  // Spread pins cleanly along each entrance tangent and clear the +/-1.15m canopy roof on floors 1-2.
  const canopySlots = [-2.4, 2.4, -3.7, 3.7];
  const highSlots = slotCount > 1 ? [-1.15, 1.15, -2.3, 2.3] : [0];
  const hash = [...issue.id].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const alongOffset = isNearCanopy
    ? canopySlots[slotIndex % canopySlots.length]
    : slotCount > 1
      ? highSlots[slotIndex % highSlots.length]
      : ((hash % 3) - 1) * 0.7;
  const outward = 0.32;
  const yOffset = issue.location.area || issue.location.floor === 1 ? 0.42 : 0.2;
  const at: Vec3 = [
    baseAt[0] + alongOffset * Math.cos(rot) + outward * Math.sin(rot),
    baseAt[1] + yOffset,
    baseAt[2] - alongOffset * Math.sin(rot) + outward * Math.cos(rot),
  ];
  return (
    <group
      position={at}
      onClick={(e) => {
        e.stopPropagation();
        set({ selected: issue.id, focus: null, money: false });
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        set({
          selected: issue.id,
          focus: null,
          money: false,
          cameraReset: useView.getState().cameraReset + 1,
        });
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
          args={[selected === issue.id ? size * 1.25 : size, 12, 10]}
        />
        <meshStandardMaterial
          color={color}
          roughness={0.65}
          toneMapped={true}
        />
      </mesh>
      <mesh position={[0, -0.45, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.6, 6]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {selected === issue.id && (
        <SafeLabel at={[0, 0.75, 0]} className="pin-tooltip">
          {issue.status}: {issue.title}
        </SafeLabel>
      )}
    </group>
  );
}

export function DetailedScene({
  interactive = true,
}: {
  interactive?: boolean;
}) {
  const { night, snapshot, cinematic, time } = useView();
  const issues = cinematic
    ? time >= 10
      ? [scriptIssue(time)]
      : []
    : (snapshot?.issues ?? []);
  const pinSlots = useMemo(() => {
    const groups = new Map<string, Issue[]>();
    for (const issue of issues) {
      const bucket =
        issue.location.area || issue.location.floor <= 2
          ? `${issue.location.entrance}-low`
          : `${issue.location.entrance}-${issue.location.floor}`;
      if (!groups.has(bucket)) groups.set(bucket, []);
      groups.get(bucket)!.push(issue);
    }
    const meta = new Map<string, { index: number; count: number }>();
    for (const list of groups.values()) {
      list.forEach((item, index) => meta.set(item.id, { index, count: list.length }));
    }
    return meta;
  }, [issues]);
  return (
    <>
      <ambientLight
        color={night ? "#DDE3EB" : "#F5F7FA"}
        intensity={night ? 0.74 : 0.96}
      />
      <hemisphereLight
        args={[
          night ? "#D0D7E0" : "#F7FAFC",
          night ? "#7D8792" : "#BFC8D2",
          night ? 0.56 : 0.72,
        ]}
      />
      <directionalLight
        position={[-18, 35, 22]}
        color={night ? "#ECE8DE" : "#FFF9F0"}
        intensity={night ? 1.12 : 1.34}
      />
      <directionalLight
        position={[26, 24, -18]}
        color={night ? "#BDCAE0" : "#DCE6F0"}
        intensity={night ? 0.62 : 0.76}
      />
      <RealBuilding />
      <Windows interactive={interactive} />
      {interactive && (
        <>
          <FocusedWindow />
          {issues.map((i) => {
            const slot = pinSlots.get(i.id);
            return (
              <Pin
                key={i.id}
                issue={i}
                slotIndex={slot?.index ?? 0}
                slotCount={slot?.count ?? 1}
              />
            );
          })}
        </>
      )}
    </>
  );
}
