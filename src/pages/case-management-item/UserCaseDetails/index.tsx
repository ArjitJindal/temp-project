import CommentsCard from '../../../components/CommentsCard';
import RulesHitCard from './RulesHitCard';
import InsightsCard from './InsightsCard';
import { Case } from '@/apis';
import UserDetails from '@/pages/users-item/UserDetails';
import UserIdNameCard from '@/components/ui/UserIdNameCard';

interface Props {
  caseItem: Case;
  onCaseUpdate: (caseItem: Case) => void;
  updateCollapseState: (key: string, value: boolean) => void;
  onReload: () => void;
}

function UserCaseDetails(props: Props) {
  const { caseItem, onCaseUpdate } = props;
  const user = caseItem.caseUsers?.origin ?? caseItem.caseUsers?.destination ?? undefined;

  return (
    <>
      <UserIdNameCard user={user} showRiskLevel={true} />
      <UserDetails
        user={user}
        isEmbedded={true}
        collapsedByDefault={true}
        hideHistory={true}
        hideInsights={true}
        updateCollapseState={props.updateCollapseState}
        onReload={props.onReload}
        showCommentEditor={false}
      />
      <RulesHitCard caseItem={caseItem} updateCollapseState={props.updateCollapseState} />
      {user?.userId && (
        <InsightsCard userId={user.userId} updateCollapseState={props.updateCollapseState} />
      )}
      <CommentsCard
        id={caseItem.caseId}
        comments={caseItem.comments ?? []}
        onCommentsUpdate={(newComments) => {
          onCaseUpdate({ ...caseItem, comments: newComments });
        }}
        updateCollapseState={props.updateCollapseState}
        caseStatus={caseItem.caseStatus}
        onReload={props.onReload}
        commentType={'CASE'}
      />
    </>
  );
}

export default UserCaseDetails;
