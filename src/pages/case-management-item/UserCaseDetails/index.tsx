import React, { forwardRef, Ref, useImperativeHandle, useRef } from 'react';
import CommentsCard from '../components/CommentsCard';
import RulesHitCard from './RulesHitCard';
import InsightsCard from './InsightsCard';
import { Case } from '@/apis';
import UserDetails from '@/pages/users-item/UserDetails';
import UserIdNameCard from '@/components/ui/UserIdNameCard';
import { ExpandTabsRef } from '@/pages/case-management-item';

interface Props {
  caseItem: Case;
  onCaseUpdate: (caseItem: Case) => void;
  onReload: () => void;
}

export interface ExpandTabRef {
  expand: () => void;
}

function UserCaseDetails(props: Props, ref: Ref<ExpandTabsRef>) {
  const { caseItem, onCaseUpdate } = props;
  const user = caseItem.caseUsers?.origin ?? caseItem.caseUsers?.destination ?? undefined;

  const userDetailsRef = useRef<ExpandTabRef>(null);
  const expectedTransactionsRef = useRef<ExpandTabRef>(null);
  const shareHoldersRef = useRef<ExpandTabRef>(null);
  const dierctorsRef = useRef<ExpandTabRef>(null);
  const documentsRef = useRef<ExpandTabRef>(null);
  const legalDocumentsRef = useRef<ExpandTabRef>(null);
  const rulesHitRef = useRef<ExpandTabRef>(null);
  const insightsRef = useRef<ExpandTabRef>(null);
  const commentsRef = useRef<ExpandTabRef>(null);

  useImperativeHandle(ref, () => ({
    expand: () => {
      userDetailsRef.current?.expand();
      expectedTransactionsRef.current?.expand();
      shareHoldersRef.current?.expand();
      dierctorsRef.current?.expand();
      documentsRef.current?.expand();
      legalDocumentsRef.current?.expand();
      rulesHitRef.current?.expand();
      insightsRef.current?.expand();
      commentsRef.current?.expand();
    },
  }));

  return (
    <>
      <UserIdNameCard user={user} showRiskLevel={true} />
      <UserDetails
        user={user}
        isEmbedded={true}
        collapsedByDefault={true}
        hideHistory={true}
        hideInsights={true}
        ref={userDetailsRef}
      />
      <RulesHitCard caseItem={caseItem} reference={rulesHitRef} />
      {user?.userId && <InsightsCard userId={user.userId} reference={insightsRef} />}
      <CommentsCard
        caseId={caseItem.caseId}
        comments={caseItem.comments ?? []}
        onCommentsUpdate={(newComments) => {
          onCaseUpdate({ ...caseItem, comments: newComments });
        }}
        reference={commentsRef}
        caseStatus={caseItem.caseStatus}
        onReload={props.onReload}
      />
    </>
  );
}

export default forwardRef(UserCaseDetails);
