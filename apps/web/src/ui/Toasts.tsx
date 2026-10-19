import type { GameSession } from '../state/session';
import { useStore } from '../state/store';

export function Toasts({ session }: { session: GameSession }) {
  const toasts = useStore(session.ui, (s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite" data-testid="toasts">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className={`toast ${toast.kind}`}
          onClick={() => session.dismissToast(toast.id)}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
