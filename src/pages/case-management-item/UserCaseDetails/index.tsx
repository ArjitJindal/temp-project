import React from 'react';
import CommentsCard from '../components/CommentsCard';
import RulesHitCard from './RulesHitCard';
import InsightsCard from './InsightsCard';
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
      <UserDetails user={user} isEmbedded={true} collapsedByDefault={true} hideHistory={true} />
      <RulesHitCard caseItem={caseItem} />
      {user?.userId && <InsightsCard userId={user.userId} />}
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
