import React from 'react';
import BusinessUserDetails from './BusinessUserDetails';
import ConsumerUserDetails from './ConsumerUserDetails';
import { InternalBusinessUser, InternalConsumerUser, MissingUser } from '@/apis';
import { Small } from '@/components/ui/Typography';
import UserTransactionHistoryTable from '@/pages/users-item/UserDetails/UserTransactionHistoryTable';
import InsightsCard from '@/pages/case-management-item/UserCaseDetails/InsightsCard';

interface Props {
  user?: InternalConsumerUser | InternalBusinessUser | MissingUser;
  isEmbedded?: boolean;
  collapsedByDefault?: boolean;
  hideHistory?: boolean;
}

export default function UserDetails(props: Props) {
  const { user, isEmbedded, collapsedByDefault, hideHistory = false } = props;
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
      {!hideHistory && (
        <UserTransactionHistoryTable userId={user.userId} collapsedByDefault={false} />
      )}
      <InsightsCard userId={user.userId} />
    </>
  );
}
