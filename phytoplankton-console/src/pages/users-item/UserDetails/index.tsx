import React from 'react';
import BusinessUserDetails from './BusinessUserDetails';
import ConsumerUserDetails from './ConsumerUserDetails';
import s from './index.module.less';
import { Authorized } from '@/components/utils/Authorized';
import { Comment, InternalBusinessUser, InternalConsumerUser, MissingUser } from '@/apis';
import { Small } from '@/components/ui/Typography';
import * as Card from '@/components/ui/Card';
import { CommentType } from '@/utils/user-utils';

interface Props {
  user?: InternalConsumerUser | InternalBusinessUser | MissingUser;
  onNewComment?: (newComment: Comment, commentType: CommentType, personId?: string) => void;
}

function UserDetails(props: Props) {
  const { user, onNewComment } = props;

  return (
    <div className={s.root}>
      {user == null || !('type' in user) ? (
        <Small>No user details found</Small>
      ) : (
        <Authorized required={['users:user-details:read']}>
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
        </Authorized>
      )}
    </div>
  );
}

export default UserDetails;
