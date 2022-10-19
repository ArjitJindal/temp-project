import Avatar from '../../../pages/transactions-item/UserDetails/Avatar/index';
import Id from '../Id';
import s from './index.module.less';
import { InternalBusinessUser, InternalConsumerUser, MissingUser } from '@/apis';
import { getUserLink, getUserName } from '@/utils/api/users';

interface Props {
  user: InternalConsumerUser | InternalBusinessUser | MissingUser | undefined;
  children?: React.ReactNode;
}

export default function UserIdNameCard(props: Props) {
  const { user, children } = props;
  return (
    <>
      <div className={s.user}>
        <Avatar name={user ? getUserName(user) : undefined} />
        <div className={s.id}>
          {user && (
            <Id to={getUserLink(user)} alwaysShowCopy>
              {user.userId}
            </Id>
          )}
        </div>
        <div className={s.name}>{user ? getUserName(user) : 'Unknown user'}</div>
      </div>
      {children && <div>{children}</div>}
    </>
  );
}
