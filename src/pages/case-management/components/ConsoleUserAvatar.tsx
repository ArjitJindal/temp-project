import { Avatar, Space, Tag } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { Account } from '@/apis';

interface Props {
  userId: string;
  users: { [userId: string]: Account };
  loadingUsers: boolean;
}

export const ConsoleUserAvatar: React.FC<Props> = ({ userId, users, loadingUsers }) => {
  return (
    <Tag key={userId}>
      <Space size="small">
        {loadingUsers ? (
          <LoadingOutlined />
        ) : (
          <>
            <Avatar size={15} src={users[userId]?.picture} />
            {users[userId]?.name}
          </>
        )}
      </Space>
    </Tag>
  );
};
