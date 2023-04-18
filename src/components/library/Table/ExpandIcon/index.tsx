import React from 'react';
import cn from 'clsx';
import s from './style.module.less';

interface Props {
  isExpanded: boolean;
  onClick: () => void;
}

export default function ExpandIcon(props: Props) {
  const { isExpanded, onClick } = props;

  return (
    <button
      onClick={onClick}
      className={cn('ant-table-row-expand-icon', s.root, {
        'ant-table-row-expand-icon-expanded': isExpanded,
        'ant-table-row-expand-icon-collapsed': !isExpanded,
      })}
    ></button>
  );
}
