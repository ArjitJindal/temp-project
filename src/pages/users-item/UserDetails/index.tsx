import BusinessUserDetails from './BusinessUserDetails';
import ConsumerUserDetails from './ConsumerUserDetails';
import { InternalBusinessUser, InternalConsumerUser, MissingUser } from '@/apis';
import { Small } from '@/components/ui/Typography';

interface Props {
  user?: InternalConsumerUser | InternalBusinessUser | MissingUser;
  isEmbedded?: boolean;
  collapsedByDefault?: boolean;
}

export default function UserDetails({ user, isEmbedded, collapsedByDefault }: Props) {
  if (user == null || !('type' in user)) {
    return <Small>No user details found</Small>;
  }
  return (
    <>
      {user?.type === 'BUSINESS' && (
        <BusinessUserDetails
          user={user}
          isEmbedded={isEmbedded}
          collapsedByDefault={collapsedByDefault}
        />
      )}
      {user?.type === 'CONSUMER' && (
        <ConsumerUserDetails
          user={user}
          isEmbedded={isEmbedded}
          collapsedByDefault={collapsedByDefault}
        />
      )}
    </>
  );
}
