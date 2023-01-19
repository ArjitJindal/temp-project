import Id from '../Id';
import s from './index.module.less';
import { InternalBusinessUser, InternalConsumerUser, MissingUser } from '@/apis';
import { getUserLink, getUserName } from '@/utils/api/users';
import UserRiskTag from '@/pages/users/users-list/UserRiskTag';

interface Props {
  user: InternalConsumerUser | InternalBusinessUser | MissingUser | undefined;
  children?: React.ReactNode;
  showRiskLevel?: boolean;
}

export default function UserIdNameCard(props: Props) {
  const { user, children, showRiskLevel = false } = props;
  return (
    <>
      <div className={s.user}>
        <div className={s.name}>
          {user ? getUserName(user) : 'Unknown user'}
          {showRiskLevel && (
            <div className={s.risk}>
              CRA Risk Level : {user?.userId && <UserRiskTag userId={user?.userId} />}
            </div>
          )}
        </div>
        <div className={s.id}>
          {user && (
            <Id to={getUserLink(user)} alwaysShowCopy>
              {user.userId}
            </Id>
          )}
        </div>
      </div>
      {children && <div>{children}</div>}
    </>
  );
}
