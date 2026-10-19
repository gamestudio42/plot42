import { formatMoney, t } from '../i18n/pt-BR';
import type { GameSession } from '../state/session';
import { useStore } from '../state/store';
import { toolById } from '../tools/tools';

/** Small label next to the cursor with the tool name, cost and validation message. */
export function ToolTooltip({ session }: { session: GameSession }) {
  const preview = useStore(session.ui, (s) => s.preview);
  const pointer = useStore(session.ui, (s) => s.pointer);
  const toolId = useStore(session.ui, (s) => s.tool);
  if (!preview || !pointer) return null;
  const tool = toolById(toolId);
  const showReason = preview.reason && (!preview.ok || preview.reason !== 'ALREADY_BUILT');
  return (
    <div
      className={`tool-tooltip${preview.ok ? '' : ' bad'}`}
      style={{ left: pointer.x + 18, top: pointer.y + 18 }}
      data-testid="tool-tooltip"
    >
      <div className="tool-tooltip-title">{t.tools[tool.id]}</div>
      {preview.count > 0 && (
        <div>
          {t.ui.cost}: {preview.cost > 0 ? formatMoney(preview.cost) : t.ui.free}
          {tool.shape !== 'footprint' && ` · ${preview.count} ${t.ui.tiles}`}
        </div>
      )}
      {showReason && preview.reason && <div className="tool-tooltip-reason">{t.reasons[preview.reason]}</div>}
    </div>
  );
}
