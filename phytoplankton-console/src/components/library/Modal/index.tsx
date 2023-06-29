import React, { useState } from 'react';
import { Modal as AntModal, Typography } from 'antd';
import cn from 'clsx';
import s from './style.module.less';
import CloseCircleLineIcon from '@/components/ui/icons/Remix/system/close-fill.react.svg';
import Button, { Props as ButtonProps } from '@/components/library/Button';
import Tabs, { TabItem } from '@/components/library/Tabs';

export const MODAL_WIDTHS = ['S', 'M', 'L'] as const;
export type ModalWidth = typeof MODAL_WIDTHS[number];

interface Props {
  title: string;
  icon?: React.ReactNode;
  hideFooter?: boolean;
  isOpen: boolean;
  onOk?: () => void;
  onCancel: () => void;
  okText?: string;
  okProps?: ButtonProps;
  cancelText?: string;
  cancelProps?: ButtonProps;
  width?: ModalWidth;
  tabs?: TabItem[];
  children?: React.ReactNode;
}

const WIDTH: { [K in ModalWidth]: number } = {
  S: 500,
  M: 650,
  L: 1000,
};

export default function Modal(props: Props) {
  const {
    icon,
    title,
    isOpen,
    onOk,
    okText,
    okProps,
    cancelText,
    cancelProps,
    onCancel,
    children,
    hideFooter = false,
    width = 'M',
    tabs = [],
  } = props;

  const [activeTab, setActiveTab] = useState<string>(tabs[0]?.key);

  const withTabs = tabs.length > 1;
  return (
    <AntModal
      className={cn(s.root, withTabs && s.withTabs)}
      title={
        <div className={s.header}>
          <div className={s.mainHeader}>
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
          {withTabs && (
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={tabs.map((tab) => ({ ...tab, children: undefined }))}
            />
          )}
        </div>
      }
      visible={isOpen}
      onCancel={onCancel}
      closable={false}
      footer={
        hideFooter ? (
          false
        ) : (
          <>
            <Button type="TETRIARY" htmlType="button" onClick={onCancel} {...cancelProps}>
              {cancelText ?? 'Cancel'}
            </Button>
            <Button type="PRIMARY" htmlType="button" onClick={onOk} {...okProps}>
              {okText ?? 'OK'}
            </Button>
          </>
        )
      }
      width={WIDTH[width]}
      centered
    >
      {tabs.find(({ key }) => key === activeTab)?.children}
      {children}
    </AntModal>
  );
}
