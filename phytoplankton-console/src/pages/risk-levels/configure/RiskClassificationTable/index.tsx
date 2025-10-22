import React, { useEffect } from 'react';
import { RiskClassificationScore, RiskLevel } from '@/apis';
import { RISK_LEVEL_LABELS, RISK_LEVELS } from '@/utils/risk-levels';
import Table from '@/components/library/Table';
import { makeColumns } from '@/pages/risk-levels/configure/RiskClassificationTable/consts';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

export type State = number[];

export interface TableItem {
  key: RiskLevel;
  index: number;
  title: string;
  isActive: boolean;
}

interface Props {
  state: State | null;
  setState?: React.Dispatch<React.SetStateAction<State | null>>;
  isDisabled?: boolean;
}

export type ApiState = Array<RiskClassificationScore>;

export function prepareApiState(state: State | undefined | null): ApiState {
  return RISK_LEVELS.map((riskLevel, index) => ({
    riskLevel,
    lowerBoundRiskScore: state?.[index - 1] ?? 0,
    upperBoundRiskScore: state?.[index] ?? 100,
  }));
}

export function parseApiState(values: ApiState): State {
  const N = RISK_LEVELS.length;
  const entryMap = new Map<RiskLevel, RiskClassificationScore>();
  (values || []).forEach((v) => {
    entryMap.set(v.riskLevel, v);
  });

  const result: number[] = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    const level = RISK_LEVELS[i];
    const entry = entryMap.get(level);
    if (entry && typeof entry.upperBoundRiskScore === 'number') {
      result[i] = entry.upperBoundRiskScore;
    } else {
      result[i] = i === 0 ? 1 : result[i - 1];
    }
  }

  for (let i = 1; i < N; i++) {
    if (result[i] < result[i - 1]) {
      result[i] = result[i - 1];
    }
  }

  result[0] = Math.max(0, result[0]);
  result[N - 1] = 100;

  return result as State;
}

const RiskClassificationTable = (props: Props) => {
  const { state, setState, isDisabled = false } = props;
  const settings = useSettings();

  const LEVEL_ENTRIES = RISK_LEVELS.map((key, i) => ({
    key,
    index: i,
    title: RISK_LEVEL_LABELS[key],
    isActive: settings.riskLevelAlias?.find(({ level }) => level === key)?.isActive ?? true,
  })) as TableItem[];

  useEffect(() => {
    if (!setState) {
      return;
    }
    if (!state) {
      return;
    }

    setState((prev) => {
      if (!prev) {
        return prev;
      }
      const updated = [...prev];
      updated[updated.length - 1] = 100;

      const activeIdxs = LEVEL_ENTRIES.filter((e) => e.isActive).map((e) => e.index);

      if (activeIdxs.length === 0) {
        return prev;
      }

      for (let ai = 0; ai < activeIdxs.length; ai++) {
        const i = activeIdxs[ai];
        const prevActiveIdx = ai === 0 ? null : activeIdxs[ai - 1];
        const nextActiveIdx = ai + 1 < activeIdxs.length ? activeIdxs[ai + 1] : null;

        const prevVal = prevActiveIdx === null ? 0 : updated[prevActiveIdx] ?? 0;
        const currVal = Number.isFinite(updated[i])
          ? updated[i]
          : ai === activeIdxs.length - 1
          ? 100
          : prevVal + 1;

        const minValue = ai === 0 ? 1 : prevVal + (ai === activeIdxs.length - 1 ? 0 : 1);
        const suggested = Math.min(100, Math.max(currVal, minValue, prevVal + 10));

        const nextVal = nextActiveIdx !== null ? updated[nextActiveIdx] ?? 100 : 100;
        const finalVal =
          ai === activeIdxs.length - 1
            ? Math.min(suggested, 100)
            : Math.min(suggested, nextVal - 1);

        const shouldUpdate =
          ai === 0
            ? !Number.isFinite(updated[i]) || updated[i] <= 0
            : !Number.isFinite(updated[i]) || updated[i] < prevVal || updated[i] === prevVal;

        if (shouldUpdate) {
          updated[i] = Math.round(finalVal);
        }
      }

      if (activeIdxs.length > 0) {
        const lastActiveIndex = activeIdxs[activeIdxs.length - 1];
        updated[lastActiveIndex] = 100;
      }
      updated[updated.length - 1] = 100;
      for (let k = 1; k < updated.length; k++) {
        updated[k] = Math.max(updated[k], updated[k - 1]);
      }

      let changed = false;
      for (let k = 0; k < updated.length; k++) {
        if (updated[k] !== prev[k]) {
          changed = true;
          break;
        }
      }
      return changed ? (updated as State) : prev;
    });
  }, [setState, LEVEL_ENTRIES, state]);

  const columns = makeColumns({ state, setState, isDisabled, LEVEL_ENTRIES });

  return (
    <Table<TableItem>
      rowKey="key"
      sizingMode="FULL_WIDTH"
      columns={columns}
      pagination={false}
      data={{ items: LEVEL_ENTRIES }}
      toolsOptions={false}
      showResultsInfo={false}
    />
  );
};

export default RiskClassificationTable;
