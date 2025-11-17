import { LoadingOutlined } from '@ant-design/icons';
import s from './index.module.less';
import Avatar from '@/components/library/Avatar';
import Tag from '@/components/library/Tag';
import { AnyAccount } from '@/utils/user-utils';

interface Props {
  userId: string;
  users: { [userId: string]: AnyAccount };
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
    <Tag className={s.root} icon={<Avatar size="xs" user={users[userId]} />}>
      {users[userId]?.name ?? userId}
    </Tag>
  );
};
