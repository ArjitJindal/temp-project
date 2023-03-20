import { ToolBarProps } from '@ant-design/pro-table/lib/components/ToolBar';
import { RiskClassificationScore, RiskLevel } from '@/apis';
import { TableColumn } from '@/components/ui/Table/types';
import { RISK_LEVEL_LABELS, RISK_LEVELS } from '@/utils/risk-levels';
import RiskLevelTag from '@/components/ui/RiskLevelTag';
import Slider from '@/components/library/Slider';
import Table from '@/components/ui/Table';

export type State = number[];

export interface TableItem {
  key: RiskLevel;
  title: string;
}

interface Props {
  toolBarRender?: ToolBarProps<TableItem>['toolBarRender'];
  state: State | null;
  setState?: React.Dispatch<React.SetStateAction<State | null>>;
  isDisabled?: boolean;
  loading?: boolean;
  headerSubtitle?: string;
  disableInternalPadding?: boolean;
}

const LEVEL_ENTRIES = RISK_LEVELS.map((key) => ({
  key,
  title: RISK_LEVEL_LABELS[key],
})) as TableItem[];

export type ApiState = Array<RiskClassificationScore>;

export function prepareApiState(state: State): ApiState {
  return RISK_LEVELS.map((riskLevel, index) => ({
    riskLevel,
    lowerBoundRiskScore: state[index - 1] ?? 0,
    upperBoundRiskScore: state[index] ?? 100,
  }));
}

export function parseApiState(values: ApiState): State {
  const result = [];
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
  const { toolBarRender, state, setState, isDisabled, loading, headerSubtitle } = props;

  const columns: TableColumn<TableItem>[] = [
    {
      title: 'Title',
      width: '200px',
      dataIndex: 'key',
      render: (_, item) => <RiskLevelTag level={item.key} />,
    },
    {
      title: 'Score',
      dataIndex: 'score',
      tip: 'Range of values that defines the upper and lower limits of a risk level',
      valueType: 'digit',
      width: '100px',
      render: (dom, item, index) => {
        if (state == null) {
          return <></>;
        }

        const start = state[index - 1] ?? 0;
        const end = state[index] ?? 100;
        return (
          <span>
            {start} - {end}
          </span>
        );
      },
    },
    {
      render: (dom, item, index) => {
        if (state == null) {
          return <></>;
        }
        const start = state[index - 1] ?? 0;
        const end = state[index] ?? 100;
        return (
          <Slider
            mode="RANGE"
            isDisabled={isDisabled}
            min={0}
            max={100}
            value={[start, end]}
            endExclusive={true}
            onChange={(newValue) => {
              if (!setState || newValue == null) {
                return;
              }
              const [newStart, newEnd] = newValue;
              setState((state) => {
                if (state == null) {
                  return state;
                }
                return state.map((x, i) => {
                  if (i === index - 1) {
                    return newStart;
                  }
                  if (i < index - 1 && x > newStart) {
                    return newStart;
                  }
                  if (i === index) {
                    return newEnd;
                  }
                  if (i > index && x < newEnd) {
                    return newEnd;
                  }
                  return x;
                }) as State;
              });
            }}
          />
        );
      },
    },
  ];

  return (
    <Table<TableItem>
      disableStripedColoring={true}
      rowKey="key"
      search={false}
      columns={columns}
      pagination={false}
      loading={state == null || loading}
      data={{
        items: LEVEL_ENTRIES,
      }}
      toolBarRender={toolBarRender}
      options={{
        setting: false,
        density: false,
        reload: false,
      }}
      headerSubtitle={headerSubtitle}
      disableInternalPadding={props.disableInternalPadding}
      showResultsInfo={false}
    />
  );
};

export default RiskClassificationTable;
