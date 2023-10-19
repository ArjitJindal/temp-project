import React, { useState } from 'react';
import { Popover } from 'antd';
import s from './style.module.less';
import QuickFilterButton from '@/components/library/QuickFilter/QuickFilterButton';

export interface Props {
  title: React.ReactNode;
  description?: React.ReactNode;
  buttonText?: React.ReactNode;
  icon?: React.ReactNode;
  onClear?: () => void;
  children?:
    | React.ReactNode
    | ((props: { isOpen: boolean; setOpen: (isOpen: boolean) => void }) => React.ReactNode);
  analyticsName?: string;
}

export default function QuickFilterBase(props: Props) {
  const { icon, title, description, buttonText, analyticsName, children, onClear } = props;
  const [isOpen, setOpen] = useState(false);
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
          setOpen((isOpen) => !isOpen);
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
          onVisibleChange={setOpen}
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
