import * as Ant from 'antd';
import React, { useMemo, useState } from 'react';
import cn from 'clsx';
import pluralize from 'pluralize';
import { Reply } from '../Reply';
import { CommentWithReplies } from '..';
import styles from './index.module.less';
import { CommentType, getDisplayedUserInfo, useUsers } from '@/utils/user-utils';
import FilesList from '@/components/files/FilesList';
import MarkdownViewer from '@/components/markdown/MarkdownViewer';
import Avatar from '@/components/library/Avatar';
import { Mutation } from '@/utils/queries/types';
import Spinner from '@/components/library/Spinner';
import { Comment as ApiComment } from '@/apis';
import { FormValues as CommentEditorFormValues } from '@/components/CommentEditor';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  currentUserId: string | undefined;
  comment: CommentWithReplies;
  deleteCommentMutation: Mutation<unknown, unknown, { commentId: string }>;
  level?: number;
  hasCommentWritePermission: boolean;
  handleAddComment: (commentFormValues: CommentEditorFormValues) => Promise<ApiComment>;
  onCommentAdded: (newComment: ApiComment, commentType: CommentType) => void;
}

export default function Comment(props: Props) {
  const {
    comment,
    currentUserId,
    deleteCommentMutation,
    level = 1,
    hasCommentWritePermission,
    handleAddComment,
    onCommentAdded,
  } = props;
  const [users, isLoading] = useUsers({ includeBlockedUsers: true, includeRootUsers: true });
  const [showReplyEditor, setShowReplyEditor] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [user, currentUser] = useMemo(() => {
    let user, currentUser;
    if (comment.userId) {
      user = users[comment.userId];
    }
    if (currentUserId) {
      currentUser = users[currentUserId];
    }
    return [user, currentUser];
  }, [users, comment.userId, currentUserId]);
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

  const areRepliesEnabled = useFeatureEnabled('NOTIFICATIONS');

  const handleShowReplies = () => {
    setShowReplies(!showReplies);
    if (showReplies) {
      setShowReplyEditor(false);
    }
  };

  const handleShowReplyEditor = () => {
    if (!showReplies) {
      setShowReplies(true);
    }
    setShowReplyEditor(!showReplyEditor);
  };

  const replies = comment.replies?.length ?? 0;
  return (
    <div className={cn(styles.root, isDeleting && styles.isDeleting)} data-cy="comment">
      <div className={styles.info}>
        <Avatar user={user} size={'medium'} isLoading={isLoading} />
        <div>
          {isLoading ? (
            <Spinner size="SMALL" />
          ) : (
            <div className={styles.name} data-cy="comment-created-by">
              {getDisplayedUserInfo(user).name}
            </div>
          )}
          <div className={styles.date} data-cy="comment-created-on">
            Added On: {comment.createdAt && new Date(comment.createdAt).toLocaleString()}
          </div>
        </div>
      </div>
      <div className={styles.right}>
        <div className={styles.commentBody}>
          <MarkdownViewer value={comment.body} />
        </div>
        <FilesList files={comment.files ? comment.files : []} />
        <div className={styles.footer}>
          {areRepliesEnabled && comment.createdAt && level === 1 && (
            <div
              data-cy="comment-created-on"
              className={styles.footerText}
              style={{ width: 'fit-content' }}
              onClick={handleShowReplies}
            >
              {replies} {pluralize('Reply', replies)}
            </div>
          )}
          {level === 1 && areRepliesEnabled && <div className={styles.separator}>.</div>}
          {areRepliesEnabled && level === 1 && (
            <div
              data-cy="comment-created-by"
              className={styles.footerText}
              style={{ width: 'fit-content' }}
              onClick={handleShowReplyEditor}
            >
              Reply
            </div>
          )}
          {currentUserId === comment.userId && level === 1 && areRepliesEnabled && (
            <div className={styles.separator}>.</div>
          )}

          {currentUserId === comment.userId && (
            <Ant.Tooltip
              key="delete"
              title="Delete"
              className={cn(styles.footerText, styles.delete)}
            >
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
        {level === 1 && areRepliesEnabled && (replies !== 0 || showReplyEditor) && (
          <div className={cn(styles.repliesContainer, !showReplies ? styles.hideReplies : '')}>
            {!!comment.replies?.length && (
              <div className={styles.replyWrapper}>
                {comment.replies.map((reply) => (
                  <Comment
                    comment={reply}
                    deleteCommentMutation={deleteCommentMutation}
                    currentUserId={currentUserId}
                    level={level + 1}
                    hasCommentWritePermission={hasCommentWritePermission}
                    handleAddComment={handleAddComment}
                    onCommentAdded={onCommentAdded}
                    key={reply.id}
                  />
                ))}
              </div>
            )}
            {showReplyEditor && (
              <div className={styles.replyEditor}>
                <Avatar user={currentUser} size={'medium'} isLoading={isLoading} />
                <Reply
                  submitRequest={handleAddComment}
                  onSuccess={(newComment) => onCommentAdded(newComment, CommentType.COMMENT)}
                  parentCommentId={comment.id}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
