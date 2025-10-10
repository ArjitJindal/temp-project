import cn from 'clsx';
import s from './styles.module.less';
import Skeleton from '@/components/library/Skeleton';
import { AsyncResource, getOr, hasValue } from '@/utils/asyncResource';
import { makeRandomNumberGenerator } from '@/utils/prng';

const random = makeRandomNumberGenerator(999999);
const SKELETON_DATA: BarChartData[] = [...new Array(5)].map(
  (_, column): BarChartData => ({
    label: `skeleton_${column}`,
    value: 1 + 29 * random(),
  }),
);

export interface BarChartData {
  label: string;
  value: number;
  info?: React.ReactNode;
  valueLabel?: React.ReactNode;
}

interface Props {
  data: AsyncResource<BarChartData[]>;
}

export const BarChart = (props: Props) => {
  const { data } = props;
  const showSkeleton = !hasValue(data);
  const dataValue = showSkeleton ? SKELETON_DATA : getOr(data, []);
  return (
    <div className={cn(s.container, showSkeleton && s.skeleton)}>
      {dataValue.map((item, index) => (
        <div className={s.row} key={index}>
          <div className={s.bar}>
            <div className={s.label}>
              <Skeleton res={data}>{item.label}</Skeleton>
            </div>
            <div
              className={s.columnContainer}
              style={{
                gridTemplateColumns: `${item.value}fr 60px ${100 - item.value}fr`,
              }}
            >
              <div className={s.column}></div>
              <div className={s.columnValue}>
                <Skeleton res={data}>{item.valueLabel ?? item.value}</Skeleton>
              </div>
              <div></div>
            </div>
          </div>
          <div className={s.info}>{item.info}</div>
        </div>
      ))}
    </div>
  );
};
