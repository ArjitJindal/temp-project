import React, { ReactSVGElement } from 'react';
import cn from 'clsx';
import s from './style.module.less';
import { useAnalytics } from '@/utils/segment/context';
import CloseCircleFillIcon from '@/components/ui/icons/Remix/system/close-circle-fill.react.svg';

interface Props {
  isActive?: boolean;
  icon: React.ReactNode;
  analyticsName?: string;
  onClick?: () => void;
  onClear?: () => void;
  children: string;
  color?: 'GREEN' | 'ORANGE' | 'BLUE' | 'TURQUOISE';
  title?: string;
}

export default function ActionButton(props: Props) {
  const {
    icon,
    color = 'GREEN',
    onClick,
    onClear,
    children,
    isActive,
    analyticsName,
    title,
  } = props;

  const analytics = useAnalytics();

  const handleClick = function (this: unknown, ...args: any) {
    if (onClick) {
      onClick.apply(this, args);
    }
    if (analyticsName) {
      analytics.event({
        title: 'Button Clicked',
        name: analyticsName,
      });
    }
  };

  const handleClear = (e: React.MouseEvent<ReactSVGElement, MouseEvent>) => {
    e.stopPropagation();
    if (onClear) onClear();
  };

  return (
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
  );
}
