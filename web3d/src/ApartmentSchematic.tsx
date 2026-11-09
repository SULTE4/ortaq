import { useId, useMemo } from 'react';
import type { ApartmentCell, FacadeWindow, Point } from './apartmentPlan';
import { add, distance, drawingPlan, furnishing, midpoint, roomLabel, hallLabel, type Furniture, type PlanOpening } from './drawingPlan';

const points = (polygon: Point[]) => polygon.map(p => p.join(',')).join(' ');
export function Door({ door, exterior = false }: { door: PlanOpening; exterior?: boolean }) {
  const tip = add(door.a, door.inward, distance(door.a, door.b));
  const cross = (door.b[0] - door.a[0]) * door.inward[1] - (door.b[1] - door.a[1]) * door.inward[0];
  const r = distance(door.a, door.b);
  return <g className="drawing-door">
    <path d={`M${door.a}L${door.b}`} stroke="#F6F9FC" strokeWidth={exterior ? .29 : .15} />
    <path d={`M${door.b}A${r},${r} 0 0 ${cross > 0 ? 1 : 0} ${tip}M${tip}L${door.a}`} fill="none" stroke="#687889" strokeWidth=".035" />
  </g>;
}
function Symbol({ item }: { item: Furniture }) {
  const f = item.rotated ? { ...item, w: item.h, h: item.w } : item;
  return <g transform={`translate(${item.x} ${item.y})${item.rotated ? ` translate(${item.w} 0) rotate(90)` : ''}${f.kind === 'toilet' ? ` translate(${f.w} ${f.h}) rotate(180)` : ''}`} className={`drawing-furniture furniture-${f.kind}`}>
    {f.kind === 'bed' ? <><rect width={f.w} height={f.h} fill="#f8e9b8" /><path d={`M.06,.65H${f.w - .06}M.06,1.8H${f.w - .06}`} /><rect x=".1" y=".1" width={f.w / 2 - .15} height=".4" rx=".06" fill="#fffaf0" />{f.w > 1.3 && <rect x={f.w / 2 + .05} y=".1" width={f.w / 2 - .15} height=".4" rx=".06" fill="#fffaf0" />}</> :
      f.kind === 'sofa' ? <><rect width={f.w} height={f.h} rx=".1" fill="#aab9ad" /><rect x=".15" y=".18" width={f.w - .3} height={f.h - .32} rx=".04" /><path d={`M${f.w / 2},.18V${f.h - .14}`} /></> :
      f.kind === 'dining' ? <><rect x=".24" y=".24" width={f.w - .48} height={f.h - .48} rx=".12" fill="#eee1c7" />{[0, 1].map(i => <g key={i}><rect x={.3 + i * .4} y="0" width=".3" height=".2" rx=".04" fill="#c1b6a2" /><rect x={.3 + i * .4} y={f.h - .2} width=".3" height=".2" rx=".04" fill="#c1b6a2" /></g>)}</> :
      f.kind === 'counter' ? <><rect width={f.w} height={f.h} fill="#e0d6c3" /><rect x=".1" y=".16" width=".4" height=".55" rx=".07" fill="#dfedf0" /><circle cx=".3" cy=".44" r=".03" /><rect x=".08" y={f.h - .68} width=".46" height=".56" fill="#f5f4ed" />{[.2, .42].flatMap(x => [f.h - .55, f.h - .32].map(y => <circle key={`${x}-${y}`} cx={x} cy={y} r=".075" />))}</> :
      f.kind === 'tub' ? <><rect width={f.w} height={f.h} fill="#fafbf8" /><rect x=".08" y=".08" width={f.w - .16} height={f.h - .16} rx=".25" fill="#dfedf0" /><circle cx={f.w / 2} cy=".25" r=".035" /></> :
      f.kind === 'shower' ? <><rect width={f.w} height={f.h} fill="#dfedf0" /><path d={`M0,0L${f.w},${f.h}M${f.w},0L0,${f.h}`} /><circle cx={f.w / 2} cy={f.h / 2} r=".045" fill="#fafbf8" /></> :
      f.kind === 'toilet' ? <><rect width={f.w} height=".2" fill="#fafbf8" /><ellipse cx={f.w / 2} cy=".42" rx={f.w * .46} ry=".23" fill="#fafbf8" /><ellipse cx={f.w / 2} cy=".42" rx={f.w * .28} ry=".15" /></> :
      f.kind === 'sink' ? <><rect width={f.w} height={f.h} fill="#fafbf8" /><ellipse cx={f.w / 2} cy={f.h / 2} rx={f.w * .35} ry={f.h * .3} fill="#dfedf0" /></> :
      <><rect width={f.w} height={f.h} fill={f.kind === 'table' ? '#efe1c7' : '#e2ded1'} />{f.kind === 'wardrobe' ? <path d={`M0,0L${f.w},${f.h}M${f.w},0L0,${f.h}`} /> : f.kind === 'fridge' ? <path d={`M.06,.15H${f.w - .06}`} /> : null}</>}
  </g>;
}

