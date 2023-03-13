import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import ArrowDownSLineIcon from '@/components/ui/icons/Remix/system/arrow-down-s-line.react.svg';

interface Props {
  expanded: boolean;
  color?: 'BLUE' | 'BLACK';
  onClick?: (event: React.MouseEvent<any>) => void;
}

export default function (props: Props) {
  const { expanded, color = 'BLUE', onClick } = props;
  return (
    <ArrowDownSLineIcon
      className={cn(s.collapseIcon, s[`color-${color}`], !expanded && s.isCollapsed)}
      onClick={onClick}
    />
  );
}
