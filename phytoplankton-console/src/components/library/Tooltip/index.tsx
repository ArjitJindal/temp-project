import React from 'react';
import { Tooltip as AntTooltip, TooltipProps } from 'antd';
import s from './style.module.less';
import COLORS from '@/components/ui/colors';

export default function Tooltip(props: TooltipProps) {
  const { children } = props;
  return (
    <AntTooltip color={COLORS.gray10} {...props}>
      <div className={s.root}>{children}</div>
    </AntTooltip>
  );
}
