import s from './index.module.less';
import BarChart from '@/components/charts/BarChart';
import { success } from '@/utils/asyncResource';

type ValueType =
  | 'Before'
  | 'After'
  | 'True positive (before)'
  | 'True positive (after)'
  | 'False positive (before)'
  | 'False positive (after)';
type Value = {
  value?: number;
  type: ValueType;
};

interface Props {
  title: string;
  beforeValues: Value[];
  afterValues: Value[];
  beforeColor: string;
  beforeFalsePositiveColor?: string;
  afterColor: string;
  afterFalsePositiveColor?: string;
}

export function DeltaChart(props: Props) {
  const {
    title,
    beforeValues,
    afterValues,
    beforeColor,
    beforeFalsePositiveColor,
    afterColor,
    afterFalsePositiveColor,
  } = props;
  return (
    <div className={s.root}>
      <BarChart<string, ValueType>
        grouping={'STACKED'}
        data={success([
          ...beforeValues.map((v) => ({ category: 'Before', value: v.value ?? 0, series: v.type })),
          ...afterValues.map((v) => ({ category: 'After', value: v.value ?? 0, series: v.type })),
        ])}
        colors={{}}
        customBarColors={(_, series: ValueType, defaultColor) => {
          let result;
          if (series === 'Before') {
            result = beforeColor;
          } else if (series === 'After') {
            result = afterColor;
          } else if (series === 'True positive (before)') {
            result = beforeColor;
          } else if (series === 'True positive (after)') {
            result = afterColor;
          } else if (series === 'False positive (before)') {
            result = beforeFalsePositiveColor;
          } else if (series === 'False positive (after)') {
            result = afterFalsePositiveColor;
          }
          return result ?? defaultColor;
        }}
        hideLegend={true}
      />
      <div className={s.title}>{title}</div>
    </div>
  );
}
