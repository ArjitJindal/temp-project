import React, { useState } from 'react';
import _ from 'lodash';
import { Modal as AntModal, Typography } from 'antd';
import cn from 'clsx';
import s from './style.module.less';
import CloseCircleLineIcon from '@/components/ui/icons/Remix/system/close-fill.react.svg';
import Button, { ButtonProps } from '@/components/library/Button';
import Tabs, { TabItem } from '@/components/library/Tabs';
import { Permission } from '@/apis';

export const MODAL_WIDTHS = ['S', 'M', 'L', 'XL'] as const;
export type ModalWidth = typeof MODAL_WIDTHS[number];
export type ModalHeight = 'AUTO' | 'FULL';

interface Props {
  title?: string;
  icon?: React.ReactNode;
  hideFooter?: boolean;
  hideHeader?: boolean;
  isOpen: boolean;
  onOk?: () => void;
  onCancel: () => void;
  okText?: string | React.ReactNode;
  okProps?: ButtonProps;
  cancelText?: string;
  cancelProps?: ButtonProps;
  width?: ModalWidth;
  height?: ModalHeight;
  tabs?: TabItem[];
  children?: React.ReactNode;
  disablePadding?: boolean;
  writePermissions?: Permission[];
}

const WIDTH: { [K in ModalWidth]: number | string } = {
  S: 500,
  M: 650,
  L: 1000,
  XL: '100vw',
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
    hideHeader = false,
    width = 'M',
    height = 'AUTO',
    tabs = [],
    disablePadding = false,
    writePermissions = [],
  } = props;

  const [activeTab, setActiveTab] = useState<string>(tabs[0]?.key);

  const withTabs = tabs.length > 1;
  return (
    <AntModal
      className={cn(
        s.root,
        withTabs && s.withTabs,
        disablePadding && s.disablePadding,
        s[`height-${height}`],
      )}
      title={
        !hideHeader ? (
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
                type="card"
                activeKey={activeTab}
                onChange={(key) => setActiveTab(key)}
                items={tabs.map((tab) => ({ ...tab, children: undefined }))}
              />
            )}
          </div>
        ) : null
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
            <Button
              type="PRIMARY"
              htmlType="button"
              onClick={onOk}
              {...okProps}
              testName={`modal-ok`}
              requiredPermissions={writePermissions}
            >
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
