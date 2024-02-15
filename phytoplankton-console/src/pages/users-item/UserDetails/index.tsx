import { UI_SETTINGS } from '../ui-settings';
import BusinessUserDetails from './BusinessUserDetails';
import ConsumerUserDetails from './ConsumerUserDetails';
import DeviceDataCard from './DeviceDataCard';
import s from './index.module.less';
import { InternalBusinessUser, InternalConsumerUser, MissingUser } from '@/apis';
import { Small } from '@/components/ui/Typography';
import { Authorized } from '@/components/Authorized';
import { useApi } from '@/api';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useQuery } from '@/utils/queries/hooks';
import { DEVICE_DATA_USER } from '@/utils/queries/keys';

interface Props {
  user?: InternalConsumerUser | InternalBusinessUser | MissingUser;
  uiSettings: typeof UI_SETTINGS;
}

function UserDetails(props: Props) {
  const { user, uiSettings } = props;

  const api = useApi();

  const deviceDataRes = useQuery(DEVICE_DATA_USER(user?.userId), async () => {
    if (user?.userId) {
      return await api.getDeviceDataUsers({
        userId: user.userId,
      });
    }
    return null;
  });

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
          <AsyncResourceRenderer resource={deviceDataRes.data}>
            {(deviceData) =>
              deviceData ? (
                <DeviceDataCard
                  title={uiSettings.cards.DEVICE_DATA.title}
                  deviceData={deviceData}
                />
              ) : null
            }
          </AsyncResourceRenderer>
        </>
      </Authorized>
    </div>
  );
}

export default UserDetails;
