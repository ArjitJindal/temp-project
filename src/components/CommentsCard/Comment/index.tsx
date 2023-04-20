import * as Ant from 'antd';
import React from 'react';
import styles from './index.module.less';
import { Comment as ApiComment } from '@/apis';
import { useUser } from '@/utils/user-utils';
import { FilesList } from '@/components/files/FilesList';
import MarkdownViewer from '@/components/markdown/MarkdownViewer';

interface Props {
  deletingCommentIds: string[];
  currentUserId: string | undefined;
  comment: ApiComment;
  onDelete: () => void;
}

export default function Comment(props: Props) {
  const { comment, currentUserId, deletingCommentIds, onDelete } = props;
  const user = useUser(comment.userId);

  return (
    <div className={styles.root}>
      <div className={styles.left}>
        <div
          className={styles.avatar}
          style={{ backgroundImage: `url(${user?.picture})` }}
          title={`${user?.name || comment.userId} avatar`}
        />
      </div>
      <div className={styles.right}>
        <div className={styles.commentBody}>
          <MarkdownViewer value={comment.body} />
        </div>
        <FilesList files={comment.files ? comment.files : []} showGreyBackground={true} />
        <div className={styles.footer}>
          {comment.createdAt && (
            <div className={styles.footerText} style={{ width: 'fit-content' }}>
              Added On: {new Date(comment.createdAt).toLocaleString()}
            </div>
          )}
          <div className={styles.footerText} style={{ width: 'fit-content' }}>
            Added By: {user?.name}
          </div>
          {currentUserId === comment.userId && (
            <>
              {comment.id && deletingCommentIds.includes(comment.id) ? (
                <span>Deleting...</span>
              ) : (
                <Ant.Tooltip key="delete" title="Delete" className={styles.footerText}>
                  <span
                    onClick={() => deletingCommentIds.length === 0 && onDelete()}
                    style={{ cursor: 'pointer' }}
                    className="comment-delete"
                  >
                    Delete
                  </span>
                </Ant.Tooltip>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
