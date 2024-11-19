import React, { useState } from 'react';
import { Modal as AntModal, Typography } from 'antd';
import cn from 'clsx';
import s from './style.module.less';
import CloseCircleLineIcon from '@/components/ui/icons/Remix/system/close-fill.react.svg';
import Button, { ButtonProps } from '@/components/library/Button';
import Tabs, { TabItem } from '@/components/library/Tabs';
import { Permission } from '@/apis';
import { P } from '@/components/ui/Typography';

export const MODAL_WIDTHS = ['S', 'M', 'L', 'XL'] as const;
export type ModalWidth = typeof MODAL_WIDTHS[number];
export type ModalHeight = 'AUTO' | 'FULL';

interface Props {
  title?: React.ReactNode;
  subTitle?: React.ReactNode;
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
  hideOk?: boolean;
  maskClosable?: boolean;
  footerExtra?: React.ReactNode;
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
    subTitle,
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
    hideOk = false,
    maskClosable = true,
    footerExtra,
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
                <Typography.Title data-cy="modal-title" level={3} className={s.title}>
                  {title}
                </Typography.Title>
              </div>
              <button className={s.close} onClick={onCancel} data-cy="modal-close">
                <CloseCircleLineIcon />
              </button>
            </div>
            {subTitle && (
              <P grey variant="m" fontWeight="normal">
                {subTitle}{' '}
              </P>
            )}
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
          <div className={s.footer}>
            {footerExtra && <div className={s.footerSection}>{footerExtra}</div>}
            <div className={s.footerSection}>
              <Button type="TETRIARY" htmlType="button" onClick={onCancel} {...cancelProps}>
                {cancelText ?? 'Cancel'}
              </Button>
              {!hideOk && (
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
              )}
            </div>
          </div>
        )
      }
      width={WIDTH[width]}
      centered
      maskClosable={maskClosable}
    >
      {tabs.find(({ key }) => key === activeTab)?.children}
      {children}
    </AntModal>
  );
}
