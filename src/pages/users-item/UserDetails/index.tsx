import BusinessUserDetails from './BusinessUserDetails';
import ConsumerUserDetails from './ConsumerUserDetails';
import { InternalBusinessUser, InternalConsumerUser, MissingUser } from '@/apis';
import { Small } from '@/components/ui/Typography';
import UserTransactionHistoryTable from '@/pages/users-item/UserDetails/UserTransactionHistoryTable';
import InsightsCard from '@/pages/case-management-item/UserCaseDetails/InsightsCard';
import CommentsCard from '@/components/CommentsCard';

interface Props {
  user?: InternalConsumerUser | InternalBusinessUser | MissingUser;
  isEmbedded?: boolean;
  collapsedByDefault?: boolean;
  hideHistory?: boolean;
  hideInsights?: boolean;
  updateCollapseState?: (key: string, value: boolean) => void;
  onUserUpdate?: (userItem: InternalBusinessUser | InternalConsumerUser) => void;
  onReload: () => void;
  showCommentEditor?: boolean;
  openCommandFromParent?: boolean;
}

function UserDetails(props: Props) {
  const {
    user,
    hideHistory = false,
    hideInsights = false,
    showCommentEditor = true,
    onUserUpdate,
  } = props;

  if (user == null || !('type' in user)) {
    return <Small>No user details found</Small>;
  }
  return (
    <>
      {user?.type === 'BUSINESS' && (
        <BusinessUserDetails
          user={user}
          collapsedByDefault={true}
          updateCollapseState={props.updateCollapseState}
        />
      )}
      {user?.type === 'CONSUMER' && (
        <ConsumerUserDetails
          user={user}
          collapsedByDefault={true}
          updateCollapseState={props.updateCollapseState}
        />
      )}
      {!hideHistory && (
        <UserTransactionHistoryTable
          userId={user.userId}
          collapsedByDefault={true}
          updateCollapseState={props.updateCollapseState}
        />
      )}
      {!hideInsights && (
        <InsightsCard userId={user.userId} updateCollapseState={props.updateCollapseState} />
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
        />
      )}
    </>
  );
}

export default UserDetails;
