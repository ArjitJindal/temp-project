import { UI_SETTINGS } from '../ui-settings';
import BusinessUserDetails from './BusinessUserDetails';
import ConsumerUserDetails from './ConsumerUserDetails';
import s from './index.module.less';
import { Authorized } from '@/components/utils/Authorized';
import { InternalBusinessUser, InternalConsumerUser, MissingUser } from '@/apis';
import { Small } from '@/components/ui/Typography';

interface Props {
  user?: InternalConsumerUser | InternalBusinessUser | MissingUser;
  uiSettings: typeof UI_SETTINGS;
}

function UserDetails(props: Props) {
  const { user, uiSettings } = props;

  if (user == null || !('type' in user)) {
    return <Small>No user details found</Small>;
  }

  return (
    <div className={s.root}>
      <Authorized required={['users:user-details:read']}>
        <>
          {user?.type === 'BUSINESS' && (
            <BusinessUserDetails
              user={user}
              uiSettings={uiSettings}
              hideExpectedTransactionLimits={true}
            />
          )}
          {user?.type === 'CONSUMER' && <ConsumerUserDetails user={user} uiSettings={uiSettings} />}
        </>
      </Authorized>
    </div>
  );
}

export default UserDetails;
