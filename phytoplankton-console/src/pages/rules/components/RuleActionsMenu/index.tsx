import React from 'react';
import { Dropdown, Menu } from 'antd';
import cn from 'clsx';
import { EllipsisOutlined } from '@ant-design/icons';
import s from './style.module.less'; // Add your CSS file containing the 'isOdd' class
import Confirm from '@/components/utils/Confirm';
import { RuleInstance } from '@/apis';
import DeleteBin7LineIcon from '@/components/ui/icons/Remix/system/delete-bin-7-line.react.svg';
import FileCopyLineIcon from '@/components/ui/icons/Remix/document/file-copy-line.react.svg';
import { AsyncResource } from '@/utils/asyncResource';

interface RuleActionsMenuProps {
  ruleInstance: RuleInstance;
  onDuplicate: (rule: RuleInstance) => void;
  onDelete: (ruleId: string | undefined) => void;
  deleting: boolean;
  canWriteRules: boolean;
  res: AsyncResource<any>;
}

const RuleActionsMenu: React.FC<RuleActionsMenuProps> = ({
  ruleInstance,
  onDuplicate,
  onDelete,
  deleting,
  canWriteRules,
  res,
}) => {
  const menuItems = [
    {
      key: 'duplicate',
      icon: <FileCopyLineIcon className={s.actionsMenuIcon} />,
      content: 'Duplicate',
      onClick: () => onDuplicate(ruleInstance),
      disabled: !canWriteRules || deleting,
      testName: 'rule-duplicate-button',
    },
    {
      key: 'delete',
      icon: <DeleteBin7LineIcon className={cn(s.actionsMenuIcon, s.deleteButton)} />,
      content: (
        <Confirm
          title={`Are you sure you want to delete this ${ruleInstance.ruleId} ${ruleInstance.id} rule?`}
          text="Please confirm that you want to delete this rule. This action cannot be undone."
          onConfirm={() => onDelete(ruleInstance.id)}
          res={res}
        >
          {({ onClick }) => (
            <span
              className={s.deleteButton}
              onClick={!canWriteRules || deleting ? undefined : onClick}
            >
              Delete
            </span>
          )}
        </Confirm>
      ),
      disabled: !canWriteRules || deleting,
      testName: 'rule-delete-button',
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
      <EllipsisOutlined data-cy="rule-actions-menu" className={s.actionIcons} />
    </Dropdown>
  );
};

export default RuleActionsMenu;
