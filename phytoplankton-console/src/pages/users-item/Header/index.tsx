import React from 'react';
import SubHeader from './SubHeader';
import { HeaderMenu } from './HeaderMenu';
import { Comment, InternalBusinessUser, InternalConsumerUser } from '@/apis';
import CommentButton from '@/components/CommentButton';
import { useApi } from '@/api';
import EntityHeader from '@/components/ui/entityPage/EntityHeader';
import Id from '@/components/ui/Id';
import { getUserName } from '@/utils/api/users';

interface Props {
  headerStickyElRef?: React.RefCallback<HTMLDivElement>;
  user: InternalConsumerUser | InternalBusinessUser;
  onNewComment: (newComment: Comment) => void;
}

export default function Header(props: Props) {
  const { user, headerStickyElRef, onNewComment } = props;
  const userId = user.userId;

  const api = useApi();

  return (
    <EntityHeader
      stickyElRef={headerStickyElRef}
      chips={[<Id alwaysShowCopy>{userId}</Id>]}
      breadcrumbItems={[
        {
          title: 'Users',
          to: '/users',
        },
        {
          title: getUserName(user),
        },
      ]}
      buttons={[
        <CommentButton
          onSuccess={onNewComment}
          submitRequest={async (commentFormValues) => {
            if (userId == null) {
              throw new Error(`User ID is not defined`);
            }
            const commentData = {
              CommentRequest: { body: commentFormValues.comment, files: commentFormValues.files },
            };
            return await api.postUserComments({
              userId: userId,
              ...commentData,
            });
          }}
          requiredPermissions={['users:user-comments:write']}
        />,

        <HeaderMenu user={user} />,
      ]}
      subHeader={<SubHeader onNewComment={onNewComment} user={user} />}
    />
  );
}
