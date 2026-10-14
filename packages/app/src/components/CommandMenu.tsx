import { useEffect, useMemo, useRef, useState } from 'react';

export interface Command {
  label: string;
  hint?: string;
  run: () => void;
  disabled?: boolean;
}

export function CommandMenu({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return commands.filter((c) => !c.disabled && words.every((w) => c.label.toLowerCase().includes(w)));
  }, [q, commands]);
  const run = (c?: Command) => {
    if (!c) return;
    onClose();
    c.run();
  };
  return (
    <div className="modal top" role="dialog" aria-label="Commands" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card cmd">
        <input
          ref={input}
          value={q}
          placeholder="Type a command"
          aria-label="Search commands"
          onChange={(e) => (setQ(e.target.value), setSel(0))}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowDown') (e.preventDefault(), setSel((s) => Math.min(list.length - 1, s + 1)));
            else if (e.key === 'ArrowUp') (e.preventDefault(), setSel((s) => Math.max(0, s - 1)));
            else if (e.key === 'Enter') run(list[sel]);
          }}
        />
        <ul role="listbox">
          {list.map((c, i) => (
            <li key={c.label}>
              <button role="option" aria-selected={i === sel} className={i === sel ? 'on' : ''} onClick={() => run(c)} onMouseEnter={() => setSel(i)}>
                {c.label}
                {c.hint && <kbd>{c.hint}</kbd>}
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="note">No matching command</li>}
        </ul>
      </div>
    </div>
  );
}
