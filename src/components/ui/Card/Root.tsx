import React, { useCallback, useContext, useEffect, useState } from 'react';
import cn from 'clsx';
import s from './index.module.less';
import Column from './Column';
import Header, { HeaderSettings } from './Header';
import { useDeepEqualEffect, useFocusKey } from '@/utils/hooks';
import { ExpandableContext } from '@/components/AppWrapper/Providers/ExpandableProvider';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  disabled?: boolean;
  className?: string;
  header?: HeaderSettings;
  children: React.ReactNode;
  collapsable?: boolean;
  noBorder?: boolean;
  updateCollapseState?: (key: string, value: boolean) => void;
}

const Root = (props: Props) => {
  const {
    disabled,
    className,
    header,
    children,
    collapsable = true,
    noBorder = false,
    updateCollapseState,
  } = props;
  const { collapsable: headerCollapsable = true, collapsableKey } = header ?? {};
  const settings = useSettings();

  const isCollapsedByDefault = useCallback(() => {
    // if collapsableKey is not defined, then the card is not collapsable it will be always expanded
    if (!collapsableKey) {
      return false;
    }

    return !settings?.defaultViews?.expandedCards?.includes(collapsableKey);
  }, [collapsableKey, settings?.defaultViews?.expandedCards]);

  const focusKey = useFocusKey();
  const [isCollapsedState, setCollapsedState] = useState(
    focusKey === collapsableKey ? false : isCollapsedByDefault(),
  );

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
      setCollapsedState(true);
    } else if (expandableContext.expandMode === 'EXPAND_ALL') {
      setCollapsedState(false);
    }
  }, [collapsable, disabled, expandableContext.expandMode, headerCollapsable, setCollapsedState]);

  useDeepEqualEffect(() => {
    if (updateCollapseState && collapsableKey) {
      updateCollapseState(collapsableKey, isCollapsedState);
    }
  }, [isCollapsedState]);

  const isCollapsed = disabled || (collapsable && headerCollapsable && isCollapsedState);

  return (
    <div
      className={cn(s.root, className, disabled && s.disabled, noBorder && s.noBorder)}
      id={collapsableKey}
    >
      <Column>
        {header && (
          <Header
            header={{
              ...header,
              collapsable: headerCollapsable && collapsable,
            }}
            link={header.link}
            isCollapsed={isCollapsed}
            setCollapsed={setCollapsedState}
          />
        )}
        {!isCollapsed && <Column>{children}</Column>}
      </Column>
    </div>
  );
};

export default Root;
