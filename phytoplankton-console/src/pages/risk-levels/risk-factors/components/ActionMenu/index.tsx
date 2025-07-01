import { EllipsisOutlined } from '@ant-design/icons';
import React from 'react';
import s from './style.module.less';
import FileCopyLineIcon from '@/components/ui/icons/Remix/document/file-copy-line.react.svg';
import { RiskFactor } from '@/apis';
import Dropdown from '@/components/library/Dropdown';

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
  const menuOptions = [
    {
      value: 'duplicate',
      label: (
        <div className={s.actionsMenuItem}>
          <FileCopyLineIcon className={s.actionsMenuIcon} />
          Duplicate
        </div>
      ),
      isDisabled: !canWriteRiskFactors,
    },
  ];

  return (
    <Dropdown
      options={menuOptions}
      onSelect={(option) => {
        if (option.value === 'duplicate') {
          onDuplicate(entity);
        }
      }}
    >
      <EllipsisOutlined data-cy="risk-actions-menu" className={s.actionIcons} />
    </Dropdown>
  );
};

export default RuleActionsMenu;
