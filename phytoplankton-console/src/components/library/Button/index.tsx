import React, { useImperativeHandle, useRef } from 'react';
import cn from 'clsx';
import { Link, LinkProps } from 'react-router-dom';
import s from './index.module.less';
import { Permission } from '@/apis';
import { Resource, useHasPermissions } from '@/utils/user-utils';

export type ButtonRef = {
  click: () => void;
};

export type ButtonType = 'PRIMARY' | 'SECONDARY' | 'TETRIARY' | 'TEXT' | 'DANGER';

export type ButtonSize = 'SMALL' | 'MEDIUM' | 'LARGE';

export interface CommonButtonProps {
  type?: ButtonType;
  icon?: React.ReactNode;
  size?: ButtonSize;
  onClick?: () => void;
  analyticsName?: string;
  children?: React.ReactNode;
  isDisabled?: boolean;
  isLoading?: boolean;
  htmlType?: 'submit' | 'button';
  style?: React.CSSProperties;
  className?: string;
  testName?: string;
  iconRight?: React.ReactNode;
  requiredPermissions?: Permission[];
  isLogout?: boolean;
  requiredResources?: Resource[];
}

export interface ButtonProps extends CommonButtonProps {
  asLink?: false | undefined;
  htmlAttrs?: React.ButtonHTMLAttributes<unknown>;
}

export interface ButtonLinkProps
  extends CommonButtonProps,
    Pick<LinkProps, 'to' | 'reloadDocument' | 'replace' | 'state'> {
  asLink: true;
  htmlAttrs?: React.AnchorHTMLAttributes<unknown>;
}

export type Props = ButtonProps | ButtonLinkProps;

const BaseButton = React.forwardRef<ButtonRef, Props>((props: Props, ref) => {
  const {
    type = 'PRIMARY',
    htmlType = 'button',
    icon,
    size = 'MEDIUM',
    onClick,
    children,
    isDisabled,
    isLoading,
    style,
    testName,
    className,
    iconRight,
    analyticsName,
  } = props;

  const handleClick = () => {
    if (onClick) {
      onClick?.();
    }
  };

  const isLink = 'asLink' in props && props.asLink === true;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  useImperativeHandle(
    ref,
    () => {
      if (isLink) {
        return {
          click: () => {
            linkRef.current?.click();
          },
        };
      } else {
        return {
          click: () => {
            buttonRef.current?.click();
          },
        };
      }
    },
    [isLink],
  );

  const buttonDisabled = isDisabled || isLoading;

  const sharedProps = {
    style: style,
    className: cn(
      s.root,
      s[`size-${size}`],
      s[`type-${type}`],
      buttonDisabled && s.isDisabled,
      (children === '' || children == null) && s.iconOnly,
      className,
    ),
    onClick: handleClick,
    disabled: buttonDisabled,
    type: htmlType,
    'data-cy': testName,
    'data-attr': analyticsName,
    'data-sentry-allow': true,
  };

  const newChildren = (
    <>
      {icon && <div className={s.icon}>{icon}</div>}
      {children}
      {iconRight && <div className={s.icon}>{iconRight}</div>}
    </>
  );

  if ('asLink' in props && props.asLink === true) {
    return (
      <Link ref={linkRef} to={props.to} {...sharedProps} {...props.htmlAttrs}>
        {newChildren}
      </Link>
    );
  }

  return (
    <button ref={buttonRef} {...sharedProps} {...props.htmlAttrs}>
      {newChildren}
    </button>
  );
});

const Button = React.forwardRef<ButtonRef, Props>((props, ref) => {
  const { requiredPermissions = [], requiredResources = [], ...baseProps } = props;
  const hasUserPermissions = useHasPermissions(requiredPermissions, requiredResources);

  return (
    <BaseButton {...baseProps} isDisabled={baseProps.isDisabled || !hasUserPermissions} ref={ref} />
  );
});

export { BaseButton };
export default Button;
