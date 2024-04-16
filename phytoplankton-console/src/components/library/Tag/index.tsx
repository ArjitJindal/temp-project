import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import Confirm, { Props as ConfirmProps } from '@/components/utils/Confirm';

export interface TagAction {
  key: string;
  icon: React.ReactNode;
  confirm?: Omit<ConfirmProps, 'onConfirm' | 'children'>;
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
}

export default function Tag(props: Props) {
  const { onClick, color, icon, children, className, maxWidth, actions = [] } = props;

  return (
    <div className={cn(s.root)}>
      <div
        className={cn(s.body, s[`color-${color}`], onClick != null && s.isClickable, className)}
        onClick={onClick}
      >
        {icon && <div className={s.icon}>{icon}</div>}
        <div className={s.text} style={{ maxWidth }}>
          {children}
        </div>
        {actions.length > 0 && (
          <div className={s.actions}>
            {props.actions?.map(({ icon, action, key, confirm }) => {
              if (confirm == null) {
                return (
                  <button
                    className={s.action}
                    key={key}
                    onClick={(e) => {
                      e.preventDefault();
                      action();
                    }}
                  >
                    {icon}
                  </button>
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
