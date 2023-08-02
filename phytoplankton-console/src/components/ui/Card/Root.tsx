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
  } = props;

  const [isCollapsed, setCollapsed] = useState(isCollapsable && isCollapsedByDefault);

  return (
    <div className={cn(s.root, className, disabled && s.disabled, noBorder && s.noBorder)}>
      <Column>
        {header && (
          <Header
            isCollapsable={isCollapsable}
            isCollapsed={isCollapsed}
            setCollapsed={setCollapsed}
            {...header}
          />
        )}
        {!isCollapsed && <Column>{children}</Column>}
      </Column>
    </div>
  );
};

export default Root;
