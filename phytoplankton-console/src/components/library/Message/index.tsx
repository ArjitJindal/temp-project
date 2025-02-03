import React from 'react';
import { message as AntMessage } from 'antd';
import cn from 'clsx';
import * as Sentry from '@sentry/react';
import s from './index.module.less';
import InformationFillIcon from '@/components/ui/icons/Remix/system/information-fill.react.svg';
import CheckboxCircleFillIcon from '@/components/ui/icons/Remix/system/checkbox-circle-fill.react.svg';
import ErrorWarningFillIcon from '@/components/ui/icons/Remix/system/error-warning-fill.react.svg';
import CloseFillIcon from '@/components/ui/icons/Remix/system/close-fill.react.svg';
import AlertFillIcon from '@/components/ui/icons/Remix/system/alert-fill.react.svg';
import Link from '@/components/ui/Link';

const errorsCaptured: string[] = [];

export type CloseMessage = () => void;

type ShowNotificationOptions = {
  duration?: number;
  details?: string;
  onClose?: () => void;
  link?: string;
  linkTitle?: string;
};

export type ShowNotification = (
  message: React.ReactNode,
  options?: ShowNotificationOptions,
) => CloseMessage;

export type ShowNotificationWithOptionalError = (
  message: React.ReactNode,
  error?: any | unknown,
  options?: ShowNotificationOptions,
) => CloseMessage;

export const info: ShowNotification = (
  message: React.ReactNode,
  options?: ShowNotificationOptions,
) => {
  return open(message, 'INFO', options);
};

export const success: ShowNotification = (
  message: React.ReactNode,
  options?: ShowNotificationOptions,
) => {
  return open(message, 'SUCCESS', options);
};

export const fatal: ShowNotificationWithOptionalError = (
  message: React.ReactNode,
  error: any | unknown,
  options?: Omit<ShowNotificationOptions, 'duration'>,
) => {
  if (!errorsCaptured.includes(message?.toString() || '') && process.env.ENV_NAME !== 'local') {
    errorsCaptured.push(message?.toString() || ''); // prevent duplicate errors
    if (error instanceof Error) {
      Sentry.captureException(error);
    }
  }
  return open(message, 'ERROR', {
    ...options,
    duration: 0,
  });
};

export const error: ShowNotification = (
  message: React.ReactNode,
  options?: Omit<ShowNotificationOptions, 'duration'>,
) => {
  return open(message, 'ERROR', {
    ...options,
    duration: 0,
  });
};

export const loading: ShowNotification = (
  message: React.ReactNode,
  options?: Omit<ShowNotificationOptions, 'duration'>,
) => {
  return open(message, 'LOADING', {
    ...options,
    duration: 0,
  });
};

export const warn: ShowNotification = (
  message: React.ReactNode,
  options?: Omit<ShowNotificationOptions, 'duration'>,
) => {
  return open(message, 'WARNING', {
    ...options,
    duration: 0,
  });
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
  title: React.ReactNode,
  type: 'INFO' | 'SUCCESS' | 'ERROR' | 'LOADING' | 'WARNING',
  options?: ShowNotificationOptions,
): CloseMessage {
  const close = AntMessage.open({
    content: (
      <MessageBody
        type={type}
        title={title}
        onClose={() => {
          options?.onClose?.();
          close();
        }}
      >
        {options?.details}
      </MessageBody>
    ),
    duration: options?.duration ?? 5,
    className: s.root,
  });
  return close;
}

export function MessageBody(props: {
  type: 'INFO' | 'SUCCESS' | 'ERROR' | 'LOADING' | 'WARNING';
  title: React.ReactNode;
  link?: string;
  linkTitle?: string;
  children?: React.ReactNode;
  onClose?: () => void;
}) {
  const { type, title, children, link, linkTitle, onClose } = props;
  let icon: React.ReactNode | undefined = undefined;
  let isClosable = true;
  if (type === 'INFO') {
    icon = <InformationFillIcon className={cn(s.icon)} />;
  } else if (type === 'SUCCESS') {
    icon = <CheckboxCircleFillIcon className={cn(s.icon)} />;
  } else if (type === 'ERROR') {
    icon = <AlertFillIcon className={cn(s.icon)} />;
  } else if (type === 'WARNING') {
    icon = <ErrorWarningFillIcon className={cn(s.icon)} />;
  } else if (type === 'LOADING') {
    isClosable = false;
  }

  return (
    <div className={cn(s.message, s[`type-${type}`])} data-sentry-allow={type === 'ERROR'}>
      <div className={s.iconWrapper}>{icon}</div>
      <div className={s.messageText} data-cy="ant-message-popup">
        <div className={s.messageTitle}>
          {title}
          {link && (
            <Link className={s.messageLink} to={link}>
              {linkTitle ?? 'Link'}
            </Link>
          )}
        </div>
        <div className={s.messageBody}>{children}</div>
      </div>
      {isClosable && (
        <div className={s.closeIcon} onClick={onClose}>
          <CloseFillIcon />
        </div>
      )}
    </div>
  );
}
