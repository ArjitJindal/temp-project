import React, { useState } from 'react';
import { Popover } from 'antd';
import s from './style.module.less';
import QuickFilterButton from '@/components/library/QuickFilter/QuickFilterButton';

export type ChildrenProps = {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
};

export interface Props {
  title: string;
  description?: React.ReactNode;
  buttonText?: React.ReactNode;
  icon?: React.ReactNode;
  onClear?: () => void;
  onUpdateFilterClose?: (status: boolean) => void;
  children?: React.ReactNode | ((props: ChildrenProps) => React.ReactNode);
  analyticsName?: string;
  innerRef?: React.RefObject<any>;
  allowClear?: boolean;
  clearNotAllowedReason?: string;
  readOnly?: boolean;
  autoWidth?: boolean;
}

export default function QuickFilterBase(props: Props) {
  const {
    icon,
    title,
    description,
    buttonText,
    analyticsName,
    children,
    onUpdateFilterClose,
    onClear,
    innerRef,
    allowClear = true,
    readOnly = false,
    autoWidth = false,
  } = props;

  const [isOpen, setOpen] = useState(false);
  const deferredFocus = () => {
    if (innerRef) {
      const scrollY = window.scrollY; //current scroll position

      setTimeout(() => {
        innerRef.current?.focus();
        window.scrollTo(0, scrollY);
      }, 2);
    }
  };
  return (
    <>
      <QuickFilterButton
        isActive={isOpen || onClear != null}
        buttonText={
          <>
            {title}
            {buttonText == null ? null : (
              <>
                {': '}
                {buttonText}
              </>
            )}
          </>
        }
        icon={icon}
        analyticsName={analyticsName}
        autoWidth={autoWidth}
        onClear={!readOnly && allowClear ? onClear : undefined}
        onClick={
          !readOnly
            ? () => {
                onUpdateFilterClose && onUpdateFilterClose(isOpen);
                setOpen((isOpen) => !isOpen);
                deferredFocus();
              }
            : undefined
        }
      >
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
              {description && <div className={s.contentDescription}>{description}</div>}
              <div className={s.contentBody}>
                {typeof children === 'function' ? children({ isOpen, setOpen }) : children}
              </div>
            </div>
          }
          onVisibleChange={(isVisible) => {
            setOpen(isVisible);
            onUpdateFilterClose && onUpdateFilterClose(!isVisible);
          }}
          arrowPointAtCenter={true}
          autoAdjustOverflow={true}
          placement="bottomLeft"
        >
          <div className={s.popoverAnchor} />
        </Popover>
      </QuickFilterButton>
    </>
  );
}
