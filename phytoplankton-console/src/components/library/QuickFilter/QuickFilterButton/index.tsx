import React from 'react';
import cn from 'clsx';
import s from './style.module.less';
import CloseLineIcon from '@/components/ui/icons/Remix/system/close-line.react.svg';

export interface Props {
  buttonText?: React.ReactNode;
  autoWidth?: boolean;
  icon?: React.ReactNode | false;
  analyticsName?: string;
  isActive?: boolean;
  isDisabled?: boolean;
  onClear?: () => void;
  onClick?: () => void;
  children?: React.ReactNode;
}

export default function QuickFilterButton(props: Props) {
  const {
    icon,
    autoWidth = false,
    buttonText,
    onClick,
    isActive,
    isDisabled,
    onClear,
    children,
  } = props;
  return (
    <button
      data-cy="rules-filter"
      disabled={isDisabled}
      className={cn(
        s.root,
        isActive && s.isActive,
        autoWidth && s.autoWidth,
        onClick != null && s.isClickable,
      )}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
    >
      {icon && <div className={s.icon}>{icon}</div>}
      <div className={s.title} title={typeof buttonText === 'string' ? buttonText : undefined}>
        {buttonText}
      </div>
      {onClear && (
        <CloseLineIcon
          className={s.clearIcon}
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
        />
      )}
      {children}
    </button>
  );
}
