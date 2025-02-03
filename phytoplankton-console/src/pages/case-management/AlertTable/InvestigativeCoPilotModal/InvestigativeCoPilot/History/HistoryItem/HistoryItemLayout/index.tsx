import React from 'react';
import cn from 'clsx';
import s from './index.module.less';

interface Props {
  dataKey: string;
  title?: string;
  isUnread?: boolean;
  isLoading?: boolean;
  tools?: React.ReactNode;
  children: React.ReactNode;
  count?: number;
  hideTitle?: boolean;
}

function HistoryItemLayout(props: Props, ref?: React.ForwardedRef<HTMLDivElement | null>) {
  const { dataKey, title, tools, isLoading, isUnread, children, count, hideTitle = false } = props;
  return (
    <div
      data-key={dataKey}
      className={cn(s.root, isLoading && s.isLoading, isUnread && s.isUnread)}
      ref={ref}
    >
      {!hideTitle && (
        <div className={s.header}>
          <div className={s.title}>
            {title} {count != null ? `(${count}!)` : ''}
          </div>
          {tools && <div className={s.tools}>{tools}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export default React.forwardRef(HistoryItemLayout);
