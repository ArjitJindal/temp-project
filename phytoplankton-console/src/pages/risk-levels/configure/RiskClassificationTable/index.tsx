import { RiskClassificationScore, RiskLevel } from '@/apis';
import { RISK_LEVEL_LABELS, RISK_LEVELS } from '@/utils/risk-levels';
import Table from '@/components/library/Table';
import {
  columns,
  ExternalState,
} from '@/pages/risk-levels/configure/RiskClassificationTable/consts';

export type State = number[];

export interface TableItem {
  key: RiskLevel;
  index: number;
  title: string;
}

interface Props {
  state: State | null;
  setState?: React.Dispatch<React.SetStateAction<State | null>>;
  isDisabled?: boolean;
}

const LEVEL_ENTRIES = RISK_LEVELS.map((key, i) => ({
  key,
  index: i,
  title: RISK_LEVEL_LABELS[key],
  isActive:true
})) as TableItem[];

export type ApiState = Array<RiskClassificationScore>;

export function prepareApiState(state: State | undefined | null): ApiState {
  console.log('state', state)
  console.log('RISK_LEVELS', RISK_LEVELS)
  return RISK_LEVELS.map((riskLevel, index) => ({
    riskLevel,
    lowerBoundRiskScore: state?.[index - 1] ?? 0,
    upperBoundRiskScore: state?.[index] ?? 100,
    isActive: true,
  }));
}

export function parseApiState(values: ApiState): State {
  const result: any[] = [];
  console.log('values', values)
  for (let i = 0; i < RISK_LEVELS.length - 1; i += 1) {

    const level = RISK_LEVELS[i];
    const riskLevelEntry = values.find(({ riskLevel }) => riskLevel === level);
    if (riskLevelEntry == null) {
      throw new Error(`Invalid values: ${JSON.stringify(values)}`);
    }
    result[i] = riskLevelEntry.upperBoundRiskScore;
  }
  return result;
}

const RiskClassificationTable = (props: Props) => {
  const { state, setState, isDisabled = false } = props;

  const externalState: ExternalState = {
    state,
    isDisabled,
    setState,
  };
  console.log('props1', props)
  return (
    <Table<TableItem>
      rowKey="key"
      sizingMode="FULL_WIDTH"
      columns={columns}
      pagination={false}
      data={{
        items: LEVEL_ENTRIES,
      }}
      toolsOptions={false}
      showResultsInfo={false}
      externalState={externalState}
    />
  );
};

export default RiskClassificationTable;
