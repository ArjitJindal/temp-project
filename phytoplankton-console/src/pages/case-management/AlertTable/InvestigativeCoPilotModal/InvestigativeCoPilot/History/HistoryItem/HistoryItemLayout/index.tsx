import React from 'react';
import cn from 'clsx';
import { setUserAlias } from '@flagright/lib/utils/userAlias';
import s from './index.module.less';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  dataKey: string;
  title?: string;
  isUnread?: boolean;
  isLoading?: boolean;
  tools?: React.ReactNode;
  children: React.ReactNode;
  count?: number;
  hideTitle?: boolean;
  transactionCount?: number;
}

function HistoryItemLayout(props: Props, ref?: React.ForwardedRef<HTMLDivElement | null>) {
  const {
    dataKey,
    title,
    tools,
    isLoading,
    isUnread,
    children,
    count,
    transactionCount,
    hideTitle = false,
  } = props;
  const { userAlias } = useSettings();
  return (
    <div
      data-key={dataKey}
      className={cn(s.root, isLoading && s.isLoading, isUnread && s.isUnread)}
      ref={ref}
    >
      {!hideTitle && (
        <div className={s.header}>
          <div className={s.title}>
            {setUserAlias(title, userAlias)}
            {transactionCount != null
              ? ` (${transactionCount})`
              : count != null
              ? ` (${count})`
              : ''}
          </div>
          {tools && <div className={s.tools}>{tools}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export default React.forwardRef(HistoryItemLayout);
