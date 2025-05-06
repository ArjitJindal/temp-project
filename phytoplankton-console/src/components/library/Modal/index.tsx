import React, { useState } from 'react';
import { Modal as AntModal, Typography } from 'antd';
import cn from 'clsx';
import { useLocalStorageState } from 'ahooks';
import s from './style.module.less';
import CloseCircleLineIcon from '@/components/ui/icons/Remix/system/close-fill.react.svg';
import ExpandAltOutlined from '@/components/ui/icons/expand-diagonal-s-line.react.svg';
import CollapseAltOutlined from '@/components/ui/icons/collapse-diagonal-line.react.svg';
import Button, { ButtonProps } from '@/components/library/Button';
import Tabs, { TabItem } from '@/components/library/Tabs';
import { Permission } from '@/apis';
import { P } from '@/components/ui/Typography';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';

export const MODAL_WIDTHS = ['S', 'M', 'L', 'XL'] as const;
export type ModalWidth = typeof MODAL_WIDTHS[number];
export type ModalHeight = 'AUTO' | 'FULL';

interface Props {
  id?: string;
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
  isResizable?: boolean;
  destroyOnClose?: boolean;
}

const WIDTH: { [K in ModalWidth]: number | string } = {
  S: 500,
  M: 650,
  L: 1000,
  XL: '100vw',
};

export default function Modal(props: Props) {
  const {
    id,
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
    isResizable = false,
    destroyOnClose = false,
  } = props;

  const [activeTab, setActiveTab] = useState<string>(tabs[0]?.key);
  const [size, setSize] = useLocalStorageState<ModalWidth | undefined>(id ?? 'UNKNOWN_MODAL');

  const derivedResizable: boolean = isResizable && id != null;
  const derivedSize: ModalWidth = derivedResizable && size != null ? size : width;
  const derivedHeight: ModalHeight = derivedSize === 'XL' ? 'FULL' : height;

  const withTabs = tabs.length > 1;
  return (
    <AntModal
      destroyOnClose={destroyOnClose}
      className={cn(
        s.root,
        withTabs && s.withTabs,
        disablePadding && s.disablePadding,
        s[`height-${derivedHeight}`],
      )}
      title={
        !hideHeader ? (
          <div className={s.header}>
            <div className={s.mainHeader}>
              <div className={s.headerSection}>
                {icon && <div className={s.icon}>{icon}</div>}
                <Typography.Title data-cy="modal-title" level={3} className={s.title}>
                  {title}
                </Typography.Title>
              </div>
              <div className={s.headerSection}>
                <Feature name="NEW_FEATURES">
                  {derivedResizable && (
                    <button
                      className={s.close}
                      onClick={() => setSize(derivedSize === 'XL' ? 'M' : 'XL')}
                      data-cy="modal-close"
                    >
                      {derivedSize === 'XL' ? <CollapseAltOutlined /> : <ExpandAltOutlined />}
                    </button>
                  )}
                </Feature>
                <button className={s.close} onClick={onCancel} data-cy="modal-close">
                  <CloseCircleLineIcon />
                </button>
              </div>
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
              {!hideOk && (
                <Button
                  type={okProps?.type ?? 'PRIMARY'}
                  htmlType="button"
                  onClick={onOk}
                  {...okProps}
                  testName={`modal-ok`}
                  requiredPermissions={writePermissions}
                >
                  {okText ?? 'OK'}
                </Button>
              )}
              <Button type="TETRIARY" htmlType="button" onClick={onCancel} {...cancelProps}>
                {cancelText ?? 'Cancel'}
              </Button>
            </div>
          </div>
        )
      }
      width={WIDTH[derivedSize]}
      centered
      maskClosable={maskClosable}
    >
      {tabs.find(({ key }) => key === activeTab)?.children}
      {children}
    </AntModal>
  );
}
