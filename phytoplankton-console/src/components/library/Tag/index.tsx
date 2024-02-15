import React from 'react';
import cn from 'clsx';
import s from './style.module.less';
import { neverReturn } from '@/utils/lang';
import Confirm, { Props as ConfirmProps } from '@/components/utils/Confirm';

export const styles = s;

interface TagAction {
  key: string;
  icon: React.ReactNode;
  confirm?: Omit<ConfirmProps, 'onConfirm' | 'children'>;
  action: () => void;
}

export interface TagWithActionsProps {
  kind: 'TAG_WITH_ACTIONS';
  className?: string;
  children: string;
  actions: TagAction[];
  maxWidth?: number;
}

export type Props = TagWithActionsProps;

export default function Tag(props: Props): JSX.Element {
  if (props.kind === 'TAG_WITH_ACTIONS') {
    return <TagWithActions {...props}>{props.children}</TagWithActions>;
  }
  return neverReturn<JSX.Element>(props.kind, <></>);
}

function TagWithActions(props: TagWithActionsProps): JSX.Element {
  return (
    <div className={cn(s.root, s[`kind-${props.kind}`], props.className)}>
      <div className={s.text} style={{ maxWidth: props.maxWidth }}>
        {props.children}
      </div>
      <div className={s.actions}>
        {props.actions.map(({ icon, action, key, confirm }) => {
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
    </div>
  );
}
