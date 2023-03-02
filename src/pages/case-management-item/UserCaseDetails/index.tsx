import CommentsCard from '../../../components/CommentsCard';
import AlertsCard from './AlertsCard';
import InsightsCard from './InsightsCard';
import { UI_SETTINGS } from './ui-settings';
import { Case } from '@/apis';
import UserDetails from '@/pages/users-item/UserDetails';
import UserIdNameCard from '@/components/ui/UserIdNameCard';
import { usePageViewTracker } from '@/utils/tracker';
import { useScrollToFocus } from '@/utils/hooks';

interface Props {
  caseItem: Case;
  onCaseUpdate: (caseItem: Case) => void;
  updateCollapseState: (key: string, value: boolean) => void;
  onReload: () => void;
}

function UserCaseDetails(props: Props) {
  const { caseItem, onCaseUpdate } = props;
  const user = caseItem.caseUsers?.origin ?? caseItem.caseUsers?.destination ?? undefined;
  usePageViewTracker('User Case Details');
  useScrollToFocus();

  return (
    <>
      <UserIdNameCard user={user} showRiskLevel={true} />
      <UserDetails
        user={user}
        isEmbedded={true}
        hideHistory={true}
        hideInsights={true}
        updateCollapseState={props.updateCollapseState}
        onReload={props.onReload}
        showCommentEditor={false}
        uiSettings={UI_SETTINGS}
      />
      <AlertsCard
        caseItem={caseItem}
        updateCollapseState={props.updateCollapseState}
        title={UI_SETTINGS.cards.ALERTS.title}
        collapsableKey={UI_SETTINGS.cards.ALERTS.key}
      />
      {user?.userId && (
        <InsightsCard
          userId={user.userId}
          updateCollapseState={props.updateCollapseState}
          title={UI_SETTINGS.cards.TRANSACTION_INSIGHTS.title}
          collapsableKey={UI_SETTINGS.cards.TRANSACTION_INSIGHTS.key}
        />
      )}
      <CommentsCard
        id={caseItem.caseId}
        comments={caseItem.comments ?? []}
        onCommentsUpdate={(newComments) => {
          onCaseUpdate({ ...caseItem, comments: newComments });
        }}
        updateCollapseState={props.updateCollapseState}
        onReload={props.onReload}
        commentType={'CASE'}
        title={UI_SETTINGS.cards.COMMENTS.title}
        collapsableKey={UI_SETTINGS.cards.COMMENTS.key}
      />
    </>
  );
}

export default UserCaseDetails;
