import { Dropdown as AntDropdown, Menu as AntMenu } from 'antd';
import cn from 'clsx';
import s from './index.module.less';
import Tooltip from '@/components/library/Tooltip';
import Button from '@/components/library/Button';
import { Account } from '@/apis';
import { useSortedUsers } from '@/utils/user-utils';

interface Props {
  onSelect: (account: Account) => void;
  isDisabled?: boolean;
  userFilter?: (account: Account) => boolean;
  tooltip?: string;
}

export default function AssignToButton(props: Props) {
  const { onSelect, userFilter, tooltip } = props;
  const [sortedUsers] = useSortedUsers();
  const filteredUsers = userFilter ? sortedUsers.filter(userFilter) : sortedUsers;

  const menu = (
    <AntMenu className={s.assigneeMenu}>
      {filteredUsers.map((account) => (
        <AntMenu.Item
          key={account.id}
          onClick={() => {
            onSelect(account);
          }}
        >
          <div className={cn(s.item)} data-cy="assignment-option">
            <img className={s.userPicture} src={account.picture} alt="User picture" />
            {account.name}
          </div>
        </AntMenu.Item>
      ))}
    </AntMenu>
  );

  return (
    <Tooltip title={tooltip}>
      <AntDropdown overlay={menu} trigger={['click']}>
        <Button
          type="TETRIARY"
          onClick={() => {}}
          testName="update-assignment-button"
          requiredPermissions={['case-management:case-overview:write']}
          isDisabled={props.isDisabled}
        >
          Assign to
        </Button>
      </AntDropdown>
    </Tooltip>
  );
}
