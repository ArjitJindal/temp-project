import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import { Permission } from '@/apis';
import { useHasPermissions } from '@/utils/user-utils';

export type ButtonType = 'PRIMARY' | 'SECONDARY' | 'TETRIARY' | 'TEXT';

export type ButtonSize = 'SMALL' | 'MEDIUM' | 'LARGE';

export interface ButtonProps {
  type?: ButtonType;
  icon?: React.ReactNode;
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
  isDanger?: boolean;
}

function Button(props: ButtonProps, ref: React.Ref<HTMLButtonElement>) {
  const {
    type = 'PRIMARY',
    htmlType = 'button',
    icon,
    size = 'MEDIUM',
    onClick,
    children,
    isDisabled,
    isLoading,
    htmlAttrs = {},
    style,
    testName,
    className,
    iconRight,
    requiredPermissions = [],
    isDanger = false,
    analyticsName,
  } = props;
  const hasUserPermissions = useHasPermissions(requiredPermissions);
  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <button
      style={style}
      ref={ref}
      className={cn(
        s.root,
        s[`size-${size}`],
        s[`type-${type}${isDanger ? '-danger' : ''}`],
        (children === '' || children == null) && s.iconOnly,
        className,
      )}
      onClick={handleClick}
      disabled={isDisabled || isLoading || !hasUserPermissions}
      type={htmlType}
      data-cy={testName}
      data-attr={analyticsName}
      data-sentry-allow={true}
      {...htmlAttrs}
    >
      {icon && <div className={s.icon}>{icon}</div>}
      {children}
      {iconRight && <div className={s.icon}>{iconRight}</div>}
    </button>
  );
}

const component: React.FunctionComponent<
  ButtonProps & {
    ref?: React.Ref<HTMLButtonElement>;
  }
> = React.forwardRef<HTMLButtonElement>(Button);
export default component;
