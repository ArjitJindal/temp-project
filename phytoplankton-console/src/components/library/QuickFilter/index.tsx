import React from 'react';
import s from './style.module.less';
import QuickFilterBase, { Props as QuickFilterProps } from './QuickFilterBase';

interface Props extends QuickFilterProps {}

export default function DefaultQuickFilter(props: Props) {
  const { children, ...rest } = props;

  return (
    <QuickFilterBase {...rest}>
      {(childrenProps) => (
        <div className={s.root} data-cy="QuickFilter">
          {typeof children === 'function' ? children(childrenProps) : children}
        </div>
      )}
    </QuickFilterBase>
  );
}
