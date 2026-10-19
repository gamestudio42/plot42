import { BALANCE, PLACEABLE_SPECS, type PlaceableKind } from '@city/shared';
import { formatMoney, t } from '../i18n/pt-BR';
import type { GameSession } from '../state/session';
import { useStore } from '../state/store';
import { TOOL_GROUPS, TOOLS, type ToolDef } from '../tools/tools';
import { ToolIcon } from './icons';

function costLabel(tool: ToolDef): string | null {
  const c = BALANCE.costs;
  switch (tool.id) {
    case 'road':
      return `${formatMoney(c.road)}/lote · ponte ${formatMoney(c.bridge)}`;
    case 'powerLine':
      return `${formatMoney(c.powerLine)}/lote`;
    case 'pipe':
      return `${formatMoney(c.pipe)}/lote`;
    case 'zoneResLight':
    case 'zoneComLight':
    case 'zoneIndLight':
      return `${formatMoney(c.zoneLight)}/lote`;
    case 'zoneResDense':
    case 'zoneComDense':
    case 'zoneIndDense':
      return `${formatMoney(c.zoneDense)}/lote`;
    case 'level':
      return `${formatMoney(c.levelPerUnit)}/unidade de altura`;
    case 'trees':
      return `${formatMoney(c.plantTree)}/lote`;
    case 'select':
    case 'dezone':
    case 'demolish':
      return null;
    default:
      return formatMoney(PLACEABLE_SPECS[tool.id as PlaceableKind].cost);
  }
}

export function Toolbar({ session }: { session: GameSession }) {
  const active = useStore(session.ui, (s) => s.tool);
  return (
    <nav className="toolbar" aria-label="Ferramentas" data-testid="toolbar">
      {TOOL_GROUPS.map((group) => (
        <div key={group} className="tool-group" role="group" aria-label={t.toolGroups[group]}>
          {TOOLS.filter((tool) => tool.group === group).map((tool) => {
            const cost = costLabel(tool);
            const title = [
              t.tools[tool.id],
              cost,
              tool.hotkey ? `Atalho: ${tool.hotkey.toUpperCase()}` : null,
            ]
              .filter(Boolean)
              .join(' — ');
            return (
              <button
                key={tool.id}
                type="button"
                className={`tool-button${active === tool.id ? ' active' : ''}`}
                title={title}
                aria-label={t.tools[tool.id]}
                aria-pressed={active === tool.id}
                data-testid={`tool-${tool.id}`}
                onClick={() => session.setTool(tool.id)}
              >
                <ToolIcon id={tool.id} />
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
