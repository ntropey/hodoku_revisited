import { useRef, useState } from 'react';

export type Snap = 'peek' | 'half' | 'full';
const ORDER: Snap[] = ['peek', 'half', 'full'];

interface Props {
  snap: Snap;
  onSnap: (s: Snap) => void;
  children: React.ReactNode;
}

/** Holds the side panel under 960px: three snap points, dragged by the handle or toggled open/closed by a tap. */
export function BottomSheet({ snap, onSnap, children }: Props) {
  const start = useRef<{ y: number; moved: boolean } | null>(null);
  const [drag, setDrag] = useState(0);
  const isOpen = snap !== 'peek';

  const end = (e: React.PointerEvent<HTMLButtonElement>) => {
    const s = start.current;
    start.current = null;
    setDrag(0);
    if (!s) return;
    const dy = e.clientY - s.y;
    const i = ORDER.indexOf(snap);
    if (!s.moved) {
      // Tapping the handle toggles between closed ('peek') and open ('half') so it never traps the screen in 'full'
      onSnap(isOpen ? 'peek' : 'half');
    } else if (dy < -40) {
      onSnap(ORDER[Math.min(2, i + 1)]);
    } else if (dy > 40) {
      onSnap(ORDER[Math.max(0, i - 1)]);
    }
  };

  return (
    <>
      {snap === 'full' && <div className="sheet-backdrop" aria-hidden="true" onClick={() => onSnap('peek')} />}
      <div className={`sheet snap-${snap}`} style={drag ? { transform: `translateY(${drag}px)` } : undefined}>
        <button
          type="button"
          className="grab"
          aria-label={isOpen ? 'Hide hints panel' : 'Open hints panel'}
          onPointerDown={(e) => {
            start.current = { y: e.clientY, moved: false };
            e.currentTarget.setPointerCapture(e.pointerId);
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
            if (e.key === 'Escape' && isOpen) onSnap('peek');
          }}
        >
          <span className="grab-bar" />
          <small className="grab-label">{isOpen ? '▾ Hide' : '▴ Open'}</small>
        </button>
        {children}
      </div>
    </>
  );
}
