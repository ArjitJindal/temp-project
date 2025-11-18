import React from 'react';
import cn from 'clsx';
import * as Sentry from '@sentry/react';
import toast, { ToastPosition } from 'react-hot-toast';
import s from './index.module.less';
import FileCopyOutlined from '@/components/ui/icons/Remix/document/file-copy-line.react.svg';
import InformationFillIcon from '@/components/ui/icons/Remix/system/information-fill.react.svg';
import CheckboxCircleFillIcon from '@/components/ui/icons/Remix/system/checkbox-circle-fill.react.svg';
import ErrorWarningFillIcon from '@/components/ui/icons/Remix/system/error-warning-fill.react.svg';
import CloseFillIcon from '@/components/ui/icons/Remix/system/close-fill.react.svg';
import AlertFillIcon from '@/components/ui/icons/Remix/system/alert-fill.react.svg';
import Link from '@/components/ui/Link';
import { copyTextToClipboard } from '@/utils/browser';
import { getErrorMessage } from '@/utils/lang';
import { CY_LOADING_FLAG_CLASS } from '@/utils/cypress';

const errorsCaptured: string[] = [];

export type CloseMessage = () => void;

type ShowNotificationOptions = {
  duration?: number;
  details?: string;
  onClose?: () => void;
  link?: string;
  linkTitle?: string;
  position?: ToastPosition;
  copyFeedback?: string;
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
  options?: Omit<ShowNotificationOptions, 'duration' | 'position'>,
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
    details: options?.details ?? getErrorMessage(error),
  });
};

export const error: ShowNotification = (
  message: React.ReactNode,
  options?: Omit<ShowNotificationOptions, 'duration' | 'position'>,
) => {
  return open(message, 'ERROR', {
    ...options,
    duration: 0,
  });
};

export const loading: ShowNotification = (
  message: React.ReactNode,
  options?: Omit<ShowNotificationOptions, 'duration' | 'position'>,
) => {
  return open(message, 'LOADING', {
    ...options,
    position: 'top-center',
    duration: Infinity,
  });
};

export const warn: ShowNotification = (
  message: React.ReactNode,
  options?: Omit<ShowNotificationOptions, 'duration' | 'position'>,
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
  let defaultDuration = 3000;
  if (options?.link && options.linkTitle) {
    defaultDuration = 6000;
  } else if (type === 'LOADING') {
    defaultDuration = Infinity;
  }
  const toastId = toast(
    (t) => {
      return (
        <MessageBody
          isVisible={t.visible}
          type={type}
          title={title}
          link={options?.link}
          linkTitle={options?.linkTitle}
          options={options}
          onClose={() => {
            toast.dismiss(t.id);
            options?.onClose?.();
          }}
        >
          {options?.details}
          {options?.link && (
            <Link
              className={s.messageLink}
              to={options?.link}
              onClick={() => {
                toast.dismiss(t.id);
              }}
            >
              {options?.linkTitle ?? 'Link'}
            </Link>
          )}
        </MessageBody>
      );
    },
    {
      position: options?.position ?? (options?.link ? 'bottom-right' : 'top-center'),
      duration: options?.duration ?? defaultDuration,
    },
  );
  return () => {
    toast.dismiss(toastId);
  };
}

export function MessageBody(props: {
  type: 'INFO' | 'SUCCESS' | 'ERROR' | 'LOADING' | 'WARNING';
  title: React.ReactNode;
  link?: string;
  linkTitle?: string;
  children?: React.ReactNode;
  onClose?: () => void;
  isVisible?: boolean;
  options?: ShowNotificationOptions;
}) {
  const { type, title, children, options, onClose, link, isVisible } = props;

  let icon: React.ReactNode | undefined = undefined;
  let isClosable = true;
  if (type === 'INFO') {
    icon = <InformationFillIcon className={s.icon} height={16} width={16} />;
  } else if (type === 'SUCCESS') {
    icon = <CheckboxCircleFillIcon className={s.icon} height={16} width={16} />;
  } else if (type === 'ERROR') {
    icon = <AlertFillIcon className={s.icon} height={16} width={16} />;
  } else if (type === 'WARNING') {
    icon = <ErrorWarningFillIcon className={s.icon} height={16} width={16} />;
  } else if (type === 'LOADING') {
    isClosable = false;
  }

  return (
    <div
      className={cn(
        s.message,
        s[`type-${type}`],
        isVisible != null && s.isAnimationEnabled,
        !isVisible && s.isHidden,
        (options?.details || options?.link) && s.largeMessage,
        type === 'LOADING' && CY_LOADING_FLAG_CLASS,
      )}
      data-sentry-allow={type === 'ERROR'}
      data-cy="toast-body"
    >
      <div className={s.iconWrapper}>{icon}</div>
      <div className={s.messageText}>
        <div className={s.messageTitle} data-cy={'toast-message-title'}>
          {title}
        </div>
        {(options?.details || options?.link) && (
          <div className={s.messageBody} data-cy={'toast-message-body'}>
            {children}
          </div>
        )}
      </div>
      <div className={s.messageActions}>
        {isClosable && (
          <CloseFillIcon className={s.closeIcon} height={16} width={16} onClick={onClose} />
        )}
        {link && (
          <FileCopyOutlined
            height={16}
            width={16}
            className={s.copyIcon}
            onClick={() => {
              message.success(options?.copyFeedback ?? 'Link copied to clipboard');
              copyTextToClipboard(`${window.location.origin}${link}`);
            }}
          />
        )}
      </div>
    </div>
  );
}
