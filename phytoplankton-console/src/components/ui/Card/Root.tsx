import React, { useState } from 'react';
import cn from 'clsx';
import s from './index.module.less';
import Column from './Column';
import Header, { HeaderSettings } from './Header';

interface Props {
  disabled?: boolean;
  className?: string;
  header?: HeaderSettings;
  children: React.ReactNode;
  noBorder?: boolean;
  isCollapsable?: boolean;
  isCollapsedByDefault?: boolean;
  isInvalid?: boolean;
}

const Root = (props: Props) => {
  const {
    disabled,
    className,
    header,
    children,
    noBorder = false,
    isCollapsable = false,
    isCollapsedByDefault = false,
    isInvalid = false,
  } = props;

  const [isCollapsed, setCollapsed] = useState(isCollapsable && isCollapsedByDefault);

  const showInvalidState = isInvalid && isCollapsed;

  return (
    <div
      className={cn(
        s.root,
        className,
        disabled && s.disabled,
        noBorder && s.noBorder,
        showInvalidState && s.isInvalid,
      )}
    >
      <Column>
        {header && (
          <Header
            isCollapsable={isCollapsable}
            isCollapsed={isCollapsed}
            setCollapsed={setCollapsed}
            isInvalid={showInvalidState}
            {...header}
          />
        )}
        {!isCollapsed && <Column>{children}</Column>}
      </Column>
    </div>
  );
};

export default Root;
