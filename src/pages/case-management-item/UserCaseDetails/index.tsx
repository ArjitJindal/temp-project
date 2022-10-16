import React from 'react';
import RulesHitCard from './RulesHitCard';
import CommentsCard from '@/pages/case-management-item/components/CommentsCard';
import { Case } from '@/apis';
import UserDetails from '@/pages/users-item/UserDetails';
import UserIdNameCard from '@/components/ui/UserIdNameCard';

interface Props {
  caseItem: Case;
  onCaseUpdate: (caseItem: Case) => void;
}

export default function UserCaseDetails(props: Props) {
  const { caseItem, onCaseUpdate } = props;
  const user = caseItem.caseUsers?.origin ?? caseItem.caseUsers?.destination ?? undefined;
  return (
    <>
      <UserIdNameCard user={user} />
      <UserDetails user={user} isEmbedded={true} collapsedByDefault={true} />
      <RulesHitCard transactions={caseItem.caseTransactions ?? []} />
      <CommentsCard
        caseId={caseItem.caseId}
        comments={caseItem.comments ?? []}
        onCommentsUpdate={(newComments) => {
          onCaseUpdate({ ...caseItem, comments: newComments });
        }}
      />
    </>
  );
}
