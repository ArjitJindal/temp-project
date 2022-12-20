import { Button as AntButton, ButtonProps as AntButtonProps } from 'antd';
import React from 'react';
import { ButtonType as AntButtonType } from 'antd/es/button';
import cn from 'clsx';
import s from './index.module.less';

interface ExtraProps {
  type?: AntButtonType | 'skeleton';
  analyticsName?: string;
}

export default function Button(props: Omit<AntButtonProps, keyof ExtraProps> & ExtraProps) {
  const { type, icon, size, children, ...rest } = props;

  const handleClick = function (this: unknown, ...args: any) {
    if (props.onClick) {
      props.onClick.apply(this, args);
    }
  };

  return (
    <AntButton
      size={size}
      type={type === 'skeleton' ? 'default' : type}
      className={cn(s.root, s[`size-${size}`], {
        [s.typeSkeleton]: type === 'skeleton',
      })}
      {...rest}
      onClick={handleClick}
    >
      {icon && <div className={s.icon}>{icon}</div>}
      {children}
    </AntButton>
  );
}
