import cn from 'clsx';
import s from './index.module.less';
import { H5 } from '@/components/ui/Typography';

type Props = {
  value?: number;
  maxValue?: number;
  showPercentage?: boolean;
  showValue?: boolean;
};

export default function ProgressBar(props: Props) {
  const { value, maxValue, showPercentage = false, showValue = false } = props;
  const percent =
    value != null && maxValue != null ? Math.min((value / maxValue) * 100, 100) : undefined;
  const isUndefined = value == null || maxValue == null;
  return (
    <div className={cn(s.root, isUndefined && s.isUndefined)}>
      {showPercentage && showValue && percent != null ? (
        <>
          <H5 className={s.percentage}>
            {value} ({Math.floor(percent)}%)
          </H5>
        </>
      ) : showPercentage && percent != null ? (
        <H5 className={s.percentage}>{Math.floor(percent)}%</H5>
      ) : showValue && value != null ? (
        <H5 className={s.percentage}>{value}</H5>
      ) : (
        <></>
      )}
      <div className={cn(s.externalBar)}>
        <div className={s.internalBar} style={{ width: isUndefined ? undefined : `${percent}%` }} />
      </div>
    </div>
  );
}
