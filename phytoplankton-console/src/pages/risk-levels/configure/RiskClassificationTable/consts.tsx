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
}

const helper = new ColumnHelper<TableItem>();
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
      const externalState: ExternalState = context.external as ExternalState;
      const { state } = externalState;
      const start = state?.[item.index - 1] ?? 0;
      const end = state?.[item.index] ?? 100;
      return `${start} - ${end}`;
    },
  }),
  helper.display({
    id: 'score_edit',
    title: 'Range',
    defaultWidth: 300,
    render: (item, context) => {
      const externalState: ExternalState = context.external as ExternalState;
      const { state, setState, isDisabled } = externalState;

      const { index } = item;
      if (state == null) {
        return <></>;
      }
      const start = state[index - 1] ?? 0;
      const end = state[index] ?? 100;
      return (
        <Slider
          className={s.slider}
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
  }),
]);
