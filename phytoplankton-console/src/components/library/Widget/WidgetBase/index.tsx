import cn from 'clsx';
import React from 'react';
import { WidgetProps } from '../types';
import s from './index.module.less';

type Props = Pick<WidgetProps, 'children' | 'width'>;

export default function WidgetBase(props: Props) {
  const { children, width = 'FULL' } = props;
  return <div className={cn(s.root, s[`width-${width}`])}>{children}</div>;
}
