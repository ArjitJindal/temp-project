import React, { useState } from 'react';
import { Popover } from 'antd';
import s from './style.module.less';
import QuickFilterButton from '@/components/library/QuickFilter/QuickFilterButton';

export interface Props {
  title: string;
  description?: React.ReactNode;
  buttonText?: React.ReactNode;
  icon?: React.ReactNode;
  onClear?: () => void;
  onUpdateFilterClose?: (status: boolean) => void;
  children?:
    | React.ReactNode
    | ((props: { isOpen: boolean; setOpen: (isOpen: boolean) => void }) => React.ReactNode);
  analyticsName?: string;
  innerRef?: React.RefObject<any>;
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
  } = props;

  const [isOpen, setOpen] = useState(false);
  const deferredFocus = () => {
    innerRef &&
      setTimeout(() => {
        innerRef?.current?.focus();
      }, 2);
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
        onClear={onClear}
        onClick={() => {
          onUpdateFilterClose && onUpdateFilterClose(isOpen);
          setOpen((isOpen) => !isOpen);
          deferredFocus();
        }}
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
