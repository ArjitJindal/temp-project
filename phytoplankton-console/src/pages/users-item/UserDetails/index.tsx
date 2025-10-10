import BusinessUserDetails from './BusinessUserDetails';
import ConsumerUserDetails from './ConsumerUserDetails';
import s from './index.module.less';
import { useConsoleUser } from './utils';
import { Authorized } from '@/components/utils/Authorized';
import { Comment } from '@/apis';
import { Small } from '@/components/ui/Typography';
import * as Card from '@/components/ui/Card';
import { CommentType } from '@/utils/user-utils';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
interface Props {
  userId?: string;
  onNewComment?: (newComment: Comment, commentType: CommentType, personId?: string) => void;
}

function UserDetails(props: Props) {
  const { userId, onNewComment } = props;
  const settings = useSettings();

  return (
    <div className={s.root}>
      {userId == null ? (
        <Small>No {settings.userAlias} details found</Small>
      ) : (
        <Authorized minRequiredResources={['read:::users/user-details/*']} showForbiddenPage>
          <UserDetailData userId={userId} onNewComment={onNewComment} />
        </Authorized>
      )}
    </div>
  );
}

const UserDetailData = (props: {
  userId: string;
  onNewComment?: (newComment: Comment, commentType: CommentType, personId?: string) => void;
}) => {
  const { userId, onNewComment } = props;

  const userQueryResults = useConsoleUser(userId);

  return (
    <AsyncResourceRenderer resource={userQueryResults.data}>
      {(user) => (
        <Card.Root>
          <Card.Section>
            {user?.type === 'BUSINESS' && (
              <BusinessUserDetails user={user} onNewComment={onNewComment} />
            )}
            {user?.type === 'CONSUMER' && (
              <ConsumerUserDetails user={user} onNewComment={onNewComment} />
            )}
          </Card.Section>
        </Card.Root>
      )}
    </AsyncResourceRenderer>
  );
};

export default UserDetails;
