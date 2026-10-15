interface Props {
  text: string;
  onText: (t: string) => void;
  onFile: (file: File) => void;
  error: string | null;
  busy: boolean;
  onLoad: () => void;
  onClose: () => void;
}

export function ImportDialog({ text, onText, onFile, error, busy, onLoad, onClose }: Props) {
  return (
    <div className="modal" role="dialog" aria-label="Import puzzle" aria-modal="true">
      <div className="modal-card">
        <h2>Import puzzle</h2>
        <p>Paste 81 characters, a grid, a candidate grid, or a HoDoKu library line. The puzzle must have exactly one solution.</p>
        <textarea value={text} onChange={(e) => onText(e.target.value)} rows={6} autoFocus />
        <label className="field">
          Open a file
          <input
            type="file"
            accept=".txt,.sdk,.ss,.hkl,text/plain"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
              e.target.value = '';
            }}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <span className="spacer" />
          <button onClick={onClose}>Close</button>
          <button className="primary" onClick={onLoad} disabled={!text.trim() || busy}>
            Load
          </button>
        </div>
      </div>
    </div>
  );
}
