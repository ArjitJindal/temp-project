import BusinessUserDetails from './BusinessUserDetails';
import ConsumerUserDetails from './ConsumerUserDetails';
import { getBusinessUserColumns } from '@/pages/users/users-list/business-user-columns';
import { getConsumerUserColumns } from '@/pages/users/users-list/consumer-users-columns';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';

interface Props {
  user?: InternalConsumerUser | InternalBusinessUser;
  isEmbedded?: boolean;
}

export default function UserDetails({ user, isEmbedded }: Props) {
  return (
    <>
      {user?.type === 'BUSINESS' && user?.legalEntity && (
        <BusinessUserDetails
          user={user}
          columns={getBusinessUserColumns()}
          isEmbedded={isEmbedded}
        />
      )}
      {user?.type === 'CONSUMER' && (
        <ConsumerUserDetails
          user={user}
          columns={getConsumerUserColumns()}
          isEmbedded={isEmbedded}
        />
      )}
    </>
  );
}
