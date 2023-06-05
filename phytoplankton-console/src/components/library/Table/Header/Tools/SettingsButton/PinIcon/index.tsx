import React from 'react';
import cn from 'clsx';
import * as TanTable from '@tanstack/react-table';
import s from './style.module.less';
import PushpinLineIcon from '@/components/ui/icons/Remix/map/pushpin-line.react.svg';

interface Props {
  value: TanTable.ColumnPinningPosition;
  onChange: (value: TanTable.ColumnPinningPosition) => void;
}

export default function PinIcon(props: Props) {
  const { value, onChange } = props;

  return (
    <PushpinLineIcon
      className={cn(s.root, value && s[`value-${value}`])}
      onClick={() => {
        onChange(value === 'left' ? 'right' : value === 'right' ? false : 'left');
      }}
    />
  );
}
