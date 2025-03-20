import s from './index.module.less';
import BarChart from '@/components/charts/BarChart';
import { success } from '@/utils/asyncResource';
import { SeriesTooltipBody } from '@/components/charts/shared/SeriesTooltip';
import { DEFAULT_NUMBER_FORMATTER } from '@/components/charts/shared/formatting';

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
  pdfMode?: boolean;
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
    pdfMode,
  } = props;
  const data = [
    ...beforeValues.map((v) => ({ category: 'Before', value: v.value ?? 0, series: v.type })),
    ...afterValues.map((v) => ({ category: 'After', value: v.value ?? 0, series: v.type })),
  ];
  const colors = {
    Before: beforeColor,
    After: afterColor,
    'True positive (before)': beforeColor,
    'True positive (after)': afterColor,
    'False positive (before)': beforeFalsePositiveColor,
    'False positive (after)': afterFalsePositiveColor,
  };
  return (
    <div className={s.root}>
      {pdfMode && <div className={s.title}>{title}</div>}
      <BarChart<string, ValueType>
        grouping={'STACKED'}
        data={success(data)}
        colors={colors}
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
      {pdfMode && (
        <SeriesTooltipBody
          items={data.map((x) => ({
            color: colors[x.series],
            label: x.series,
            value: DEFAULT_NUMBER_FORMATTER(x.value),
          }))}
        />
      )}
      {!pdfMode && <div className={s.title}>{title}</div>}
    </div>
  );
}
