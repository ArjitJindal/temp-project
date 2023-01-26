import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import ExclamationCircleIcon from './exclamation-circle.react.svg';
import AlertFillIcon from '@/components/ui/icons/Remix/system/alert-fill.react.svg';
import InformationFillIcon from '@/components/ui/icons/Remix/system/information-fill.react.svg';

interface Props {
  type: 'error' | 'warning' | 'info';
  children: string;
}

export default function Alert(props: Props) {
  const { type, children } = props;
  return (
    <div className={cn(s.root, s[`type-${type}`])}>
      {type === 'error' && <AlertFillIcon className={s.icon} />}
      {type === 'warning' && <ExclamationCircleIcon className={s.icon} />}
      {type === 'info' && <InformationFillIcon className={s.icon} />}
      {children}
    </div>
  );
}
