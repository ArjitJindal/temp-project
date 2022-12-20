import React, { useContext, useEffect } from 'react';
import cn from 'clsx';
import s from './index.module.less';
import Column from './Column';
import Header, { HeaderSettings } from './Header';
import { useLocalStorageState } from './helpers';
import { useDeepEqualEffect } from '@/utils/hooks';
import { ExpandableContext } from '@/components/AppWrapper/Providers/ExpandableProvider';

interface Props {
  disabled?: boolean;
  className?: string;
  header?: HeaderSettings;
  children: React.ReactNode;
  collapsable?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
}

const Root = (props: Props) => {
  const { disabled, className, header, children, onCollapseChange, collapsable = true } = props;
  const {
    collapsable: headerCollapsable = true,
    collapsableKey,
    collapsedByDefault = false,
  } = header ?? {};

  const [isCollapsed, setCollapsed] = useLocalStorageState(
    collapsableKey,
    collapsable && headerCollapsable && collapsedByDefault,
  );
  const expandableContext = useContext(ExpandableContext);

  useEffect(() => {
    if (!collapsable || !headerCollapsable || disabled) {
      return;
    }
    if (expandableContext.expandMode === 'COLLAPSE_ALL') {
      setCollapsed(true);
    } else if (expandableContext.expandMode === 'EXPAND_ALL') {
      setCollapsed(false);
    }
  }, [collapsable, disabled, expandableContext.expandMode, headerCollapsable, setCollapsed]);

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
            isCollapsed={disabled || (collapsable && headerCollapsable && isCollapsed)}
            setCollapsed={setCollapsed}
          />
        )}
        {!isCollapsed && (
          <div className={s.container}>
            <Column>{children}</Column>
          </div>
        )}
      </Column>
    </div>
  );
};

export default Root;
