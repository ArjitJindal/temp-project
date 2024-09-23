import React, { useState } from 'react';
import EditTagsModal from '../EditTagsModal';
import Button from '@/components/library/Button';
import DeleteBackLineIcon from '@/components/ui/icons/Remix/system/delete-back-line.react.svg';
import { InternalBusinessUser } from '@/apis/models/InternalBusinessUser';
import { InternalConsumerUser } from '@/apis/models/InternalConsumerUser';
import { Comment, UserTag } from '@/apis';

interface Props {
  user: InternalConsumerUser | InternalBusinessUser;
  onNewComment: (comment: Comment) => void;
  onTagsUpdated: (tags: UserTag[]) => void;
  className?: string;
}

function EditTagsButton(props: Props) {
  const { user, onNewComment, onTagsUpdated } = props;
  const [isModalOpen, setIsModalOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => {
          setIsModalOpen(true);
        }}
        type="TETRIARY"
        icon={<DeleteBackLineIcon />}
        className={props.className}
      >
        Edit tags
      </Button>
      <EditTagsModal
        user={user}
        onNewComment={onNewComment}
        onTagsUpdated={onTagsUpdated}
        isOpen={isModalOpen}
        setIsOpen={setIsModalOpen}
      />
    </>
  );
}

export default EditTagsButton;
