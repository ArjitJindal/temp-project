import React from 'react';
import s from './style.module.less';
import QuickFilter, { Props as QuickFilterProps } from '@/components/library/QuickFilter';

interface Props extends QuickFilterProps {}

export default function DefaultQuickFilter(props: Props) {
  const { children, ...rest } = props;

  return (
    <QuickFilter {...rest}>
      <div className={s.root}>{children}</div>
    </QuickFilter>
  );
}
