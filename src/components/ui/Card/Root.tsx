import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import Column from './Column';
import Header, { HeaderSettings } from './Header';
import { useLocalStorageState } from './helpers';

interface Props {
  disabled?: boolean;
  className?: string;
  header?: HeaderSettings;
  children: React.ReactNode;
}

export default function Root(props: Props) {
  const { disabled, className, header, children } = props;
  const { collapsable = true, collapsableKey, collapsedByDefault = false } = header ?? {};

  const [isCollapsed, setCollapsed] = useLocalStorageState(
    collapsableKey,
    collapsable && collapsedByDefault,
  );

  return (
    <div className={cn(s.root, className, disabled && s.disabled)}>
      <Column>
        {header && (
          <Header
            header={header}
            isCollapsed={disabled || (collapsable && isCollapsed)}
            setCollapsed={setCollapsed}
          />
        )}
        {collapsable && !isCollapsed && children}
      </Column>
    </div>
  );
}
