import Avatar from '../../../pages/transactions-item/UserDetails/Avatar/index';
import Id from '../Id';
import s from './index.module.less';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { getUserName } from '@/utils/api/users';

interface Props {
  user: InternalConsumerUser | InternalBusinessUser;
  children?: React.ReactNode;
}

export default function UserIdNameCard(props: Props) {
  const { user, children } = props;
  return (
    <>
      <div className={s.user}>
        <Avatar name={user ? getUserName(user) : undefined} />
        <div className={s.id}>{user && <Id>{user.userId}</Id>}</div>
        <div className={s.name}>{user ? getUserName(user) : 'User undefined'}</div>
      </div>
      {children && <div>{children}</div>}
    </>
  );
}
