import React from 'react';
import SubHeader from './SubHeader';
import { Comment, InternalBusinessUser, InternalConsumerUser } from '@/apis';
import UserIdNameCard from '@/components/ui/UserIdNameCard';
import CommentButton from '@/components/CommentButton';
import { useApi } from '@/api';
import EntityHeader from '@/components/ui/entityPage/EntityHeader';

interface Props {
  user: InternalConsumerUser | InternalBusinessUser;
  onNewComment: (newComment: Comment) => void;
}

export default function Header(props: Props) {
  const { user, onNewComment } = props;
  const userId = user.userId;

  const api = useApi();

  return (
    <EntityHeader
      buttons={
        <CommentButton
          onSuccess={onNewComment}
          submitRequest={async (commentFormValues) => {
            if (userId == null) {
              throw new Error(`User ID is not defined`);
            }
            const commentData = {
              Comment: { body: commentFormValues.comment, files: commentFormValues.files },
            };
            return await api.postUserComments({
              userId: userId,
              ...commentData,
            });
          }}
        />
      }
      subHeader={<SubHeader user={user} />}
    >
      <UserIdNameCard user={user} />
    </EntityHeader>
  );
}
