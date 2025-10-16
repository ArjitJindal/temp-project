import s from './style.module.less';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { TableColumn } from '@/components/library/Table/types';
import { RISK_LEVEL } from '@/components/library/Table/standardDataTypes';
import Slider from '@/components/library/Slider';
import { State, TableItem } from '@/pages/risk-levels/configure/RiskClassificationTable/index';

export interface ExternalState {
  state: State | null;
  setState?: React.Dispatch<React.SetStateAction<State | null>>;
  isDisabled: boolean;
  LEVEL_ENTRIES: TableItem[];
}

const helper = new ColumnHelper<TableItem>();

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function getActiveGlobalIndices(entries: TableItem[]) {
  return entries.filter((t) => t.isActive).map((t) => t.index);
}

export const columns: TableColumn<TableItem>[] = helper.list([
  helper.simple({
    title: 'Level',
    defaultWidth: 100,
    key: 'key',
    type: RISK_LEVEL,
  }),
  helper.display({
    title: 'Score',
    defaultWidth: 100,
    render: (item, context) => {
      const external = context.external as ExternalState;
      const { state, LEVEL_ENTRIES } = external;

      if (!item.isActive || !state) {
        return '-';
      }

      const activeGlobals = getActiveGlobalIndices(LEVEL_ENTRIES);
      const idxInActive = activeGlobals.indexOf(item.index);
      if (idxInActive === -1) {
        return '-';
      }

      const start = idxInActive === 0 ? 0 : state[activeGlobals[idxInActive - 1]] ?? 0;
      const end = state[activeGlobals[idxInActive]] ?? 100;

      const sStart = Number.isFinite(start) ? start : 0;
      const sEnd = Number.isFinite(end) ? end : 100;

      const isLastActive = idxInActive === activeGlobals.length - 1;

      return isLastActive ? `≥ ${sStart} to ≤ ${sEnd}` : `≥ ${sStart} to < ${sEnd}`;
    },
  }),
  helper.display({
    id: 'score_edit',
    title: 'Range',
    defaultWidth: 300,
    render: (item, context) => {
      const external = context.external as ExternalState;
      const { state, setState, isDisabled, LEVEL_ENTRIES } = external;

      if (!item.isActive || !state || !setState) {
        return <>-</>;
      }

      const activeGlobals = getActiveGlobalIndices(LEVEL_ENTRIES);
      const idxInActive = activeGlobals.indexOf(item.index);
      if (idxInActive === -1) {
        return <>-</>;
      }
      const startGlobalIndex = idxInActive === 0 ? null : activeGlobals[idxInActive - 1];
      const endGlobalIndex = activeGlobals[idxInActive];

      const start = startGlobalIndex === null ? 0 : state[startGlobalIndex] ?? 0;
      const end = state[endGlobalIndex] ?? 100;

      const valueStart = Number.isFinite(start) ? start : 0;
      const valueEnd = Number.isFinite(end) ? end : 100;

      const isLastActive = idxInActive === activeGlobals.length - 1;

      return (
        <Slider
          className={s.slider}
          mode="RANGE"
          isDisabled={isDisabled}
          min={0}
          max={100}
          value={[valueStart, valueEnd]}
          endExclusive={!isLastActive}
          onChange={(newValue) => {
            if (!setState || !newValue) {
              return;
            }
            const [rawStart, rawEnd] = newValue;

            setState((prev) => {
              if (!prev) {
                return prev;
              }
              const updated = [...prev];

              const m = activeGlobals.length;
              const gPrev = startGlobalIndex;
              const gCurr = endGlobalIndex;
              const gPrevPrev = idxInActive >= 2 ? activeGlobals[idxInActive - 2] : null;
              const gNext = idxInActive + 1 < m ? activeGlobals[idxInActive + 1] : null;

              // Determine limits for this slider
              const lowerLimitForStart = gPrevPrev !== null ? updated[gPrevPrev] ?? 0 : 0;
              const upperLimitForStart =
                (rawEnd === undefined ? (gCurr !== null ? updated[gCurr] : 100) : rawEnd) - 1;

              const clampedStart = clamp(
                Math.round(rawStart),
                lowerLimitForStart,
                upperLimitForStart,
              );

              const lowerLimitForEnd = clampedStart + 1;
              const upperLimitForEnd = gNext !== null ? updated[gNext] ?? 100 : 100;
              const clampedEnd = clamp(Math.round(rawEnd), lowerLimitForEnd, upperLimitForEnd);

              if (gPrev !== null) {
                updated[gPrev] = clampedStart;
              }
              updated[gCurr] = clampedEnd;

              for (let i = 0; i < updated.length; i++) {
                if (!activeGlobals.includes(i)) {
                  const prevActive = [...activeGlobals].filter((a) => a < i).pop();
                  updated[i] = prevActive !== undefined ? updated[prevActive] : 0;
                }
              }

              updated[0] = 0;
              for (let i = 1; i < updated.length; i++) {
                updated[i] = Math.max(updated[i], updated[i - 1]);
              }
              updated[updated.length - 1] = 100;

              return updated as State;
            });
          }}
        />
      );
    },
  }),
]);
