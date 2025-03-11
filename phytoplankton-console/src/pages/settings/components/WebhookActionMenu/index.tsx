import React from 'react';
import { EllipsisOutlined } from '@ant-design/icons';
import { Dropdown, Menu } from 'antd';
import cn from 'clsx';
import s from './style.module.less';
import TimerLineIcon from '@/components/ui/icons/Remix/document/timer-line.react.svg';
import { WebhookDeliveryAttempt } from '@/apis';

interface WebhookActionMenuProps {
  setShowDeliveryAttemptsModal: (show: boolean) => void;
  deliveryAttempts: WebhookDeliveryAttempt[];
  setDeliveryAttempts: (attempts: WebhookDeliveryAttempt[]) => void;
}

const WebhookActionMenu: React.FC<WebhookActionMenuProps> = ({
  setShowDeliveryAttemptsModal,
  deliveryAttempts,
  setDeliveryAttempts,
}) => {
  const menuItems = [
    {
      key: 'attempts',
      icon: <TimerLineIcon className={s.actionsMenuIcon} />,
      content: 'Attempts',
      onClick: () => {
        setDeliveryAttempts(deliveryAttempts);
        setShowDeliveryAttemptsModal(true);
      },
      disabled: false,
      testName: 'rule-duplicate-button',
    },
  ];

  const menu = (
    <Menu className={s.actionsMenu}>
      {menuItems.map((item, index) => (
        <Menu.Item
          key={item.key}
          icon={item.icon}
          onClick={item.disabled ? undefined : (item.onClick as any)}
          disabled={item.disabled}
          className={cn(s.actionsMenuItem, index % 2 === 1 ? s.isOdd : '')}
          data-cy={item.testName}
        >
          {item.content}
        </Menu.Item>
      ))}
    </Menu>
  );

  return (
    <Dropdown overlay={menu} trigger={['click']}>
      <EllipsisOutlined data-cy="webhook-actions-menu" className={s.actionIcons} />
    </Dropdown>
  );
};

export default WebhookActionMenu;
