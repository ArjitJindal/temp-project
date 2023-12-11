import * as Ant from 'antd';
import React, { useState } from 'react';
import cn from 'clsx';
import styles from './index.module.less';
import { Comment as ApiComment } from '@/apis';
import { useUser } from '@/utils/user-utils';
import FilesList from '@/components/files/FilesList';
import MarkdownViewer from '@/components/markdown/MarkdownViewer';
import Avatar from '@/components/Avatar';
import { getAccountUserName } from '@/utils/account';
import { Mutation } from '@/utils/queries/types';

interface Props {
  currentUserId: string | undefined;
  comment: ApiComment;
  deleteCommentMutation: Mutation<unknown, unknown, { commentId: string }>;
}

export default function Comment(props: Props) {
  const { comment, currentUserId, deleteCommentMutation } = props;
  const user = useUser(comment.userId);

  const [isDeleting, setDeleting] = useState(false);

  const handleClickDelete = async () => {
    if (comment.id == null) {
      throw new Error(`Unable to delete comment, id is empty`);
    }
    setDeleting(true);
    try {
      await deleteCommentMutation.mutateAsync({ commentId: comment.id });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={cn(styles.root, isDeleting && styles.isDeleting)} data-cy="comment">
      <div className={styles.left}>
        <Avatar user={user} size={'large'} />
      </div>
      <div className={styles.right}>
        <div className={styles.commentBody}>
          <MarkdownViewer value={comment.body} />
        </div>
        <FilesList files={comment.files ? comment.files : []} />
        <div className={styles.footer}>
          {comment.createdAt && (
            <div
              data-cy="comment-created-on"
              className={styles.footerText}
              style={{ width: 'fit-content' }}
            >
              Added On: {new Date(comment.createdAt).toLocaleString()}
            </div>
          )}
          <div
            data-cy="comment-created-by"
            className={styles.footerText}
            style={{ width: 'fit-content' }}
          >
            Added by: {user ? getAccountUserName(user) : 'Unknown'}
          </div>
          {currentUserId === comment.userId && (
            <Ant.Tooltip key="delete" title="Delete" className={styles.footerText}>
              <span
                onClick={handleClickDelete}
                style={{ cursor: 'pointer' }}
                data-cy="comment-delete-button"
              >
                Delete
              </span>
            </Ant.Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}
