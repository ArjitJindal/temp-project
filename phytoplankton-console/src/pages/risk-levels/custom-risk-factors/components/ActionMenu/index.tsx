import { EllipsisOutlined } from '@ant-design/icons';
import { Dropdown, Menu } from 'antd';
import cn from 'clsx';
import React from 'react';
import { ScopeSelectorValue } from '../..';
import s from './style.module.less';
import { AsyncResource } from '@/utils/asyncResource';
import Confirm from '@/components/utils/Confirm';
import DeleteBin7LineIcon from '@/components/ui/icons/Remix/system/delete-bin-7-line.react.svg';
import FileCopyLineIcon from '@/components/ui/icons/Remix/document/file-copy-line.react.svg';
import { RiskFactor } from '@/apis';

interface RuleActionsMenuProps {
  onDuplicate: (entity: RiskFactor, selectedSection: ScopeSelectorValue) => void;
  onDelete: (ruleId: string | undefined) => void;
  deleting: boolean;
  canWriteRiskFactors: boolean;
  res: AsyncResource<any>;
  entity: RiskFactor;
  selectedSection: ScopeSelectorValue;
}

const RuleActionsMenu: React.FC<RuleActionsMenuProps> = ({
  onDuplicate,
  onDelete,
  deleting,
  canWriteRiskFactors,
  res,
  entity,
  selectedSection,
}) => {
  const menuItems = [
    {
      key: 'duplicate',
      icon: <FileCopyLineIcon className={s.actionsMenuIcon} />,
      content: 'Duplicate',
      onClick: () => onDuplicate(entity, selectedSection),
      disabled: !canWriteRiskFactors,
      testName: 'rule-duplicate-button',
    },
    {
      key: 'delete',
      icon: <DeleteBin7LineIcon className={cn(s.actionsMenuIcon, s.deleteButton)} />,
      content: (
        <Confirm
          title={`Are you sure you want to delete this ${entity.id} ${entity.name} risk factor?`}
          text="Please confirm that you want to delete this risk factor. This action cannot be undone."
          onConfirm={() => onDelete(entity.id)}
          res={res}
        >
          {({ onClick }) => (
            <span
              className={s.deleteButton}
              onClick={!canWriteRiskFactors || deleting ? undefined : onClick}
            >
              Delete
            </span>
          )}
        </Confirm>
      ),
      disabled: !canWriteRiskFactors || deleting,
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
      <EllipsisOutlined data-cy="risk-actions-menu" className={s.actionIcons} />
    </Dropdown>
  );
};

export default RuleActionsMenu;
