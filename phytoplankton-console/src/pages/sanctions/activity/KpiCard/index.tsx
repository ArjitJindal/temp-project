import cn from 'clsx';
import s from './index.module.less';
import { SanctionsScreeningEntityStats } from '@/apis/models/SanctionsScreeningEntityStats';

interface Props {
  title: string;
  data: SanctionsScreeningEntityStats;
  className?: string;
}
export const KpiCard = (props: Props) => {
  const { data, title, className } = props;
  const { hitCount, screenedCount, newCount } = data;
  return (
    <div className={cn(s.card, className)}>
      <div className={s.text}>{title}</div>
      <div className={s.container}>
        <div className={cn(s.column, s['column--left'])}>
          <div className={s.count}>{screenedCount}</div>
          <div className={s.text}>Screened</div>
        </div>
        <div className={s.divider}></div>
        <div className={cn(s.column, s['column--center'])}>
          <div className={s.count}>{newCount}</div>
          <div className={s.text}>New</div>
        </div>
        <div className={s.divider}></div>
        <div className={cn(s.column, s['column--right'])}>
          <div className={s.count}>{hitCount}</div>
          <div className={s.text}>Hit</div>
        </div>
      </div>
    </div>
  );
};
