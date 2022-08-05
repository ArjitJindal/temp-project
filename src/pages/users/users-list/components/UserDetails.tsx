import { getBusinessUserColumns } from '../business-user-columns';
import { getConsumerUserColumns } from '../consumer-users-columns';
import { BusinessUserDetails } from './BusinessUserDetails';
import { ConsumerUserDetails } from './ConsumerUserDetails';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';

interface Props {
  user?: InternalConsumerUser | InternalBusinessUser;
}

export const UserDetails: React.FC<Props> = ({ user }) => {
  return (
    <>
      {user?.type === 'BUSINESS' && user?.legalEntity && (
        <BusinessUserDetails user={user} columns={getBusinessUserColumns()} />
      )}
      {user?.type === 'CONSUMER' && (
        <ConsumerUserDetails user={user} columns={getConsumerUserColumns()} />
      )}
    </>
  );
};
