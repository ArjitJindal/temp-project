import { UI_SETTINGS } from '../ui-settings';
import BusinessUserDetails from './BusinessUserDetails';
import ConsumerUserDetails from './ConsumerUserDetails';
import { InternalBusinessUser, InternalConsumerUser, MissingUser } from '@/apis';
import { Small } from '@/components/ui/Typography';
import UserTransactionHistoryTable from '@/pages/users-item/UserDetails/UserTransactionHistoryTable';
import InsightsCard from '@/pages/case-management-item/UserCaseDetails/InsightsCard';
import CommentsCard from '@/components/CommentsCard';
import Authorized from '@/components/Authorized';

interface Props {
  user?: InternalConsumerUser | InternalBusinessUser | MissingUser;
  isEmbedded?: boolean;
  hideHistory?: boolean;
  hideInsights?: boolean;
  updateCollapseState?: (key: string, value: boolean) => void;
  onUserUpdate?: (userItem: InternalBusinessUser | InternalConsumerUser) => void;
  onReload: () => void;
  showCommentEditor?: boolean;
  uiSettings: typeof UI_SETTINGS;
}

function UserDetails(props: Props) {
  const {
    user,
    hideHistory = false,
    hideInsights = false,
    showCommentEditor = true,
    onUserUpdate,
    uiSettings,
  } = props;
  if (user == null || !('type' in user)) {
    return <Small>No user details found</Small>;
  }
  return (
    <>
      <Authorized required={['users:user-details:read']}>
        {user?.type === 'BUSINESS' && (
          <BusinessUserDetails
            user={user}
            updateCollapseState={props.updateCollapseState}
            uiSettings={uiSettings}
          />
        )}
        {user?.type === 'CONSUMER' && (
          <ConsumerUserDetails
            user={user}
            updateCollapseState={props.updateCollapseState}
            uiSettings={uiSettings}
          />
        )}
      </Authorized>
      {!hideHistory && (
        <UserTransactionHistoryTable
          userId={user.userId}
          updateCollapseState={props.updateCollapseState}
          title={UI_SETTINGS.cards.TRANSACTION_HISTORY.title}
          collapsableKey={UI_SETTINGS.cards.TRANSACTION_HISTORY.key}
        />
      )}
      {!hideInsights && (
        <InsightsCard
          userId={user.userId}
          updateCollapseState={props.updateCollapseState}
          title={UI_SETTINGS.cards.TRANSACTION_INSIGHTS.title}
          collapsableKey={UI_SETTINGS.cards.TRANSACTION_INSIGHTS.key}
        />
      )}
      {showCommentEditor && (
        <CommentsCard
          id={user.userId}
          comments={user.comments ?? []}
          onCommentsUpdate={(newComments) => {
            onUserUpdate && onUserUpdate({ ...user, comments: newComments });
          }}
          updateCollapseState={props.updateCollapseState}
          onReload={props.onReload}
          commentType={'USER'}
          title={UI_SETTINGS.cards.COMMENTS.title}
          collapsableKey={UI_SETTINGS.cards.COMMENTS.key}
        />
      )}
    </>
  );
}

export default UserDetails;
