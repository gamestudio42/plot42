import type { ReactElement } from 'react';
import type { ToolId } from '../tools/tools';

const zoneIcon = (color: string, letter: string, dense: boolean): ReactElement => (
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" fill={color} opacity={dense ? 1 : 0.55} />
    {dense && (
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        fill="none"
        stroke="#fff"
        strokeWidth="1.5"
        strokeDasharray="3 2"
      />
    )}
    <text x="12" y="16.5" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
      {letter}
    </text>
  </>
);

const building = (roof: string, wall: string, extra?: ReactElement): ReactElement => (
  <>
    <rect x="5" y="9" width="14" height="11" fill={wall} />
    <path d="M3 10 L12 3 L21 10 Z" fill={roof} />
    {extra}
  </>
);

const ICONS: Record<ToolId, ReactElement> = {
  select: <path d="M5 3 L5 19 L9.5 15 L12.5 21 L15 20 L12 14 L18 14 Z" fill="#e8eef6" />,
  road: (
    <>
      <path d="M9 2 H15 L21 22 H3 Z" fill="#5a6270" stroke="#aab4c0" strokeWidth="1.2" />
      <path d="M12 4 V7 M12 10 V14 M12 17 V21" stroke="#f0d050" strokeWidth="1.8" />
    </>
  ),
  powerLine: (
    <>
      <path
        d="M12 2 L7 22 M12 2 L17 22 M8 9 H16 M9 15 H15"
        stroke="#c8ccd2"
        strokeWidth="1.8"
        fill="none"
      />
      <path d="M2 7 Q12 12 22 7" stroke="#f0c030" strokeWidth="1.4" fill="none" />
    </>
  ),
  pipe: (
    <>
      <rect x="2" y="9" width="20" height="6" rx="2" fill="#3090e0" />
      <rect x="6" y="7" width="3" height="10" rx="1" fill="#2070c0" />
      <rect x="15" y="7" width="3" height="10" rx="1" fill="#2070c0" />
    </>
  ),
  zoneResLight: zoneIcon('#3fbf4f', 'R', false),
  zoneResDense: zoneIcon('#2f9f3f', 'R', true),
  zoneComLight: zoneIcon('#3f7fdf', 'C', false),
  zoneComDense: zoneIcon('#2f5fbf', 'C', true),
  zoneIndLight: zoneIcon('#e0b030', 'I', false),
  zoneIndDense: zoneIcon('#c09020', 'I', true),
  dezone: (
    <>
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        fill="none"
        stroke="#94a3b8"
        strokeWidth="2"
        strokeDasharray="4 3"
      />
      <path d="M7 7 L17 17 M17 7 L7 17" stroke="#f87171" strokeWidth="2.4" />
    </>
  ),
  demolish: (
    <>
      <rect x="3" y="12" width="13" height="7" rx="1.5" fill="#e0a020" />
      <path d="M16 13 L21 9 L22 18 L16 18 Z" fill="#c08010" />
      <circle cx="6.5" cy="20" r="2" fill="#333" />
      <circle cx="12.5" cy="20" r="2" fill="#333" />
      <rect x="6" y="7" width="6" height="5" fill="#f0c040" />
    </>
  ),
  level: (
    <>
      <path d="M2 18 L8 10 L12 14 L16 8 L22 18 Z" fill="#7a9a50" />
      <path d="M2 19 H22" stroke="#f0d050" strokeWidth="2" />
    </>
  ),
  trees: (
    <>
      <path d="M8 3 L3 14 H13 Z" fill="#3f9f3f" />
      <rect x="7" y="14" width="2" height="5" fill="#6b4a2a" />
      <path d="M16 6 L11 17 H21 Z" fill="#2f7f2f" />
      <rect x="15" y="17" width="2" height="4" fill="#6b4a2a" />
    </>
  ),
  coalPlant: building('#555', '#8a8a8a', <rect x="14" y="2" width="3" height="8" fill="#666" />),
  gasPlant: building('#7a7a90', '#a0a0b8', <circle cx="12" cy="15" r="3" fill="#e0e0f0" />),
  windTurbine: (
    <>
      <path d="M12 10 L11 22 H13 Z" fill="#e8eef6" />
      <path d="M12 10 L12 2 M12 10 L5 14 M12 10 L19 14" stroke="#e8eef6" strokeWidth="2" />
    </>
  ),
  waterPump: building(
    '#2070c0',
    '#5aa0e0',
    <path d="M12 12 Q9 16 12 18 Q15 16 12 12 Z" fill="#fff" />,
  ),
  policeStation: building(
    '#2040a0',
    '#6080c0',
    <path d="M12 11 L14 15 L12 18 L10 15 Z" fill="#f0d050" />,
  ),
  fireStation: building(
    '#b02020',
    '#e06050',
    <rect x="9" y="13" width="6" height="7" fill="#601010" />,
  ),
  school: building('#a06020', '#e0b070', <rect x="11.5" y="1" width="1" height="5" fill="#333" />),
  hospital: building(
    '#d0d0d0',
    '#f4f4f4',
    <path
      d="M10.5 11 H13.5 V13.5 H16 V16.5 H13.5 V19 H10.5 V16.5 H8 V13.5 H10.5 Z"
      fill="#d03030"
    />,
  ),
  park: (
    <>
      <rect x="2" y="13" width="20" height="8" rx="2" fill="#4caf50" />
      <circle cx="9" cy="10" r="5" fill="#2e7d32" />
      <rect x="8" y="13" width="2" height="5" fill="#6b4a2a" />
      <circle cx="17" cy="16" r="2" fill="#81d4fa" />
    </>
  ),
};

export function ToolIcon({ id }: { id: ToolId }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      {ICONS[id]}
    </svg>
  );
}
