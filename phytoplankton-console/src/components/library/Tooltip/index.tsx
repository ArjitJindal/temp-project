import React from 'react';
import { Tooltip as AntTooltip, TooltipProps } from 'antd';
import s from './style.module.less';
import COLORS from '@/components/ui/colors';

export default function Tooltip(props: TooltipProps & { color?: string }) {
  const { children, color = COLORS.gray10 } = props;
  return (
    <AntTooltip color={color} {...props}>
      <div className={s.root}>{children}</div>
    </AntTooltip>
  );
}
