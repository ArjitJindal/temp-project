import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import { useButtonTracker } from '@/utils/tracker';

export type ButtonType = 'PRIMARY' | 'SECONDARY' | 'TETRIARY' | 'TEXT';

export type ButtonSize = 'SMALL' | 'MEDIUM' | 'LARGE';

interface Props {
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
}

function Button(props: Props, ref: React.Ref<HTMLButtonElement>) {
  const {
    type = 'PRIMARY',
    htmlType = 'button',
    icon,
    size = 'MEDIUM',
    onClick,
    children,
    analyticsName,
    isDisabled,
    isLoading,
    htmlAttrs = {},
    style,
    testName,
    className,
    iconRight,
  } = props;
  const buttonTracker = useButtonTracker();

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
    if (analyticsName) {
      buttonTracker(analyticsName);
    }
  };

  return (
    <button
      style={style}
      ref={ref}
      className={cn(s.root, s[`size-${size}`], s[`type-${type}`], className)}
      onClick={handleClick}
      disabled={isDisabled || isLoading}
      type={htmlType}
      data-cy={testName}
      {...htmlAttrs}
    >
      {icon && <div className={s.icon}>{icon}</div>}
      {children}
      {iconRight && <div className={s.icon}>{iconRight}</div>}
    </button>
  );
}

const component: React.FunctionComponent<
  Props & {
    ref?: React.Ref<HTMLButtonElement>;
  }
> = React.forwardRef<HTMLButtonElement>(Button);
export default component;
