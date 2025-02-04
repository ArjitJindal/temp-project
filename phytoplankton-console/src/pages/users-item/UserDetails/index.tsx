import React from 'react';
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

interface Props {
  userId?: string;
  onNewComment?: (newComment: Comment, commentType: CommentType, personId?: string) => void;
}

function UserDetails(props: Props) {
  const { userId, onNewComment } = props;

  return (
    <div className={s.root}>
      {userId == null ? (
        <Small>No user details found</Small>
      ) : (
        <Authorized required={['users:user-details:read']}>
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
