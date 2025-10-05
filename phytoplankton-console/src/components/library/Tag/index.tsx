import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import Confirm, { Props as ConfirmProps } from '@/components/utils/Confirm';
import Tooltip from '@/components/library/Tooltip';

export interface TagAction {
  key: string;
  icon: React.ReactNode;
  confirm?: Omit<ConfirmProps, 'onConfirm' | 'children'>;
  disabled?: boolean | string;
  action: () => void;
}

export type TagColor =
  | 'orange'
  | 'blue'
  | 'green'
  | 'cyan'
  | 'gray'
  | 'gold'
  | 'pink'
  | 'purple'
  | 'magenta'
  | 'volcano'
  | 'red'
  | 'processing'
  | 'success'
  | 'error'
  | 'warning'
  | 'action';

interface Props {
  color?: TagColor;
  className?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: number;
  actions?: TagAction[];
  onClick?: () => void;
  wrapText?: boolean;
  trimText?: boolean;
}

export default function Tag(props: Props) {
  const {
    onClick,
    color,
    icon,
    children,
    className,
    maxWidth,
    actions = [],
    wrapText = true,
    trimText = true,
  } = props;

  return (
    <div className={cn(s.root, trimText && trimText && s.trimText)}>
      <div
        className={cn(s.body, s[`color-${color}`], onClick != null && s.isClickable, className)}
        onClick={onClick}
      >
        {icon && <div className={s.icon}>{icon}</div>}
        <div className={cn(s.text, wrapText && s.wrapText)} style={{ maxWidth }}>
          {children}
        </div>
        {actions.length > 0 && (
          <div className={s.actions}>
            {props.actions?.map(({ icon, action, key, confirm, disabled }) => {
              if (confirm == null) {
                return (
                  <Tooltip key={key} title={typeof disabled === 'string' ? disabled : undefined}>
                    <button
                      disabled={disabled === true || typeof disabled === 'string'}
                      className={s.action}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        action();
                      }}
                    >
                      {icon}
                    </button>
                  </Tooltip>
                );
              }
              return (
                <Confirm {...confirm} key={key} onConfirm={action}>
                  {({ onClick }) => (
                    <button className={s.action} onClick={onClick}>
                      {icon}
                    </button>
                  )}
                </Confirm>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
