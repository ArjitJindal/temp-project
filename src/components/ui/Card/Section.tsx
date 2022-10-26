import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import { CommonContainerProps, getCommonContainerClasses } from '@/components/ui/Card/helpers';

interface Props extends CommonContainerProps {
  direction?: 'horizontal' | 'vertical';
  children?: React.ReactNode;
  className?: string;
}

export default function Section(props: Props) {
  const { direction = 'vertical', className, children } = props;
  return (
    <div
      className={cn(
        s.section,
        className,
        s[`direction-${direction}`],
        ...getCommonContainerClasses(s, props, {
          spacing: 'default',
        }),
      )}
    >
      {children}
    </div>
  );
}
