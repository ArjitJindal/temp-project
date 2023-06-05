import React from 'react';
import { Modal as AntModal, Typography } from 'antd';
import cn from 'clsx';
import { ButtonProps } from 'antd/lib/button/button';
import s from './style.module.less';
import CloseCircleLineIcon from '@/components/ui/icons/Remix/system/close-fill.react.svg';

interface Props {
  title: string;
  icon?: React.ReactNode;
  hideFooter?: boolean;
  isOpen: boolean;
  onOk?: () => void;
  onCancel: () => void;
  children: React.ReactNode;
  okText?: string;
  okProps?: ButtonProps;
  cancelText?: string;
  width?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export default function Modal(props: Props) {
  const {
    icon,
    title,
    isOpen,
    onOk,
    okText,
    okProps,
    cancelText,
    onCancel,
    children,
    hideFooter = false,
    width,
    className,
    style,
  } = props;

  return (
    <AntModal
      className={cn(s.root, className)}
      title={
        <div className={s.header}>
          <div className={s.headerLeft}>
            {icon && <div className={s.icon}>{icon}</div>}
            <Typography.Title level={3} className={s.title}>
              {title}
            </Typography.Title>
          </div>
          <button className={s.close} onClick={onCancel}>
            <CloseCircleLineIcon />
          </button>
        </div>
      }
      visible={isOpen}
      onCancel={onCancel}
      okText={okText}
      cancelText={cancelText}
      closable={false}
      onOk={onOk}
      okButtonProps={okProps}
      footer={hideFooter ? false : undefined}
      width={width}
      style={style}
    >
      {children}
    </AntModal>
  );
}
