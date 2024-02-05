import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import { neverReturn } from '@/utils/lang';
import { TransactionState as ApiTransactionState } from '@/apis';
import CheckLineIcon from '@/components/ui/icons/Remix/system/check-line.react.svg';
import LoaderIcon from '@/components/ui/icons/Remix/system/loader-2-fill.react.svg';
import SendPlaneLineIcon from '@/components/ui/icons/Remix/business/send-plane-line.react.svg';
import TimeLineIcon from '@/components/ui/icons/expire-icon.react.svg';
import ErrorWarningLine from '@/components/ui/icons/Remix/system/error-warning-line.react.svg';
import ArrowGoBackLineIcon from '@/components/ui/icons/Remix/system/arrow-go-back-line.react.svg';
import ArrowGoForwardLineIcon from '@/components/ui/icons/Remix/system/arrow-go-forward-line.react.svg';
import CheckDoubleLineIcon from '@/components/ui/icons/Remix/system/check-double-line.react.svg';
import CloseLineIcon from '@/components/ui/icons/Remix/system/close-fill.react.svg';
import { useTransactionStateLabel } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  transactionState: ApiTransactionState | undefined;
  titleClassName?: string;
}

export default function TransactionStateTag(props: Props) {
  const { transactionState, titleClassName } = props;
  const transactionStateLabel = useTransactionStateLabel(transactionState);
  if (!transactionState) {
    return <span className={titleClassName}>-</span>;
  }
  const icon: React.ReactNode = getTransactionStateIcon(transactionState);
  return (
    <div className={s.root}>
      <div className={cn(s.icon, s[`transactionState-${transactionState}`])}>{icon}</div>
      <span className={titleClassName}>{transactionStateLabel}</span>
    </div>
  );
}

export function getTransactionStateIcon(transactionState: ApiTransactionState): React.ReactNode {
  if (transactionState === 'CREATED') {
    return <CheckLineIcon />;
  } else if (transactionState === 'PROCESSING') {
    return <LoaderIcon />;
  } else if (transactionState === 'SENT') {
    return <SendPlaneLineIcon />;
  } else if (transactionState === 'EXPIRED') {
    return <TimeLineIcon />;
  } else if (transactionState === 'DECLINED') {
    return <CloseLineIcon />;
  } else if (transactionState === 'SUSPENDED') {
    return <ErrorWarningLine />;
  } else if (transactionState === 'REFUNDED') {
    return <ArrowGoBackLineIcon />;
  } else if (transactionState === 'SUCCESSFUL') {
    return <CheckDoubleLineIcon />;
  } else if (transactionState === 'REVERSED') {
    return <ArrowGoForwardLineIcon />;
  }
  return neverReturn(transactionState, null);
}
