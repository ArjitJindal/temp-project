import React from 'react';
import { message as AntMessage } from 'antd';
import cn from 'clsx';
import { NoticeType } from 'antd/lib/message';
import * as Sentry from '@sentry/react';
import s from './index.module.less';
import InformationFillIcon from '@/components/ui/icons/Remix/system/information-fill.react.svg';
import CheckboxCircleFillIcon from '@/components/ui/icons/Remix/system/checkbox-circle-fill.react.svg';
import CloseCircleFillIcon from '@/components/ui/icons/Remix/system/close-circle-fill.react.svg';
import CloseFillIcon from '@/components/ui/icons/Remix/system/close-fill.react.svg';

const errorsCaptured: string[] = [];

export type CloseMessage = () => void;

type ShowMessageOptions = {
  duration?: number;
  onClose?: () => void;
};

export type ShowMessage = (message: React.ReactNode, options?: ShowMessageOptions) => CloseMessage;
export type ShowMessageWithOptionalError = (
  message: React.ReactNode,
  error?: any | unknown,
  options?: ShowMessageOptions,
) => CloseMessage;

export const info: ShowMessage = (message: React.ReactNode, options?: ShowMessageOptions) => {
  return open(message, 'INFO', options);
};

export const success: ShowMessage = (message: React.ReactNode, options?: ShowMessageOptions) => {
  return open(message, 'SUCCESS', options);
};

export const fatal: ShowMessageWithOptionalError = (
  message: React.ReactNode,
  error: any | unknown,
  options?: ShowMessageOptions,
) => {
  if (!errorsCaptured.includes(message?.toString() || '') && process.env.ENV_NAME !== 'local') {
    errorsCaptured.push(message?.toString() || ''); // prevent duplicate errors
    if (error instanceof Error) {
      Sentry.captureException(error);
    }
  }
  return open(message, 'ERROR', options);
};

export const error: ShowMessage = (message: React.ReactNode, options?: ShowMessageOptions) => {
  return open(message, 'ERROR', options);
};

export const loading: ShowMessage = (message: React.ReactNode) => {
  return open(message, 'LOADING');
};

export const warn: ShowMessage = (message: React.ReactNode, options?: ShowMessageOptions) => {
  return open(message, 'WARNING', options);
};

export const message = {
  info,
  success,
  error,
  loading,
  warn,
  fatal,
};

/*
  Helper functions
 */

function open(
  message: React.ReactNode,
  type: 'INFO' | 'SUCCESS' | 'ERROR' | 'LOADING' | 'WARNING',
  options?: ShowMessageOptions,
): CloseMessage {
  let icon: React.ReactNode | undefined;
  let antType: NoticeType | undefined = undefined;
  let isClosable = true;
  if (type === 'INFO') {
    icon = <InformationFillIcon className={cn(s.icon, s.info)} />;
  } else if (type === 'SUCCESS') {
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
      <div className={s.message} data-sentry-allow={type === 'ERROR'}>
        <div className={s.messageText} data-cy="ant-message-popup">
          {message}
        </div>
        {isClosable && (
          <div
            className={s.closeIcon}
            onClick={() => {
              if (options?.onClose) {
                options.onClose();
              }
              close();
            }}
          >
            <CloseFillIcon />
          </div>
        )}
      </div>
    ),
    duration: isClosable ? options?.duration ?? 5 : 0,
    className: s.root,
  });
  return close;
}
