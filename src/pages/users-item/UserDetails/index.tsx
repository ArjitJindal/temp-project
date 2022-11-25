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
  hideInsights?: boolean;
  updateCollapseState?: (key: string, value: boolean) => void;
}

function UserDetails(props: Props, ref: React.Ref<ExpandTabRef>) {
  const { user, isEmbedded, hideHistory = false, hideInsights = false } = props;

  const userDetailsRef = React.useRef<ExpandTabRef>(null);
  const expectedTransactionsRef = React.useRef<ExpandTabRef>(null);
  const shareHoldersRef = React.useRef<ExpandTabRef>(null);
  const dierctorsRef = React.useRef<ExpandTabRef>(null);
  const documentsRef = React.useRef<ExpandTabRef>(null);
  const legalDocumentsRef = React.useRef<ExpandTabRef>(null);
  const userTransactionHistoryRef = React.useRef<ExpandTabRef>(null);
  const insightsRef = React.useRef<ExpandTabRef>(null);

  useImperativeHandle(ref, () => ({
    expand: (shouldExpand) => {
      userDetailsRef.current?.expand(shouldExpand);
      expectedTransactionsRef.current?.expand(shouldExpand);
      shareHoldersRef.current?.expand(shouldExpand);
      dierctorsRef.current?.expand(shouldExpand);
      documentsRef.current?.expand(shouldExpand);
      legalDocumentsRef.current?.expand(shouldExpand);
      userTransactionHistoryRef.current?.expand(shouldExpand);
      insightsRef.current?.expand(shouldExpand);
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
          updateCollapseState={props.updateCollapseState}
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
          updateCollapseState={props.updateCollapseState}
        />
      )}
      {!hideHistory && (
        <UserTransactionHistoryTable
          userId={user.userId}
          collapsedByDefault={true}
          userTransactionHistoryRef={userTransactionHistoryRef}
          updateCollapseState={props.updateCollapseState}
        />
      )}
      {!hideInsights && (
        <InsightsCard
          userId={user.userId}
          reference={insightsRef}
          updateCollapseState={props.updateCollapseState}
        />
      )}
    </>
  );
}

export default React.forwardRef(UserDetails);
