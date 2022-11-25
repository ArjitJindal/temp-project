import React, { forwardRef, useImperativeHandle } from 'react';
import cn from 'clsx';
import s from './index.module.less';
import Column from './Column';
import Header, { HeaderSettings } from './Header';
import { useLocalStorageState } from './helpers';
import { useDeepEqualEffect } from '@/utils/hooks';

interface Props {
  disabled?: boolean;
  className?: string;
  header?: HeaderSettings;
  children: React.ReactNode;
  onCollapseChange?: (collapsed: boolean) => void;
}

interface ExpandCardRef {
  expand: (shouldExpand?: boolean) => void;
}

const Root = forwardRef((props: Props, ref: React.Ref<ExpandCardRef>) => {
  const { disabled, className, header, children, onCollapseChange } = props;
  const { collapsable = true, collapsableKey, collapsedByDefault = false } = header ?? {};

  const [isCollapsed, setCollapsed] = useLocalStorageState(
    collapsableKey,
    collapsable && collapsedByDefault,
  );

  useImperativeHandle(ref, () => ({
    expand: (shouldExpand) => {
      setCollapsed(!shouldExpand);
    },
  }));

  useDeepEqualEffect(() => {
    if (onCollapseChange) {
      onCollapseChange(isCollapsed);
    }
  }, [isCollapsed]);

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
        {collapsable && !isCollapsed && (
          <div className={s.container}>
            <Column>{children}</Column>
          </div>
        )}
      </Column>
    </div>
  );
});

export default Root;
