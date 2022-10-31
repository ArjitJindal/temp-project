import cn from 'clsx';
import s from './index.module.less';
import { neverReturn } from '@/utils/lang';
import { TransactionState as ApiTransactionState } from '@/apis';
import CheckLineIcon from '@/components/ui/icons/Remix/system/check-line.react.svg';
import RefreshLineIcon from '@/components/ui/icons/Remix/system/refresh-line.react.svg';
import SendPlaneLineIcon from '@/components/ui/icons/Remix/business/send-plane-line.react.svg';
import TimeLineIcon from '@/components/ui/icons/Remix/system/time-line.react.svg';
import PauseCircleLineIcon from '@/components/ui/icons/Remix/media/pause-circle-line.react.svg';
import ExchangeDollarLineIcon from '@/components/ui/icons/Remix/finance/exchange-dollar-line.react.svg';
import CheckDoubleLineIcon from '@/components/ui/icons/Remix/system/check-double-line.react.svg';
import CloseCircleLineIcon from '@/components/ui/icons/Remix/system/close-circle-line.react.svg';

interface Props {
  transactionState: ApiTransactionState | undefined;
}

export default function TransactionStateTag(props: Props) {
  const { transactionState } = props;
  if (!transactionState) {
    return <>-</>;
  }
  let title: string;
  let icon: React.ReactNode = null;

  if (transactionState === 'CREATED') {
    title = 'Created';
    icon = <CheckLineIcon />;
  } else if (transactionState === 'PROCESSING') {
    title = 'Processing';
    icon = <RefreshLineIcon />;
  } else if (transactionState === 'SENT') {
    title = 'Sent';
    icon = <SendPlaneLineIcon />;
  } else if (transactionState === 'EXPIRED') {
    title = 'Expired';
    icon = <TimeLineIcon />;
  } else if (transactionState === 'DECLINED') {
    title = 'Declined';
    icon = <CloseCircleLineIcon />;
  } else if (transactionState === 'SUSPENDED') {
    title = 'Suspended';
    icon = <PauseCircleLineIcon />;
  } else if (transactionState === 'REFUNDED') {
    title = 'Refunded';
    icon = <ExchangeDollarLineIcon />;
  } else if (transactionState === 'SUCCESSFUL') {
    title = 'Successful';
    icon = <CheckDoubleLineIcon />;
  } else {
    title = neverReturn(transactionState, 'Unknown');
    icon = neverReturn(transactionState, null);
  }

  return (
    <div className={s.root}>
      <div className={cn(s.icon, s[`transactionState-${transactionState}`])}>{icon}</div>
      <span>{title}</span>
    </div>
  );
}
