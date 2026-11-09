import { localPoint, type ApartmentCell, type Point } from './apartmentPlan';
import { modelFor, type ManagedBuilding } from './buildingModel';
import { useMemo } from 'react';
import { Door } from './ApartmentSchematic';
import { inside } from './drawingPlan';

export function EntranceFloor({ cell, building }: { cell: ApartmentCell; building: ManagedBuilding }) {
  const model = useMemo(() => modelFor(building), [building]);
  const core = model.cores.find(c => c.entrance === cell.entrance)!;
  const flats = model.cells.filter(c => c.entrance === cell.entrance && c.floor === cell.floor);
  const outline = cell.section.outline.map(p => localPoint(cell.section, p));
  const min = Math.min(...outline.map(p => p[0])), top = Math.max(...outline.map(p => p[1]));
  const convert = (p: Point): Point => { const q = localPoint(cell.section, p); return [(q[0] - min) * 2.5, (top - q[1]) * 2.5]; };
  const polygon = (p: Point[]) => p.map(convert).map(q => q.join(',')).join(' ');
  const width = (Math.max(...outline.map(p => p[0])) - min) * 2.5;
  const height = (top - Math.min(...outline.map(p => p[1]))) * 2.5;
  const stair = core.stair.map(convert), sx = Math.min(...stair.map(p => p[0])), sy = Math.min(...stair.map(p => p[1]));
  const sw = Math.max(...stair.map(p => p[0])) - sx, sh = Math.max(...stair.map(p => p[1])) - sy;
  return <svg className="plan-drawing entrance-floor" viewBox={`-1.2 -1.2 ${width + 2.4} ${height + 2.4}`} style={{ fontSize: .5 }} role="img" aria-label={`Entrance ${cell.entrance}, floor ${cell.floor}. Stair, lift, landing and apartments ${flats.map(f => f.apartment).join(', ')}. Apartment ${cell.apartment} selected.`}>
    <rect x="-1.2" y="-1.2" width={width + 2.4} height={height + 2.4} fill="#fcfaf4" />
    <polygon points={polygon(cell.section.outline)} fill="#f1ebdb" className="drawing-exterior" />
    <polygon points={polygon(core.landing)} fill="#ece7da" />
    {core.utilities?.map((room, i) => {
      const p = room.map(convert), x = p.reduce((s, q) => s + q[0] / p.length, 0), y = p.reduce((s, q) => s + q[1] / p.length, 0);
      return <g key={`utility-${i}`} data-common-room="utility"><polygon points={polygon(room)} style={{ fill: '#e8e5dc' }} className="drawing-exterior" /><text x={x} y={y} fontSize=".4" className="drawing-room-label">Utility</text></g>;
    })}
    {flats.map(flat => {
      const shape = flat.outline.map(convert), xs = shape.map(p => p[0]), ys = shape.map(p => p[1]);
      let p = convert([flat.centre[0], flat.centre[2]]), clearance = -1;
      for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) {
        const q: Point = [Math.min(...xs) + (Math.max(...xs) - Math.min(...xs)) * (x + .5) / 16, Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * (y + .5) / 16];
        if (!inside(q, shape)) continue;
        const gap = Math.min(...shape.map((a, i) => {
          const b = shape[(i + 1) % shape.length], dx = b[0] - a[0], dy = b[1] - a[1];
          const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (dx * dx + dy * dy)));
          return Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy);
        }));
        if (gap > clearance) { p = q; clearance = gap; }
      }
      return <g key={flat.apartment} data-flat={flat.apartment} data-selected={flat.apartment === cell.apartment}>
        <polygon points={polygon(flat.outline)} style={{ fill: flat.apartment === cell.apartment ? '#f2d39f' : '#e7dfcf' }} className="drawing-exterior" />
        <text x={p[0]} y={p[1]} fontSize=".85" className="drawing-room-label">{flat.apartment}<tspan x={p[0]} dy="1.3em" fontSize=".45">{flat.rooms} {flat.rooms === 1 ? 'room' : 'rooms'}</tspan></text>
      </g>;
    })}
    <polygon points={polygon(core.stair)} style={{ fill: '#e3e6dd' }} className="drawing-exterior" />
    {Array.from({ length: 10 }, (_, i) => <path key={i} d={`M${sx + (i + 1) * sw / 11},${sy}v${sh}`} stroke="#9c9484" strokeWidth=".035" />)}
    <path d={`M${sx + .25},${sy + sh * .33}h${sw - .5}m-.35,-.2l.35,.2l-.35,.2M${sx + sw - .25},${sy + sh * .67}h${-sw + .5}m.35,-.2l-.35,.2l.35,.2`} stroke="#6a604f" strokeWidth=".04" fill="none" />
    <text x={sx + sw / 2} y={sy + sh / 2} fontSize=".5" className="drawing-room-label">Stair</text>
    {core.lifts.map((lift, i) => {
      const p = lift.map(convert), x = Math.min(...p.map(q => q[0])), y = Math.min(...p.map(q => q[1]));
      const w = Math.max(...p.map(q => q[0])) - x, h = Math.max(...p.map(q => q[1])) - y;
      return <g key={i}><polygon points={polygon(lift)} style={{ fill: '#e0e8e5' }} className="drawing-exterior" /><path d={`M${x},${y}l${w},${h}M${x + w},${y}l${-w},${h}`} stroke="#9aaba6" strokeWidth=".035" /><text x={x + w / 2} y={y + h / 2} fontSize=".4" className="drawing-room-label">Lift</text></g>;
    })}
    {[...flats.map(flat => ({ ...flat.entry, id: `flat-${flat.apartment}` })), ...core.doors.map((d, i) => ({ ...d, id: `core-${i}` }))].map(d => {
      const p = convert(d.point), q = convert([d.point[0] + d.inward[0], d.point[1] + d.inward[1]]);
      const inward: Point = [(q[0] - p[0]) / 2.5, (q[1] - p[1]) / 2.5], t: Point = [-inward[1], inward[0]];
      return <Door key={d.id} exterior door={{ id: d.id, room: 'hall', a: [p[0] - t[0] * .425, p[1] - t[1] * .425], b: [p[0] + t[0] * .425, p[1] + t[1] * .425], inward }} />;
    })}
    <text x={width / 2} y={height / 2 + .15} fontSize=".45" className="drawing-room-label">Landing</text>
    <text x={width / 2} y="-.55" fontSize=".45" className="drawing-facade">{cell.section.frontSide === 'street' ? 'Street' : 'Courtyard'}</text>
    <text x={width / 2} y={height + .8} fontSize=".45" className="drawing-facade">{cell.section.frontSide === 'street' ? 'Courtyard' : 'Street'}</text>
  </svg>;
}
