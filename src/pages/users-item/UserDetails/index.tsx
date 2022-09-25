import BusinessUserDetails from './BusinessUserDetails';
import ConsumerUserDetails from './ConsumerUserDetails';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
interface Props {
  user?: InternalConsumerUser | InternalBusinessUser;
  isEmbedded?: boolean;
}

export default function UserDetails({ user, isEmbedded }: Props) {
  return (
    <>
      {user?.type === 'BUSINESS' && <BusinessUserDetails user={user} isEmbedded={isEmbedded} />}
      {user?.type === 'CONSUMER' && <ConsumerUserDetails user={user} isEmbedded={isEmbedded} />}
    </>
  );
}
