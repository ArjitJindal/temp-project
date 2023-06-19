import React, { ReactSVGElement } from 'react';
import cn from 'clsx';
import { Tooltip } from 'antd';
import s from './style.module.less';
import CloseCircleFillIcon from '@/components/ui/icons/Remix/system/close-circle-fill.react.svg';
import { useButtonTracker } from '@/utils/tracker';

interface Props {
  isActive?: boolean;
  icon: React.ReactNode;
  analyticsName?: string;
  onClick?: () => void;
  onClear?: () => void;
  children: string;
  color?: 'GREEN' | 'ORANGE' | 'BLUE' | 'TURQUOISE' | 'SKY_BLUE' | 'LEAF_GREEN' | 'WHITE';
  title?: string;
  toolTip?: string;
}

export default function ActionButton(props: Props) {
  const {
    icon,
    color = 'GREEN',
    onClick,
    onClear,
    children,
    isActive,
    title,
    analyticsName,
  } = props;

  const buttonTracker = useButtonTracker();
  const handleClick = function (this: unknown, ...args: any) {
    if (onClick) {
      onClick.apply(this, args);
    }

    if (analyticsName) {
      buttonTracker(analyticsName);
    }
  };

  const handleClear = (e: React.MouseEvent<ReactSVGElement, MouseEvent>) => {
    e.stopPropagation();
    if (onClear) onClear();
  };

  return (
    <Tooltip title={props.toolTip} placement="bottom">
      <button
        className={cn(s.root, isActive && s.isActive, s[`color-${color}`])}
        onClick={handleClick}
        title={title}
      >
        <div className={s.icon} role="presentation">
          {icon}
        </div>
        <div className={s.children}>{children}</div>
        {isActive && onClear && (
          <CloseCircleFillIcon className={s.clearIcon} role="presentation" onClick={handleClear} />
        )}
      </button>
    </Tooltip>
  );
}
