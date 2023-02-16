import React, { useState } from 'react';
import cn from 'clsx';
import { Popover } from 'antd';
import s from './style.module.less';
import CloseLineIcon from '@/components/ui/icons/Remix/system/close-line.react.svg';

export interface Props {
  title: string;
  buttonText?: string;
  icon?: React.ReactNode;
  onClear?: () => void;
  children?: React.ReactNode | ((props: { isOpen: boolean }) => React.ReactNode);
}

export default function QuickFilter(props: Props) {
  const { icon, title, buttonText = title, children, onClear } = props;
  const [isOpen, setOpen] = useState(false);
  return (
    <button
      className={cn(s.root, (isOpen || onClear) && s.isActive)}
      onClick={() => {
        setOpen((isOpen) => !isOpen);
      }}
    >
      {icon && <div className={s.icon}>{icon}</div>}
      <div className={s.title}>{buttonText}</div>
      {onClear && (
        <CloseLineIcon
          className={s.clearIcon}
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
        />
      )}
      <Popover
        overlayClassName={s.popoverRoot}
        trigger="click"
        visible={isOpen}
        content={
          <div
            className={s.content}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div className={s.contentTitle}>{title}</div>
            <div className={s.contentBody}>
              {typeof children === 'function' ? children({ isOpen }) : children}
            </div>
          </div>
        }
        onVisibleChange={setOpen}
        arrowPointAtCenter={true}
        autoAdjustOverflow={false}
        placement="bottomLeft"
      >
        <div className={s.popoverAnchor} />
      </Popover>
    </button>
  );
}
