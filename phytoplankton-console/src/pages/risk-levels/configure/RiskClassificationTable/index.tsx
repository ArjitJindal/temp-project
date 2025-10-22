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
      result[i] = i === 0 ? 0 : result[i - 1];
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
