import cn from 'clsx';
import s from './index.module.less';
import { H5 } from '@/components/ui/Typography';

type Props = {
  value: number;
  maxValue?: number;
  showPercentage?: boolean;
};

export default function ProgressBar(props: Props) {
  const { value, maxValue = 1, showPercentage = false } = props;
  const percent = Math.min((value / maxValue) * 100, 100);
  return (
    <div className={cn(s.root)}>
      {showPercentage && <H5 className={s.percentage}>{Math.floor(percent)}%</H5>}
      <div className={cn(s.externalBar)}>
        <div className={s.internalBar} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
