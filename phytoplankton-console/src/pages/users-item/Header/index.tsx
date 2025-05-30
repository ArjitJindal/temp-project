import React from 'react';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import SubHeader from './SubHeader';
import { HeaderMenu } from './HeaderMenu';
import { Comment, InternalBusinessUser, InternalConsumerUser, UserTag } from '@/apis';
import CommentButton from '@/components/CommentButton';
import { useApi } from '@/api';
import EntityHeader from '@/components/ui/entityPage/EntityHeader';
import Id from '@/components/ui/Id';
import { getUserName } from '@/utils/api/users';
import { SarButton } from '@/components/Sar';
import { CommentType } from '@/utils/user-utils';
import { AsyncResource, isSuccess, map } from '@/utils/asyncResource';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
interface Props {
  headerStickyElRef?: React.RefCallback<HTMLDivElement>;
  userId: string;
  userRes: AsyncResource<InternalConsumerUser | InternalBusinessUser>;
  onNewComment: (newComment: Comment, commentType: CommentType, personId?: string) => void;
  onNewTags: (tags: UserTag[]) => void;
}

export default function Header(props: Props) {
  const settings = useSettings();
  const { userId, userRes, headerStickyElRef, onNewComment, onNewTags } = props;

  const api = useApi();

  return (
    <EntityHeader
      stickyElRef={headerStickyElRef}
      chips={[
        <Id alwaysShowCopy key="id-component">
          {userId}
        </Id>,
      ]}
      breadcrumbItems={[
        {
          title: firstLetterUpper(settings.userAlias),
          to: '/users',
        },
        map(userRes, (user) => ({
          title: getUserName(user),
        })),
      ]}
      buttons={[
        <SarButton userId={userId} key="sar-button" />,
        <CommentButton
          onSuccess={(createdComment) => onNewComment(createdComment, CommentType.COMMENT)}
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
          requiredResources={['write:::users/user-comments/*']}
          key="comment-button"
        />,
        isSuccess(userRes) ? (
          <HeaderMenu
            onNewTags={onNewTags}
            onNewComment={onNewComment}
            user={userRes.value}
            key="header-menu"
          />
        ) : (
          <></>
        ),
      ]}
      subHeader={<SubHeader onNewComment={onNewComment} userId={userId} userRes={userRes} />}
    />
  );
}
