import { useMemo, useRef, type ReactNode } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { labelPlacement, type Rect } from "./framing";
import type { Vec3 } from "./types";

export function SafeLabel({ at, className, children }: { at: Vec3; className: string; children: ReactNode }) {
  const label = useRef<HTMLSpanElement>(null!);
  const vector = useMemo(() => new THREE.Vector3(), []);
  const measure = useRef({ at: 0, obstacles: [] as Rect[] });
  return <Html position={at} zIndexRange={[3, 0]} calculatePosition={(object, camera, size) => {
    vector.setFromMatrixPosition(object.matrixWorld).project(camera);
    const x = (vector.x + 1) * size.width / 2, y = (1 - vector.y) * size.height / 2;
    const el = label.current;
    if (!el) return [x, y];
    const now = performance.now();
    if (now - measure.current.at > 120) {
      measure.current = { at: now, obstacles: [...document.querySelectorAll<HTMLElement>(".right-panel, .apartment-note, .scene-title, .scene-tools, .scene-bottom, .scene-details, .roof-poll, .chapter-title, .cinema-bottom, .phone-mock, .cinema-fact, .cinema-poll, .cinema-top, .neighbour-label, .window-focus-label, .resolved-label, .pin-tooltip")]
        .filter(other => !other.contains(el) && getComputedStyle(other).visibility !== "hidden")
        // Later labels yield to earlier labels so two labels cannot chase each other.
        .filter(other => !other.matches(".neighbour-label, .window-focus-label, .resolved-label, .pin-tooltip") || !!(el.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_PRECEDING))
        .map(other => other.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0) };
    }
    const box = labelPlacement(x, y, el.offsetWidth, el.offsetHeight, { left: 16, top: 155, right: size.width - 16, bottom: size.height - 24 }, measure.current.obstacles);
    el.style.visibility = box && vector.z < 1 ? "visible" : "hidden";
    return box ? [box.left, box.top] : [x, y];
  }}><span ref={label} className={className}>{children}</span></Html>;
}

