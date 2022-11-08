import React, { useImperativeHandle } from 'react';
import BusinessUserDetails from './BusinessUserDetails';
import ConsumerUserDetails from './ConsumerUserDetails';
import { InternalBusinessUser, InternalConsumerUser, MissingUser } from '@/apis';
import { Small } from '@/components/ui/Typography';
import UserTransactionHistoryTable from '@/pages/users-item/UserDetails/UserTransactionHistoryTable';
import { ExpandTabRef } from '@/pages/case-management-item/UserCaseDetails';
import InsightsCard from '@/pages/case-management-item/UserCaseDetails/InsightsCard';

interface Props {
  user?: InternalConsumerUser | InternalBusinessUser | MissingUser;
  isEmbedded?: boolean;
  collapsedByDefault?: boolean;
  hideHistory?: boolean;
}

function UserDetails(props: Props, ref: React.Ref<ExpandTabRef>) {
  const { user, isEmbedded, hideHistory = false } = props;

  const userDetailsRef = React.useRef<ExpandTabRef>(null);
  const expectedTransactionsRef = React.useRef<ExpandTabRef>(null);
  const shareHoldersRef = React.useRef<ExpandTabRef>(null);
  const dierctorsRef = React.useRef<ExpandTabRef>(null);
  const documentsRef = React.useRef<ExpandTabRef>(null);
  const legalDocumentsRef = React.useRef<ExpandTabRef>(null);
  const userTransactionHistoryRef = React.useRef<ExpandTabRef>(null);

  useImperativeHandle(ref, () => ({
    expand: () => {
      userDetailsRef.current?.expand();
      expectedTransactionsRef.current?.expand();
      shareHoldersRef.current?.expand();
      dierctorsRef.current?.expand();
      documentsRef.current?.expand();
      legalDocumentsRef.current?.expand();
      userTransactionHistoryRef.current?.expand();
    },
  }));

  if (user == null || !('type' in user)) {
    return <Small>No user details found</Small>;
  }
  return (
    <>
      {user?.type === 'BUSINESS' && (
        <BusinessUserDetails
          user={user}
          isEmbedded={isEmbedded}
          collapsedByDefault={true}
          userDetailsRef={userDetailsRef}
          expectedTransactionsRef={expectedTransactionsRef}
          shareHoldersRef={shareHoldersRef}
          dierctorsRef={dierctorsRef}
          documentsRef={documentsRef}
        />
      )}
      {user?.type === 'CONSUMER' && (
        <ConsumerUserDetails
          user={user}
          isEmbedded={isEmbedded}
          collapsedByDefault={true}
          userDetailsRef={userDetailsRef}
          legalDocumentsRef={legalDocumentsRef}
          documentsRef={documentsRef}
        />
      )}
      {!hideHistory && (
        <UserTransactionHistoryTable
          userId={user.userId}
          collapsedByDefault={true}
          userTransactionHistoryRef={userTransactionHistoryRef}
        />
      )}
      <InsightsCard userId={user.userId} />
    </>
  );
}

export default React.forwardRef(UserDetails);
