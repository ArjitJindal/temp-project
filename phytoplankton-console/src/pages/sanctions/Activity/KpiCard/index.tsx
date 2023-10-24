import cn from 'clsx';
import s from './index.module.less';
import { SanctionsScreeningStatsUser } from '@/apis';

interface Props {
  title: string;
  data: SanctionsScreeningStatsUser;
  className?: string;
}
export const KpiCard = (props: Props) => {
  const { data, title, className } = props;
  const { hit, screened } = data;
  return (
    <div className={cn(s.card, className)}>
      <div className={s.text}>{title}</div>
      <div className={s.container}>
        <div className={s.columnLeft}>
          <div className={s.count}>{screened}</div>
          <div className={s.text}>Screened</div>
        </div>
        <div className={s.divider}></div>
        <div className={s.columnRight}>
          <div className={s.count}>{hit}</div>
          <div className={s.text}>Hit</div>
        </div>
      </div>
    </div>
  );
};
