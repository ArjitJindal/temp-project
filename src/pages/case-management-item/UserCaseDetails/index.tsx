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
  updateCollapseState: (key: string, value: boolean) => void;
  onReload: () => void;
}

export interface ExpandTabRef {
  expand: (shouldExpand?: boolean) => void;
}

function UserCaseDetails(props: Props, ref: Ref<ExpandTabsRef>) {
  const { caseItem, onCaseUpdate } = props;
  const user = caseItem.caseUsers?.origin ?? caseItem.caseUsers?.destination ?? undefined;

  const userDetailsRef = useRef<ExpandTabRef>(null);
  const rulesHitRef = useRef<ExpandTabRef>(null);
  const insightsRef = useRef<ExpandTabRef>(null);
  const commentsRef = useRef<ExpandTabRef>(null);

  useImperativeHandle(ref, () => ({
    expand: (shouldExpand) => {
      userDetailsRef.current?.expand(shouldExpand);
      rulesHitRef.current?.expand(shouldExpand);
      insightsRef.current?.expand(shouldExpand);
      commentsRef.current?.expand(shouldExpand);
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
        updateCollapseState={props.updateCollapseState}
      />
      <RulesHitCard
        caseItem={caseItem}
        reference={rulesHitRef}
        updateCollapseState={props.updateCollapseState}
      />
      {user?.userId && (
        <InsightsCard
          userId={user.userId}
          reference={insightsRef}
          updateCollapseState={props.updateCollapseState}
        />
      )}
      <CommentsCard
        caseId={caseItem.caseId}
        comments={caseItem.comments ?? []}
        onCommentsUpdate={(newComments) => {
          onCaseUpdate({ ...caseItem, comments: newComments });
        }}
        reference={commentsRef}
        updateCollapseState={props.updateCollapseState}
        caseStatus={caseItem.caseStatus}
        onReload={props.onReload}
      />
    </>
  );
}

export default forwardRef(UserCaseDetails);
