import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

const shown = new Set<string>();
const number = (value: number) => String(value);
export function Count({ id, value, format = number }: { id: string; value: number; format?: (value: number) => string }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(() => reduced || shown.has(id) ? value : 0);
  const first = useRef(true);
  useEffect(() => {
    if (reduced || shown.has(id) || !first.current) { shown.add(id); first.current = false; setDisplay(value); return; }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      // A busy frame can give rAF a timestamp earlier than this effect.
      const progress = Math.min(1, Math.max(0, (now - start) / 700));
      setDisplay(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else { shown.add(id); first.current = false; }
    };
    setDisplay(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [id, value, reduced]);
  return <span className="count"><span className="sr-only">{format(value)}</span><span className="count-size" aria-hidden="true">{format(value)}</span><span aria-hidden="true">{format(reduced ? value : display)}</span></span>;
}
