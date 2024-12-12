import React, { useState } from 'react';
import ApiTagsTable from './ApiTagsTable';
import { InternalBusinessUser, InternalConsumerUser, Comment, UserTag } from '@/apis';
import Modal from '@/components/library/Modal';
import { useApi } from '@/api';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';
import { CommentType } from '@/utils/user-utils';

interface Props {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  user: InternalConsumerUser | InternalBusinessUser;
  onNewComment: (newComment: Comment, commentType: CommentType, personId?: string) => void;
  onTagsUpdated: (tags: UserTag[]) => void;
}

const EditTagsModal: React.FC<Props> = ({
  isOpen,
  setIsOpen,
  user,
  onNewComment,
  onTagsUpdated,
}) => {
  const [updatedTags, setUpdatedTags] = useState<UserTag[] | undefined>(user.tags);
  const api = useApi();
  const mutateUser = useMutation(
    async () => {
      return user.type === 'CONSUMER'
        ? await api.postConsumerUsersUserId({
            userId: user.userId,
            UserUpdateRequest: {
              tags: updatedTags,
            },
          })
        : await api.postBusinessUsersUserId({
            userId: user.userId,
            UserUpdateRequest: {
              tags: updatedTags,
            },
          });
    },
    {
      onSuccess: (comment) => {
        if (updatedTags) {
          onTagsUpdated(updatedTags);
        }
        onNewComment(comment, CommentType.COMMENT);
      },
      onError: (error) => {
        message.error(error);
      },
    },
  );

  const handleSave = () => {
    mutateUser.mutate();
    setIsOpen(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onCancel={() => setIsOpen(false)}
      title="Edit tags"
      okText="Save"
      width="L"
      subTitle={
        "API tags marked as 'editable' can be updated via the console. Tags added through the console are set to 'editable' by default."
      }
      onOk={handleSave}
      writePermissions={['users:user-tags:write']}
    >
      <ApiTagsTable tags={updatedTags} setTags={setUpdatedTags} />
    </Modal>
  );
};

export default EditTagsModal;
