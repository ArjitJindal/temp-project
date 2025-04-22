import { EllipsisOutlined } from '@ant-design/icons';
import { Dropdown, Menu } from 'antd';
import cn from 'clsx';
import React from 'react';
import s from './style.module.less';
import FileCopyLineIcon from '@/components/ui/icons/Remix/document/file-copy-line.react.svg';
import { RiskFactor } from '@/apis';

interface RuleActionsMenuProps {
  onDuplicate: (entity: RiskFactor) => void;
  canWriteRiskFactors: boolean;
  entity: RiskFactor;
}

const RuleActionsMenu: React.FC<RuleActionsMenuProps> = ({
  onDuplicate,
  canWriteRiskFactors,
  entity,
}) => {
  const menuItems = [
    {
      key: 'duplicate',
      icon: <FileCopyLineIcon className={s.actionsMenuIcon} />,
      content: 'Duplicate',
      onClick: () => onDuplicate(entity),
      disabled: !canWriteRiskFactors,
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
      <EllipsisOutlined data-cy="risk-actions-menu" className={s.actionIcons} />
    </Dropdown>
  );
};

export default RuleActionsMenu;
