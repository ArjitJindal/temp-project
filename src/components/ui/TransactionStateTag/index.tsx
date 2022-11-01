import React from 'react';
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
import { humanizeCamelCase } from '@/utils/tags';

interface Props {
  transactionState: ApiTransactionState | undefined;
  titleClassName?: string;
}

export default function TransactionStateTag(props: Props) {
  const { transactionState, titleClassName } = props;
  if (!transactionState) {
    return <span className={titleClassName}>-</span>;
  }
  const title: string = getTransactionStateTitle(transactionState);
  const icon: React.ReactNode = getTransactionStateIcon(transactionState);
  return (
    <div className={s.root}>
      <div className={cn(s.icon, s[`transactionState-${transactionState}`])}>{icon}</div>
      <span className={titleClassName}>{title}</span>
    </div>
  );
}

export function getTransactionStateTitle(transactionState: ApiTransactionState) {
  if (transactionState === 'CREATED') {
    return 'Created';
  } else if (transactionState === 'PROCESSING') {
    return 'Processing';
  } else if (transactionState === 'SENT') {
    return 'Sent';
  } else if (transactionState === 'EXPIRED') {
    return 'Expired';
  } else if (transactionState === 'DECLINED') {
    return 'Declined';
  } else if (transactionState === 'SUSPENDED') {
    return 'Suspended';
  } else if (transactionState === 'REFUNDED') {
    return 'Refunded';
  } else if (transactionState === 'SUCCESSFUL') {
    return 'Successful';
  }
  return neverReturn(transactionState, humanizeCamelCase(transactionState));
}

export function getTransactionStateIcon(transactionState: ApiTransactionState): React.ReactNode {
  if (transactionState === 'CREATED') {
    return <CheckLineIcon />;
  } else if (transactionState === 'PROCESSING') {
    return <RefreshLineIcon />;
  } else if (transactionState === 'SENT') {
    return <SendPlaneLineIcon />;
  } else if (transactionState === 'EXPIRED') {
    return <TimeLineIcon />;
  } else if (transactionState === 'DECLINED') {
    return <CloseCircleLineIcon />;
  } else if (transactionState === 'SUSPENDED') {
    return <PauseCircleLineIcon />;
  } else if (transactionState === 'REFUNDED') {
    return <ExchangeDollarLineIcon />;
  } else if (transactionState === 'SUCCESSFUL') {
    return <CheckDoubleLineIcon />;
  }
  return neverReturn(transactionState, null);
}
