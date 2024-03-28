import { Avatar } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import s from './index.module.less';
import { Account } from '@/apis';
import Tag from '@/components/library/Tag';

interface Props {
  userId: string;
  users: { [userId: string]: Account };
  loadingUsers: boolean;
}

export const ConsoleUserAvatar: React.FC<Props> = ({ userId, users, loadingUsers }) => {
  if (loadingUsers) {
    return (
      <Tag className={s.root}>
        <LoadingOutlined />
      </Tag>
    );
  }
  return (
    <Tag className={s.root} icon={<Avatar size={15} src={users[userId]?.picture} />}>
      {users[userId]?.name ?? userId}
    </Tag>
  );
};
