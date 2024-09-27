import React from 'react';
import cn from 'clsx';
import s from './style.module.less';
import CloseLineIcon from '@/components/ui/icons/Remix/system/close-line.react.svg';

export interface Props {
  buttonText?: React.ReactNode;
  icon?: React.ReactNode | false;
  analyticsName?: string;
  isActive?: boolean;
  onClear?: () => void;
  onClick?: () => void;
  children?: React.ReactNode;
}

export default function QuickFilterButton(props: Props) {
  const { icon, buttonText, onClick, isActive, onClear, children } = props;
  return (
    <button
      data-cy="rules-filter"
      className={cn(s.root, isActive && s.isActive, onClick != null && s.isClickable)}
      onClick={() => {
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
