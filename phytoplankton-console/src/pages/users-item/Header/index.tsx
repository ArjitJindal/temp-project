import React from 'react';
import SubHeader from './SubHeader';
import { Comment, InternalBusinessUser, InternalConsumerUser } from '@/apis';
import CommentButton from '@/components/CommentButton';
import { useApi } from '@/api';
import EntityHeader from '@/components/ui/entityPage/EntityHeader';
import Id from '@/components/ui/Id';
import { getUserName } from '@/utils/api/users';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { ManualCaseCreationButton } from '@/pages/users-item/ManualCaseCreationButton';

interface Props {
  headerStickyElRef?: React.RefCallback<HTMLDivElement>;
  user: InternalConsumerUser | InternalBusinessUser;
  onNewComment: (newComment: Comment) => void;
}

export default function Header(props: Props) {
  const { user, headerStickyElRef, onNewComment } = props;
  const userId = user.userId;
  const isManualCaseFeatureEnabled = useFeatureEnabled('MANUAL_CASE_CREATION');

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
        ...(isManualCaseFeatureEnabled
          ? [<ManualCaseCreationButton userId={userId} type={'CREATE'} />]
          : []),
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
          requiredPermissions={['users:user-comments:write']}
        />,
      ]}
      subHeader={<SubHeader onNewComment={onNewComment} user={user} />}
    />
  );
}
