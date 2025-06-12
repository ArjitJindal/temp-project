import cn from 'clsx';
import s from './index.module.less';
import AiForensicsLogo from '@/components/ui/AiForensicsLogo';
import Tooltip from '@/components/library/Tooltip';
import COLORS from '@/components/ui/colors';

interface Props {
  right?: React.ReactNode;
  reasons: string[];
  children: React.ReactNode;
}

const TooltipContent = (props: Props) => {
  return (
    <div className={cn(s.tooltip)}>
      <div className={s.tooltipTitle}>
        <div className={s.tooltipTitleLeft}>
          <AiForensicsLogo size="SMALL" variant="OVERVIEW" />
        </div>
        {props.right && <div className={s.tooltipTitleRight}>{props.right}</div>}
      </div>
      <ul className={s.tooltipList}>
        {props.reasons.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
    </div>
  );
};

export const OverviewToolTip = (props: Props) => {
  return (
    <Tooltip overlay={<TooltipContent {...props} />} arrowColor={COLORS.white} placement="topLeft">
      {props.children}
    </Tooltip>
  );
};
