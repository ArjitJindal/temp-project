import React from 'react';
import ReactDOMServer from 'react-dom/server';
import cn from 'clsx';
import s from './index.module.less';
import { Permission } from '@/apis';
import { useHasPermissions } from '@/utils/user-utils';

export type ButtonType = 'PRIMARY' | 'SECONDARY' | 'TETRIARY' | 'TEXT';

export type ButtonSize = 'SMALL' | 'MEDIUM' | 'LARGE';

export interface ButtonProps {
  icon?: React.ReactElement;
  size?: ButtonSize;
  onClick?: () => void;
  analyticsName?: string;
  children?: React.ReactNode;
  isDisabled?: boolean;
  isLoading?: boolean;
  htmlType?: 'submit' | 'button';
  htmlAttrs?: React.ButtonHTMLAttributes<unknown>;
  style?: React.CSSProperties;
  className?: string;
  testName?: string;
  iconRight?: React.ReactNode;
  requiredPermissions?: Permission[];
  isLogout?: boolean;
}

interface BaseButtonProps extends Omit<ButtonProps, 'requiredPermissions'> {}

const BaseButton = React.forwardRef<HTMLButtonElement, BaseButtonProps>((props, ref) => {
  const {
    isDisabled = false,
    htmlType = 'button',
    icon,
    size = 'MEDIUM',
    onClick,
    children,
    isLoading,
    htmlAttrs = {},
    style,
    testName,
    className,
    iconRight,
    analyticsName,
  } = props;

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <>
      <button
        style={style}
        ref={ref}
        className={
          !isDisabled
            ? cn(
                s.root,
                s[`size-${size}`],
                (children === '' || children == null) && s.iconOnly,
                className,
                s.rootBorder,
              )
            : cn(
                s.root,
                s[`size-${size}`],
                (children === '' || children == null) && s.iconOnly,
                className,
              )
        }
        onClick={handleClick}
        disabled={isDisabled || isLoading}
        type={htmlType}
        data-cy={testName}
        data-attr={analyticsName}
        data-sentry-allow={true}
        {...htmlAttrs}
      >
        <div className={isDisabled ? cn(s.bodyDisabled) : cn(s.body)}>
          {icon && <GradientIcon icon={icon} isDisabled={isDisabled} />}
          <div className={cn(s.text)}>{children}</div>
          {iconRight && <div className={s.icon}>{iconRight}</div>}
        </div>
      </button>
    </>
  );
});

const AnimatedButton = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  const { requiredPermissions = [], ...baseProps } = props;
  const hasUserPermissions = useHasPermissions(requiredPermissions);

  return (
    <BaseButton {...baseProps} isDisabled={baseProps.isDisabled || !hasUserPermissions} ref={ref} />
  );
});

const extractPathFromIcon = (icon: React.ReactElement): string => {
  const iconString = ReactDOMServer.renderToString(icon);
  const parser = new DOMParser();
  const doc = parser.parseFromString(iconString, 'image/svg+xml');
  const pathElement = doc.querySelector('path');
  return pathElement?.getAttribute('d') || '';
};

const GradientIcon: React.FC<{ icon: React.ReactElement; isDisabled: boolean }> = ({
  icon,
  isDisabled,
}) => {
  return (
    <div className={cn(s.icon)}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="18.84%" stopColor="#4828de" />
            <stop offset="100%" stopColor="#db17b0" />
          </linearGradient>
          <linearGradient id="hoverGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="18.84%" stop-color="#fff" />
            <stop offset="100%" stop-color="#fff" />
          </linearGradient>
          <linearGradient id="disabledGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="18.84%" stop-color="#000000" />
            <stop offset="100%" stop-color="#000000" />
          </linearGradient>
        </defs>
        <path
          className={cn(s.path)}
          fill={isDisabled ? 'url(#disabledGradient)' : 'url(#gradient)'}
          d={extractPathFromIcon(icon)}
        ></path>
      </svg>
    </div>
  );
};

export default AnimatedButton;
