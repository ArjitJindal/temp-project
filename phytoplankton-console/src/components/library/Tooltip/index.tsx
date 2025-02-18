import React from 'react';
import { Tooltip as AntTooltip, TooltipProps } from 'antd';
import COLORS from '@/components/ui/colors';

export default function Tooltip(props: TooltipProps) {
  const { children } = props;
  return (
    <AntTooltip color={COLORS.gray10} {...props}>
      <div>{children}</div>
    </AntTooltip>
  );
}
