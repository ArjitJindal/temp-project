import React from 'react';
import { Avatar, Select, Space, Tag } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
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
            ''
          )
        }
        onChange={onChange}
        value={loadingUsers ? [] : assignments.map((assignment) => assignment.assigneeUserId)}
      >
        {Object.values(users).map((user) => (
          <Select.Option key={user.id}>
            <Space size="small">
              <Avatar size={15} src={user.picture} />
              <span>{user.name}</span>
            </Space>
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
