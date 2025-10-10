import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import { CommonContainerProps, getCommonContainerClasses } from '@/components/ui/Card/helpers';

interface Props extends CommonContainerProps {
  children?: React.ReactNode;
  className?: string;
}

export default function Column(props: Props) {
  const { children, className } = props;
  return (
    <div className={cn(s.column, className, ...getCommonContainerClasses(s, props))}>
      {children}
    </div>
  );
}
