import React from 'react';
import cn from 'clsx';

interface Props {
  isExpanded: boolean;
  onClick: () => void;
}

export default function ExpandIcon(props: Props) {
  const { isExpanded, onClick } = props;

  return (
    <button
      onClick={onClick}
      className={cn('ant-table-row-expand-icon', {
        'ant-table-row-expand-icon-expanded': isExpanded,
        'ant-table-row-expand-icon-collapsed': !isExpanded,
      })}
    ></button>
  );
}
