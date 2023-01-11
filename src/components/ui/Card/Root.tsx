import React, { useCallback, useContext, useEffect, useState } from 'react';
import cn from 'clsx';
import s from './index.module.less';
import Column from './Column';
import Header, { HeaderSettings } from './Header';
import { useDeepEqualEffect } from '@/utils/hooks';
import { ExpandableContext } from '@/components/AppWrapper/Providers/ExpandableProvider';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  disabled?: boolean;
  className?: string;
  header?: HeaderSettings;
  children: React.ReactNode;
  collapsable?: boolean;
  updateCollapseState?: (key: string, value: boolean) => void;
}

const Root = (props: Props) => {
  const { disabled, className, header, children, collapsable = true, updateCollapseState } = props;
  const { collapsable: headerCollapsable = true, collapsableKey } = header ?? {};
  const settings = useSettings();

  const isCollapsedByDefault = useCallback(() => {
    // if collapsableKey is not defined, then the card is not collapsable it will be always expanded
    if (!collapsableKey) {
      return false;
    }

    return !settings?.defaultViews?.expandedCards?.includes(collapsableKey);
  }, [collapsableKey, settings?.defaultViews?.expandedCards]);

  const [isCollapsed, setCollapsed] = useState(isCollapsedByDefault());

  const expandableContext = useContext(ExpandableContext);

  useEffect(() => {
    if (disabled && collapsableKey && updateCollapseState) {
      updateCollapseState(collapsableKey, true);
    }
  }, [collapsableKey, disabled, updateCollapseState]);

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
    if (updateCollapseState && collapsableKey) {
      updateCollapseState(collapsableKey, isCollapsed);
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
