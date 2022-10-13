import React from 'react';
import { Avatar, Select, Space, Tag } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { colorSchema } from './utils';
import s from './index.module.less';
import { useUsers } from '@/utils/user-utils';
import { Assignment } from '@/apis';

interface Props {
  editing: boolean;
  assignments: Array<Assignment>;
  onChange: (assignees: string[]) => void;
}

export const AssigneesDropdown: React.FC<Props> = ({ assignments, editing, onChange }) => {
  const [users, loadingUsers] = useUsers();
  return editing ? (
    <>
      <Select<string[]>
        className={s.select}
        mode="multiple"
        allowClear
        style={{ width: '100%' }}
        disabled={loadingUsers}
        placeholder={
          loadingUsers ? (
            <>
              <LoadingOutlined /> Loading...
            </>
          ) : (
            'Unassigned'
          )
        }
        onChange={onChange}
        value={loadingUsers ? [] : assignments.map((assignment) => assignment.assigneeUserId)}
      >
        {Object.values(users).map((user, index) => (
          <Select.Option key={user.id}>
            <div className={s.item}>
              <Avatar
                size="small"
                className={s.avatar}
                style={{
                  color: colorSchema[index % 4].text,
                  backgroundColor: colorSchema[index % 4].background,
                }}
              >
                {' '}
                {user.email.toUpperCase().charAt(0)}
              </Avatar>
              <span>{user.name}</span>
            </div>
          </Select.Option>
        ))}
      </Select>
    </>
  ) : (
    <>
      {assignments?.map((assignment) => (
        <Tag key={assignment.assigneeUserId}>
          <Space size="small">
            {loadingUsers ? (
              <LoadingOutlined />
            ) : (
              <>
                <Avatar size={15} src={users[assignment.assigneeUserId]?.picture} />
                {users[assignment.assigneeUserId]?.name}
              </>
            )}
          </Space>
        </Tag>
      ))}
    </>
  );
};
