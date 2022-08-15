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

const colorSchema = [
  { text: '#FF4D4F', background: '#FFE5E6' },
  { text: '#1AB0A1', background: '#EBFCFB' },
  { text: '#063075', background: '#EBF2FF' },
  { text: '#7284A3', background: '#DFE6F2' },
];

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
            'Unassigned'
          )
        }
        onChange={onChange}
        value={loadingUsers ? [] : assignments.map((assignment) => assignment.assigneeUserId)}
      >
        {Object.values(users).map((user, index) => (
          <Select.Option key={user.id}>
            <Space size="small">
              <Avatar
                size="default"
                style={{
                  color: colorSchema[index % 4].text,
                  backgroundColor: colorSchema[index % 4].background,
                }}
              >
                {' '}
                {user.email.toUpperCase().charAt(0)}
              </Avatar>
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
