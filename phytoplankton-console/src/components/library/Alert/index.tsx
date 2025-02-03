import cn from 'clsx';
import React from 'react';
import s from './index.module.less';
import ExclamationCircleIcon from './exclamation-circle.react.svg';
import AlertFillIcon from '@/components/ui/icons/Remix/system/alert-fill.react.svg';
import InformationFillIcon from '@/components/ui/icons/Remix/system/information-fill.react.svg';
import CheckboxCircleFillIcon from '@/components/ui/icons/Remix/system/checkbox-circle-fill.react.svg';

export type AlertType = 'ERROR' | 'WARNING' | 'INFO' | 'SUCCESS';

interface Props {
  type: AlertType;
  children: React.ReactNode;
}

export default function Alert(props: Props) {
  const { type, children } = props;
  return (
    <div
      className={cn(s.root, s[`type-${type}`])}
      data-cy={`alert-${type}`}
      data-sentry-allow={type === 'ERROR'}
    >
      <div className={s.body}>
        <div className={s.iconContainer}>
          {type === 'ERROR' && <AlertFillIcon className={s.icon} data-cy={`icon-${type}`} />}
          {type === 'WARNING' && (
            <ExclamationCircleIcon className={s.icon} data-cy={`icon-${type}`} />
          )}
          {type === 'INFO' && <InformationFillIcon className={s.icon} data-cy={`icon-${type}`} />}
          {type === 'SUCCESS' && (
            <CheckboxCircleFillIcon className={s.icon} data-cy={`icon-${type}`} />
          )}
        </div>
        <div className={s.text}>{children}</div>
      </div>
    </div>
  );
}
