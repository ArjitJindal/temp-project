import { Dropdown as AntDropdown, Menu as AntMenu } from 'antd';
import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import Button from '@/components/library/Button';
import { Account } from '@/apis';
import { useUsers } from '@/utils/user-utils';

interface Props {
  ids: string[];
  onSelect: (account: Account, ids: string[]) => void;
}

export default function AssignToButton(props: Props) {
  const { onSelect } = props;
  const [users] = useUsers();
  if (props.ids.length === 0) {
    return <></>;
  }
  const menu = (
    <AntMenu>
      {Object.values(users).map((account) => (
        <AntMenu.Item
          key={account.id}
          onClick={() => {
            onSelect(account, props.ids);
          }}
        >
          <div className={cn(s.item)}>
            <img className={s.userPicture} src={account.picture} alt="User picture" />
            {account.name}
          </div>
        </AntMenu.Item>
      ))}
    </AntMenu>
  );

  return (
    <AntDropdown overlay={menu} trigger={['click']}>
      <Button type="TETRIARY" onClick={() => {}} testName="update-assignment-button">
        Assign to
      </Button>
    </AntDropdown>
  );
}
