import { HINT_LEVEL_NAMES, type HintLevel, type HintResult } from '../protocol';
import type { GameState } from '../game';
import type { Tab } from '../ui';
import { AllSteps } from './AllSteps';
import { HintView } from './HintView';
import { PathView } from './PathView';
import { SidePanel } from './SidePanel';
import { Summary } from './Summary';

interface Props {
  tab: Tab;
  onTab: (t: Tab) => void;
  game: GameState | null;
  solved: boolean;
  busy: string | null;
  message: string | null;
  hintLevel: HintLevel;
  onHintLevel: (l: HintLevel) => void;
  hint: HintResult | null;
  onHint: () => void;
  onApplyHint: () => void;
  onDismissHint: () => void;
  onSelectStep: (h: HintResult) => void;
  allSteps: { results: HintResult[]; total: Record<string, number> } | null;
  onRefreshSteps: () => void;
  pathSteps: HintResult[] | null;
  pathDone: number;
  onNextStep: () => void;
  onSolveUpTo: (level: HintLevel) => void;
  onRefreshPath: () => void;
}

/** The side panel with its four tabs (Hint, All steps, Path, Summary). App renders it twice: beside the board and in the phone sheet. */
export function SolverPanel(p: Props) {
  return (
    <SidePanel tab={p.tab} onTab={p.onTab} hintLevel={p.hintLevel} onHintLevel={p.onHintLevel}>
      {p.tab === 'hint' && (
        <HintView
          hint={p.hint}
          message={p.message}
          busy={p.busy}
          solved={p.solved}
          disabled={!p.game}
          onHint={p.onHint}
          onApply={p.onApplyHint}
          onDismiss={p.onDismissHint}
        />
      )}
      {p.tab === 'steps' && (
        <AllSteps
          data={p.allSteps}
          hintLevelName={p.hintLevel === 5 ? 'Everything' : HINT_LEVEL_NAMES[p.hintLevel]}
          selected={p.hint}
          busy={p.busy}
          disabled={!p.game || p.solved}
          onRefresh={p.onRefreshSteps}
          onSelect={p.onSelectStep}
          onApply={p.onApplyHint}
        />
      )}
      {p.tab === 'path' && (
        <PathView
          steps={p.pathSteps}
          done={p.pathDone}
          busy={p.busy}
          disabled={!p.game}
          onNext={p.onNextStep}
          onSolveUpTo={p.onSolveUpTo}
          onRefresh={p.onRefreshPath}
        />
      )}
      {p.tab === 'summary' && <Summary game={p.game} />}
    </SidePanel>
  );
}
