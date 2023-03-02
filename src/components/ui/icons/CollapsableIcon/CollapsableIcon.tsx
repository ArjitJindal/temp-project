import React from 'react';
import cn from 'clsx';
import s from './CollapsableIcon.module.less';
import ArrowDownSLineIcon from '@/components/ui/icons/Remix/system/arrow-down-s-line.react.svg';

export default function ({
  expanded,
  onClick,
}: {
  expanded: boolean;
  onClick?: (event: React.MouseEvent<any>) => void;
}) {
  return (
    <ArrowDownSLineIcon
      className={cn(s.collapseIcon, !expanded && s.isCollapsed)}
      onClick={onClick}
    />
  );
}
