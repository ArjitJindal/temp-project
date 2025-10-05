import { useMemo, useState } from 'react';
import cn from 'clsx';
import pluralize from 'pluralize';
import { marked } from 'marked';
import { Reply } from '../Reply';
import { CommentWithReplies } from '..';
import styles from './index.module.less';
import { CommentType, getDisplayedUserInfo, useUsers } from '@/utils/user-utils';
import FilesList from '@/components/files/FilesList';
import MarkdownViewer from '@/components/markdown/MarkdownViewer';
import Avatar from '@/components/library/Avatar';
import type { Mutation } from '@/utils/queries/types';
import Spinner from '@/components/library/Spinner';
import type { Comment as ApiComment } from '@/apis';
import type { FormValues as CommentEditorFormValues } from '@/components/CommentEditor';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import Tooltip from '@/components/library/Tooltip';
import ConfirmModal from '@/components/utils/Confirm/ConfirmModal';

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
  const [showConfirmation, setShowConfirmation] = useState(false);
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

  const handlePrint = () => {
    // Convert markdown to HTML
    const htmlContent = marked(comment.body || '');

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print this comment.');
      return;
    }

    // Create the print-friendly HTML
    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Comment - ${comment.id || 'unknown'}</title>
          <style>
            body {
              font-family: Arial, Helvetica, sans-serif;
              font-size: 12px;
              line-height: 1.4;
              color: #333;
              margin: 20px;
              max-width: 800px;
            }
            .header {
              border-bottom: 2px solid #1890ff;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            .header h1 {
              color: #1890ff;
              margin: 0;
              font-size: 18px;
            }
            .meta {
              background-color: #f8f9fa;
              border-left: 3px solid #1890ff;
              padding: 10px;
              margin-bottom: 15px;
              border-radius: 4px;
            }
            .meta div {
              margin-bottom: 5px;
            }
            .meta strong {
              color: #1890ff;
            }
            .content {
              border: 1px solid #e8e8e8;
              padding: 15px;
              border-radius: 4px;
              background-color: #ffffff;
            }
            .content h1, .content h2, .content h3, .content h4, .content h5, .content h6 {
              color: #1890ff;
              margin-top: 15px;
              margin-bottom: 10px;
            }
            .content p {
              margin-bottom: 10px;
            }
            .content code {
              background-color: #f1f1f1;
              padding: 2px 4px;
              border-radius: 3px;
              font-family: 'Courier New', monospace;
            }
            .content pre {
              background-color: #f8f9fa;
              padding: 10px;
              border-radius: 4px;
              overflow-x: auto;
              border: 1px solid #e9ecef;
            }
            .content blockquote {
              border-left: 4px solid #1890ff;
              margin: 0;
              padding-left: 15px;
              color: #666;
            }
            .content ul, .content ol {
              margin-bottom: 10px;
              padding-left: 20px;
            }
            @media print {
              body { margin: 0; }
              .header { page-break-after: avoid; }
              .meta { page-break-after: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Comment Details</h1>
          </div>
          
          <div class="meta">
            <div><strong>Author:</strong> ${getDisplayedUserInfo(user).name}</div>
            <div><strong>Date:</strong> ${
              comment.createdAt ? new Date(comment.createdAt).toLocaleString() : 'N/A'
            }</div>
            <div><strong>Comment ID:</strong> ${comment.id || 'N/A'}</div>
          </div>
          
          <div class="content">
            ${htmlContent}
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printHtml);
    printWindow.document.close();

    // Wait for content to load, then print
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
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
          <div
            className={styles.footerText}
            style={{ width: 'fit-content' }}
            onClick={() => handlePrint()}
          >
            Print
          </div>
          {currentUserId === comment.userId && level === 1 && areRepliesEnabled && (
            <div className={styles.separator}>.</div>
          )}

          {currentUserId === comment.userId && (
            <>
              <Tooltip key="delete" title="Delete">
                <span
                  onClick={() => setShowConfirmation(true)}
                  data-cy="comment-delete-button"
                  className={cn(styles.footerText, styles.delete)}
                >
                  Delete
                </span>
              </Tooltip>
              <ConfirmModal
                title="Delete comment"
                text="Are you sure you want to delete this comment?"
                isVisible={showConfirmation}
                onCancel={() => setShowConfirmation(false)}
                onConfirm={handleClickDelete}
                isDanger
                res={deleteCommentMutation.dataResource}
              />
            </>
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
