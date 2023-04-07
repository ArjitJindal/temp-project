import React from 'react';
import { message as AntMessage } from 'antd';
import cn from 'clsx';
import { NoticeType } from 'antd/lib/message';
import * as Sentry from '@sentry/react';
import s from './index.module.less';
import CheckboxCircleFillIcon from '@/components/ui/icons/Remix/system/checkbox-circle-fill.react.svg';
import CloseCircleFillIcon from '@/components/ui/icons/Remix/system/close-circle-fill.react.svg';
import CloseFillIcon from '@/components/ui/icons/Remix/system/close-fill.react.svg';

const errorsCaptured: string[] = [];

export type CloseMessage = () => void;

export type ShowMessage = (message: string) => CloseMessage;
export type ShowMessageWithOptionalError = (message: string, error?: any | unknown) => CloseMessage;
export const success: ShowMessage = (message: string) => {
  return open(message, 'SUCCESS');
};

export const fatal: ShowMessageWithOptionalError = (message: string, error: any | unknown) => {
  if (!errorsCaptured.includes(message) && process.env.ENV !== 'local') {
    errorsCaptured.push(message); // prevent duplicate errors
    Sentry.captureException(error);
  }
  return open(message, 'ERROR');
};

export const error: ShowMessage = (message: string) => {
  return open(message, 'ERROR');
};

export const loading: ShowMessage = (message: string) => {
  return open(message, 'LOADING');
};

export const warn: ShowMessage = (message: string) => {
  return open(message, 'WARNING');
};

export const message = {
  success,
  error,
  loading,
  warn,
  fatal,
};

/*
  Helper functions
 */

function open(message: string, type: 'SUCCESS' | 'ERROR' | 'LOADING' | 'WARNING'): CloseMessage {
  let icon: React.ReactNode | undefined;
  let antType: NoticeType | undefined = undefined;
  let isClosable = true;
  if (type === 'SUCCESS') {
    icon = <CheckboxCircleFillIcon className={cn(s.icon, s.success)} />;
  } else if (type === 'ERROR') {
    icon = <CloseCircleFillIcon className={cn(s.icon, s.error)} />;
  } else if (type === 'LOADING') {
    antType = 'loading';
    isClosable = false;
  } else {
    antType = 'warning';
  }
  const close = AntMessage.open({
    icon: icon,
    type: antType,
    content: (
      <div className={s.message}>
        <div className={s.messageText}>{message}</div>
        {isClosable && (
          <div
            className={s.closeIcon}
            onClick={() => {
              close();
            }}
          >
            <CloseFillIcon />
          </div>
        )}
      </div>
    ),
    duration: isClosable ? undefined : 0,
    className: s.root,
  });
  return close;
}
