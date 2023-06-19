import React from 'react';
import cn from 'clsx';
import s from './styles.module.less';

interface Props {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

export default function TransactionsSelector(props: Props) {
  const { isActive, onClick, children } = props;

  return (
    <button className={cn(s.root, isActive && s.isActive)} onClick={onClick}>
      {children}
    </button>
  );
}
