import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import { CommonContainerProps, getCommonContainerClasses } from '@/components/ui/Card/helpers';

interface Props extends CommonContainerProps {
  direction?: 'horizontal' | 'vertical';
  children?: React.ReactNode;
  className?: string;
  testId?: string;
}

export default function Section(props: Props) {
  const { direction = 'vertical', spacing, className, children, testId } = props;
  return (
    <div
      data-cy={testId}
      className={cn(
        s.section,
        className,
        s[`direction-${direction}`],
        ...getCommonContainerClasses(s, props, {
          spacing: spacing ?? 'default',
        }),
      )}
    >
      {children}
    </div>
  );
}
