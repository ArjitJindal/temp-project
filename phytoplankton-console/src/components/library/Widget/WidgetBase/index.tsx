import cn from 'clsx';
import React from 'react';
import { WidgetProps } from '../types';
import s from './index.module.less';

type Props = Pick<WidgetProps, 'children' | 'width'>;

function WidgetBase(props: Props, ref: React.Ref<HTMLInputElement>) {
  const { children, width = 'FULL' } = props;
  return (
    <div ref={ref} className={cn(s.root, s[`width-${width}`])}>
      {children}
    </div>
  );
}

export default React.forwardRef(WidgetBase);
