import React from 'react';
import cn from 'clsx';
import s from './style.module.less';
import ArrowDownSLine from '@/components/ui/icons/Remix/system/arrow-down-s-line.react.svg';

interface Props {
  isExpanded: boolean;
  onClick: () => void;
}

export default function ExpandIcon(props: Props) {
  const { isExpanded, onClick } = props;

  return (
    <button className={cn(s.root, isExpanded && s.isExpanded)} onClick={onClick}>
      <ArrowDownSLine />
    </button>
  );
}
