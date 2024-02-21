import { Column } from '@ant-design/charts';
import s from './index.module.less';
import { COLORS_V2_GRAY_1 } from '@/components/ui/colors';

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
  const data = beforeValues
    .map((v) => ({ label: 'Before', value: v.value, type: v.type }))
    .concat(afterValues.map((v) => ({ label: 'After', value: v.value, type: v.type })));
  return (
    <div className={s.root}>
      <Column
        height={200}
        width={50}
        isStack={true}
        data={data}
        xField="label"
        yField="value"
        seriesField="type"
        legend={false}
        maxColumnWidth={40}
        columnStyle={{
          radius: [5, 5, 0, 0],
        }}
        color={(data) => {
          const type = data.type as ValueType;
          switch (type) {
            case 'Before':
            case 'True positive (before)':
              return beforeColor;
            case 'After':
            case 'True positive (after)':
              return afterColor;
            case 'False positive (before)':
              return beforeFalsePositiveColor ?? COLORS_V2_GRAY_1;
            case 'False positive (after)':
              return afterFalsePositiveColor ?? COLORS_V2_GRAY_1;
          }
        }}
      />
      <div className={s.title}>{title}</div>
    </div>
  );
}