export function PlanDrawing({ cell, windows }: { cell: ApartmentCell; windows: FacadeWindow[] }) {
  const id = useId().replace(/:/g, '');
  const { plan, font, contents, hall } = useMemo(() => {
    const plan = drawingPlan(cell, windows, cell.loggiaSides);
    const font = Math.max(.36, Math.min(.46, (plan.height + 3.6) * .027));
    const doors = [...plan.doors, ...plan.balconies.map(b => b.door)];
    const contents = plan.rooms.map(room => {
      const furniture = furnishing(room, doors, plan.windows);
      return { room, furniture, label: roomLabel(room, furniture, doors, font) };
    });
    return { plan, font, contents, hall: hallLabel(plan, font) };
  }, [cell, windows]);
  const pad = 1.9;
  const minX = Math.min(0, ...(plan.landing?.map(p => p[0]) ?? [0])) - pad;
  const minY = Math.min(0, ...(plan.landing?.map(p => p[1]) ?? [0])) - pad;
  const maxX = Math.max(plan.width, ...(plan.landing?.map(p => p[0]) ?? [plan.width])) + pad;
  const maxY = Math.max(plan.height, ...(plan.landing?.map(p => p[1]) ?? [plan.height])) + pad;
  const entrance = plan.doors.find(d => d.id === 'entrance');
  const leftLanding = (entrance?.inward[0] ?? 0) > .7, topLanding = (entrance?.inward[1] ?? 0) > .7;
  const dimension = (a: Point, b: Point, offset: Point, value: number, key: string) => {
    const p = add(a, offset, 1), q = add(b, offset, 1), mid = midpoint(p, q);
    return <g key={key} className="drawing-dimension"><path d={`M${a}L${add(a, offset, 1.2)}M${b}L${add(b, offset, 1.2)}M${p}L${q}M${p[0] - .09},${p[1] + .09}l.18,-.18M${q[0] - .09},${q[1] + .09}l.18,-.18`} /><text x={mid[0]} y={mid[1] - .12} transform={offset[0] ? `rotate(-90 ${mid[0]} ${mid[1]})` : undefined}>{Math.round(value * 1000 / 10) * 10}</text></g>;
  };
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} className="plan-drawing" role="img" aria-label={`Approximate ${cell.rooms} room floor plan for apartment ${cell.apartment}, about ${Math.round(cell.area)} m2, ${plan.windows.length} windows`} style={{ fontSize: font }}>
    <defs>
      <pattern id={`${id}-wood`} width=".55" height="1.5" patternUnits="userSpaceOnUse"><path d="M0,0V1.5M.55,0V1.5M0,.75H.55" fill="none" stroke="#9AAAB8" strokeWidth=".015" opacity=".32" /></pattern>
      <pattern id={`${id}-tile`} width=".38" height=".38" patternUnits="userSpaceOnUse"><path d="M0,.38V0H.38" fill="none" stroke="#9BB2B8" strokeWidth=".018" opacity=".48" /></pattern>
    </defs>
    <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill="#F6F9FC" />
    {plan.balconies.map((b, i) => <g key={i}><polygon points={points(b.polygon)} fill="#E2EFEA" stroke="#7E9790" strokeWidth=".07" /><path d={`M${add(b.polygon[3], b.door.inward, .13)}L${add(b.polygon[2], b.door.inward, .13)}`} stroke="#7E9790" strokeWidth=".025" /></g>)}
    {plan.landing && <g className="drawing-landing"><polygon points={points(plan.landing)} fill="#E6ECF2" stroke="#B6C2CF" strokeWidth=".035" /></g>}
    <polygon points={points(plan.outline)} fill="#EDF2F7" />
    {contents.map(({ room, furniture }) => <g key={room.id} data-room={room.kind}>
      <polygon points={points(room.polygon)} fill={room.kind === 'living' ? '#F2E7D5' : room.kind === 'bedroom' ? room.name.endsWith('1') ? '#EEE7DF' : '#EDE4E2' : room.kind === 'kitchen' ? '#E5ECE7' : ['storage', 'dressing', 'utility'].includes(room.kind) ? '#E7EBEF' : '#DCE9EE'} />
      <polygon points={points(room.polygon)} fill={`url(#${id}-${room.kind === 'living' || room.kind === 'bedroom' ? 'wood' : 'tile'})`} />
      <polygon points={points(room.polygon)} className="drawing-partition" />
      <g transform={`matrix(${room.tangent[0]} ${room.tangent[1]} ${room.inward[0]} ${room.inward[1]} ${room.origin[0]} ${room.origin[1]})`}>
        {furniture.map((f, i) => <Symbol key={i} item={f} />)}
      </g>
    </g>)}
    <polygon points={points(plan.outline)} className="drawing-exterior" />
    {plan.windows.map(w => <g key={w.id} data-window-id={w.id} data-side={w.side}>
      <path d={`M${w.a}L${w.b}`} stroke="#F6F9FC" strokeWidth=".29" />
      {[-.075, 0, .075].map(n => <path key={n} d={`M${add(w.a, w.inward, n)}L${add(w.b, w.inward, n)}`} stroke="#58808C" strokeWidth=".025" />)}
      <path d={`M${add(w.a, w.inward, -.12)}L${add(w.a, w.inward, .12)}M${add(w.b, w.inward, -.12)}L${add(w.b, w.inward, .12)}`} stroke="#4A5A68" strokeWidth=".04" />
    </g>)}
    {plan.doors.map(d => <Door key={d.id} door={d} exterior={d.id === 'entrance'} />)}
    {plan.balconies.map(b => <Door key={b.door.id} door={b.door} exterior />)}
    {plan.landing && <text x={(plan.landing[0][0] + plan.landing[2][0]) / 2 - (leftLanding ? .15 : 0)} y={(plan.landing[0][1] + plan.landing[2][1]) / 2 - (topLanding ? .15 : 0)} fontSize=".34" className="drawing-room-label">Landing</text>}
    {contents.map(({ room, label }) => {
      const p = label.point;
      return <text key={room.id} x={p[0]} y={p[1]} fontSize={label.font} className="drawing-room-label">{room.name}<tspan x={p[0]} dy="1.2em" className="drawing-area">{label.compact ? `${Math.round(room.area)} m2` : `about ${Math.round(room.area)} m2`}</tspan></text>;
    })}
    <text x={hall.point[0]} y={hall.point[1]} fontSize={hall.font} className="drawing-hall-label">Hall<tspan x={hall.point[0]} dy="1.25em" className="drawing-area">about {Math.round(plan.hallArea)} m2</tspan></text>
    {(['courtyard', 'street'] as const).map(side => {
      const panes = plan.windows.filter(w => w.side === side);
      const pane = panes[Math.floor(panes.length / 2)];
      if (!pane) return null;
      const p = add(midpoint(pane.a, pane.b), pane.inward, -1.45);
      return <text key={side} x={p[0]} y={p[1]} transform={Math.abs(pane.inward[0]) > .7 ? `rotate(-90 ${p[0]} ${p[1]})` : undefined} className="drawing-facade">{side === 'courtyard' ? 'Courtyard' : 'Street'}</text>;
    })}
    {topLanding ? dimension([0, plan.height], [plan.width, plan.height], [0, 1], plan.width, 'width') : dimension([0, 0], [plan.width, 0], [0, -1], plan.width, 'width')}
    {leftLanding ? dimension([plan.width, 0], [plan.width, plan.height], [.65, 0], plan.height, 'depth') : dimension([0, 0], [0, plan.height], [-.65, 0], plan.height, 'depth')}
  </svg>;
}

export function ApartmentSchematic({ cell, windows, enlarge }: { cell: ApartmentCell; windows: FacadeWindow[]; enlarge: () => void }) {
  return <figure className="apartment-plan generated-plan">
    <button className="generated-plan-open" aria-label={`Enlarge floor plan for apartment ${cell.apartment}`} aria-haspopup="dialog" onClick={enlarge}><PlanDrawing cell={cell} windows={windows} /><span className="generated-plan-hint">Enlarge plan ↗</span></button>
    <figcaption>Approximate plan generated from the building model</figcaption>
  </figure>;
}
