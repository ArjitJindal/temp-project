import cn from 'clsx';
import React from 'react';
import { WidgetProps } from '../types';
import s from './index.module.less';

type Props = Pick<WidgetProps, 'children' | 'width' | 'id'>;

function WidgetBase(props: Props, ref: React.Ref<HTMLInputElement>) {
  const { children, width = 'FULL', id } = props;
  return (
    <div ref={ref} className={cn(s.root, s[`width-${width}`])} data-cy={id}>
      {children}
    </div>
  );
}

export default React.forwardRef(WidgetBase);
