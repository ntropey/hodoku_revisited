import { useRef, useState } from 'react';

export type Snap = 'peek' | 'half' | 'full';
const ORDER: Snap[] = ['peek', 'half', 'full'];

interface Props {
  snap: Snap;
  onSnap: (s: Snap) => void;
  children: React.ReactNode;
}

/** Holds the side panel under 960px: three snap points, dragged by the handle or cycled by a tap. */
export function BottomSheet({ snap, onSnap, children }: Props) {
  const start = useRef<{ y: number; moved: boolean } | null>(null);
  const [drag, setDrag] = useState(0);
  const end = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    setDrag(0);
    if (!s) return;
    const dy = e.clientY - s.y;
    const i = ORDER.indexOf(snap);
    if (!s.moved) onSnap(ORDER[(i + 1) % 3]); // a tap: next snap point
    else if (dy < -40) onSnap(ORDER[Math.min(2, i + 1)]);
    else if (dy > 40) onSnap(ORDER[Math.max(0, i - 1)]);
  };
  return (
    <div className={`sheet snap-${snap}`} style={drag ? { transform: `translateY(${drag}px)` } : undefined}>
      <button
        className="grab"
        aria-label={`Panel size: ${snap}. Tap or drag to change`}
        onPointerDown={(e) => {
          start.current = { y: e.clientY, moved: false };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          if (Math.abs(e.clientY - s.y) > 6) s.moved = true;
          if (s.moved) setDrag(Math.max(-200, Math.min(200, e.clientY - s.y)) * 0.3);
        }}
        onPointerUp={end}
        onPointerCancel={() => ((start.current = null), setDrag(0))}
        onKeyDown={(e) => {
          const i = ORDER.indexOf(snap);
          if (e.key === 'ArrowUp') onSnap(ORDER[Math.min(2, i + 1)]);
          if (e.key === 'ArrowDown') onSnap(ORDER[Math.max(0, i - 1)]);
        }}
      >
        <span />
      </button>
      {children}
    </div>
  );
}
