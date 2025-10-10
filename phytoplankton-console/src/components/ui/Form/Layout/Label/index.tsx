import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import Tooltip from '@/components/library/Tooltip';
import InformationLineIcon from '@/components/ui/icons/Remix/system/information-line.react.svg';

interface Props {
  icon?: React.ReactNode;
  title: string;
  orientation?: 'horizontal' | 'vertical';
  variant?: 'default' | 'bold';
  color?: 'default' | 'dark';
  children?: React.ReactNode;
  className?: string;
  tooltip?: string;
  isChangedIcon?: boolean;
}

export default function Label(props: Props) {
  const {
    icon,
    title,
    variant = 'default',
    orientation = 'vertical',
    color = 'default',
    children,
    className = '',
    tooltip,
    isChangedIcon = false,
  } = props;
  return (
    <div className={cn(s.root, s[variant], s[`orientation-${orientation}`], className)}>
      <div className={s.header}>
        {icon && <div className={s.icon}>{icon}</div>}
        <div className={cn(s.title, s[color])}>{title}</div>
        {tooltip && (
          <div className={s.icon}>
            <Tooltip title={tooltip}>
              <InformationLineIcon />
            </Tooltip>
          </div>
        )}
        {isChangedIcon && <div className={s.isChangedIcon} />}
      </div>
      {children}
    </div>
  );
}
