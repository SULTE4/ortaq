import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ApartmentSchematic, PlanDrawing } from './ApartmentSchematic';
import { localPoint, type ApartmentCell, type FacadeWindow } from './apartmentPlan';
import type { ManagedBuilding } from './buildingModel';
import { Icon } from './icons';
import { loadPlanMedia, planImageFor } from './planMedia';
import { drawingPlan } from './drawingPlan';
import { EntranceFloor } from './EntranceFloor';

function PlanViewer({ url = '', pdf = false, apartment, close, generated, building, initialFloor = false }: { initialFloor?: boolean; building: ManagedBuilding; url?: string; pdf?: boolean; apartment: number; close: () => void; generated?: { cell: ApartmentCell; windows: FacadeWindow[] } }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [zoom, setZoom] = useState(1);
  const [floor, setFloor] = useState(initialFloor);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [image, setImage] = useState(() => {
    if (!generated) return { width: 1, height: 1 };
    const plan = drawingPlan(generated.cell, generated.windows, generated.cell.loggiaSides);
    return { width: (plan.width + 3.6) * 100, height: (plan.height + 3.6) * 100 };
  });
  useEffect(() => {
    if (!generated) return;
    if (floor) {
      const points = generated.cell.section.outline.map(p => localPoint(generated.cell.section, p));
      setImage({ width: ((Math.max(...points.map(p => p[0])) - Math.min(...points.map(p => p[0]))) * 2.5 + 2.4) * 100, height: ((Math.max(...points.map(p => p[1])) - Math.min(...points.map(p => p[1]))) * 2.5 + 2.4) * 100 });
    } else {
      const plan = drawingPlan(generated.cell, generated.windows, generated.cell.loggiaSides);
      setImage({ width: (plan.width + 3.6) * 100, height: (plan.height + 3.6) * 100 });
    }
    stage.current?.scrollTo(0, 0);
  }, [floor, generated]);
  const fit = Math.min(viewport.width / image.width, viewport.height / image.height);
  const changeZoom = (value: number) => setZoom(Math.min(4, Math.max(1, value)));
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    if (!stage.current) return;
    const element = stage.current;
    const measure = () => setViewport({ width: element.clientWidth, height: element.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);
  return createPortal(<dialog ref={dialog} className="plan-dialog" aria-labelledby="plan-title" aria-describedby="plan-help" onCancel={event => { event.preventDefault(); close(); }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const fields = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]')].filter(element => element.getClientRects().length > 0);
      const first = fields[0], last = fields[fields.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <header className="plan-dialog-header">
      <div><h2 id="plan-title">Apartment {apartment} - floor plan</h2><p>{generated ? 'Approximate plan generated from the building model' : "Floor plan from the building's documents"}</p></div>
      <button className="icon-button" aria-label="Close floor plan" onClick={close} autoFocus><Icon name="close" /></button>
    </header>
    {generated && <div className="plan-view-toggle" role="group" aria-label="Plan view"><button aria-pressed={!floor} onClick={() => { setFloor(false); setZoom(1); }}>Apartment</button><button aria-pressed={floor} onClick={() => { setFloor(true); setZoom(1); }}>Floor</button></div>}
    <div className="plan-toolbar">
      <p id="plan-help">{pdf ? 'PDF document' : 'Zoom, then drag to move. Pinch to zoom.'}</p>
      {pdf ? <a href={url} target="_blank" rel="noreferrer">Open PDF in a new tab</a> : <div className="plan-zoom-controls">
        <button aria-label="Zoom out" disabled={zoom === 1} onClick={() => changeZoom(zoom - .5)}>-</button>
        <button aria-label="Reset zoom" onClick={() => { changeZoom(1); stage.current?.scrollTo(0, 0); }}>{Math.round(zoom * 100)}%</button>
        <button aria-label="Zoom in" disabled={zoom === 4} onClick={() => changeZoom(zoom + .5)}>+</button>
      </div>}
    </div>
    {pdf ? <object className="plan-pdf" data={url} type="application/pdf" tabIndex={0} aria-label={`Floor plan PDF for apartment ${apartment}`}><p>Preview unavailable. <a href={url} target="_blank" rel="noreferrer">Open the PDF</a>.</p></object> :
      <div ref={stage} className={`plan-stage ${zoom > 1 ? 'is-zoomed' : ''}`} tabIndex={0} aria-label="Floor plan image. Use plus and minus to zoom, arrow keys to pan."
        onKeyDown={event => {
          if (event.key === '+' || event.key === '=') { event.preventDefault(); changeZoom(zoom + .5); }
          if (event.key === '-') { event.preventDefault(); changeZoom(zoom - .5); }
          const delta: Record<string, [number, number]> = { ArrowLeft: [-60, 0], ArrowRight: [60, 0], ArrowUp: [0, -60], ArrowDown: [0, 60] };
          if (delta[event.key]) { event.preventDefault(); stage.current?.scrollBy(...delta[event.key]); }
        }}
        onPointerDown={event => {
          if (event.button !== 0) return;
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
          const previous = pointers.current.get(event.pointerId);
          if (!previous) return;
          const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)?.[1];
          if (other) {
            const before = Math.hypot(previous.x - other.x, previous.y - other.y);
            const after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
            if (before > 0) changeZoom(zoom * after / before);
          } else if (zoom > 1) {
            event.currentTarget.scrollLeft -= event.clientX - previous.x;
            event.currentTarget.scrollTop -= event.clientY - previous.y;
          }
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        }}
        onPointerUp={event => pointers.current.delete(event.pointerId)}
        onPointerCancel={event => pointers.current.delete(event.pointerId)}
        onLostPointerCapture={event => pointers.current.delete(event.pointerId)}>
        <div className="plan-zoom-content" style={{ width: Math.max(viewport.width, image.width * fit * zoom), height: Math.max(viewport.height, image.height * fit * zoom) }}>{generated ? <div className="plan-generated-zoom" style={{ width: image.width * fit * zoom, height: image.height * fit * zoom }}>{floor ? <EntranceFloor cell={generated.cell} building={building} /> : <PlanDrawing cell={generated.cell} windows={generated.windows} />}</div> : <img src={url} alt={`Uploaded floor plan for apartment ${apartment}`} draggable={false} style={{ width: image.width * fit * zoom, height: image.height * fit * zoom }} onLoad={event => setImage({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />}</div>
      </div>}
  </dialog>, document.body);
}

export function ApartmentFloorPlan({ building, cell, windows, token }: { building: ManagedBuilding; cell: ApartmentCell; windows: FacadeWindow[]; token: string }) {
  const path = planImageFor(building, cell.apartment);
  const [media, setMedia] = useState<{ url: string; pdf: boolean } | null>(null);
  const [failed, setFailed] = useState(false);
  const [decoded, setDecoded] = useState(false);
  const [open, setOpen] = useState(false);
  const [floorOpen, setFloorOpen] = useState(false);
  const [floor, setFloor] = useState(false);
  useEffect(() => {
    if (!path) return;
    let alive = true, url = '';
    const controller = new AbortController();
    loadPlanMedia(path, building.id, token, controller.signal).then(({ blob, pdf }) => {
      if (!alive) return;
      url = URL.createObjectURL(blob);
      setMedia({ url, pdf });
      if (pdf) setDecoded(true);
    }).catch(() => { if (alive) setFailed(true); });
    return () => {
      alive = false;
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [path, building.id, token]);
  if (!path || failed) return <>
    {failed && <p className="plan-error" role="status">The uploaded plan is unavailable. Showing an approximate plan.</p>}
    <div className="plan-view-toggle" role="group" aria-label="Plan view"><button aria-pressed={!floor} onClick={() => setFloor(false)}>Apartment</button><button aria-pressed={floor} onClick={() => setFloor(true)}>Floor</button></div>
    {floor ? <figure className="apartment-plan generated-plan"><button className="generated-plan-open" aria-label={`Enlarge floor plan for apartment ${cell.apartment}`} onClick={() => setOpen(true)}><EntranceFloor cell={cell} building={building} /><span className="generated-plan-hint">Enlarge plan ↗</span></button><figcaption>Approximate plan generated from the building model</figcaption></figure> : <ApartmentSchematic cell={cell} windows={windows} enlarge={() => setOpen(true)} />}
    {open && <PlanViewer building={building} initialFloor={floor} apartment={cell.apartment} generated={{ cell, windows }} close={() => setOpen(false)} />}
  </>;
  return <figure className="apartment-plan uploaded-plan" aria-busy={!decoded}>
    <div className="uploaded-plan-frame">
      {!decoded && <div className="skeleton plan-skeleton" role="status" aria-label="Loading floor plan" />}
      {media && <button className="uploaded-plan-open" aria-label={`Enlarge floor plan for apartment ${cell.apartment}`} aria-haspopup="dialog" disabled={!decoded} onClick={() => setOpen(true)}>
        {media.pdf ? <span className="plan-pdf-preview"><strong>PDF</strong><span>View floor plan</span></span> : <img src={media.url} alt={`Uploaded floor plan for apartment ${cell.apartment}`} onLoad={() => setDecoded(true)} onError={() => setFailed(true)} />}
        {decoded && <span className="plan-enlarge">{media.pdf ? 'Open PDF' : 'Enlarge plan'} ↗</span>}
      </button>}
    </div>
    <figcaption>Floor plan from the building's documents</figcaption>
    <button className="plan-entrance-link" onClick={() => setFloorOpen(true)} aria-haspopup="dialog">View entrance floor</button>
    {floorOpen && <PlanViewer building={building} initialFloor apartment={cell.apartment} generated={{ cell, windows }} close={() => setFloorOpen(false)} />}
    {import.meta.env.DEV && path.endsWith('/r11-fixture.png') && <small className="plan-fixture-note">Development fixture - illustration, not an actual apartment plan.</small>}
    {open && media && <PlanViewer building={building} url={media.url} pdf={media.pdf} apartment={cell.apartment} close={() => setOpen(false)} />}
  </figure>;
}
