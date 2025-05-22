import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import { Permission } from '@/apis';
import { useHasPermissions, useHasStatements } from '@/utils/user-utils';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

export type ButtonType = 'PRIMARY' | 'SECONDARY' | 'TETRIARY' | 'TEXT' | 'DANGER';

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
  isLogout?: boolean;
  requiredStatements?: string[];
}

interface BaseButtonProps extends Omit<ButtonProps, 'requiredPermissions'> {}

const BaseButton = React.forwardRef<HTMLButtonElement, BaseButtonProps>((props, ref) => {
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
    analyticsName,
  } = props;

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
        s[`type-${type}`],
        (children === '' || children == null) && s.iconOnly,
        className,
      )}
      onClick={handleClick}
      disabled={isDisabled || isLoading}
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
});

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  const { requiredPermissions = [], requiredStatements = [], ...baseProps } = props;
  const hasUserPermissions = useHasPermissions(requiredPermissions);
  const isRBACV2Enabled = useFeatureEnabled('RBAC_V2');
  const hasRequiredStatements = useHasStatements(requiredStatements);

  // if RBAC V2 is enabled, then we need to check if the user has the required statements else check if the user has the required permissions
  const isNotEnoughPermissions =
    isRBACV2Enabled && requiredStatements.length > 0 ? !hasRequiredStatements : !hasUserPermissions;

  return (
    <BaseButton
      {...baseProps}
      isDisabled={baseProps.isDisabled || isNotEnoughPermissions}
      ref={ref}
    />
  );
});

export { BaseButton };
export default Button;
