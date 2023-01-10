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
    <Ant.Comment
      content={
        <>
          <div className={styles.commentBody}>
            <MarkdownViewer value={comment.body} />
          </div>
          <div className={styles.filesListContainer}>
            <FilesList files={comment.files ? comment.files : []} showGreyBackground={true} />
          </div>
          <div className={styles.commentDetailsContainer}>
            {comment.createdAt && (
              <div className={styles.commentDetailsBodyText} style={{ width: 'fit-content' }}>
                Added On: {new Date(comment.createdAt).toLocaleString()}
              </div>
            )}
            <div className={styles.commentDetailsBodyText} style={{ width: 'fit-content' }}>
              Added By: {user?.name}
            </div>
            {currentUserId === comment.userId && (
              <>
                {comment.id && deletingCommentIds.includes(comment.id) ? (
                  <span>Deleting...</span>
                ) : (
                  <Ant.Tooltip
                    key="delete"
                    title="Delete"
                    className={styles.commentDetailsBodyText}
                  >
                    <span
                      onClick={() => deletingCommentIds.length === 0 && onDelete()}
                      style={{ cursor: 'pointer' }}
                    >
                      Delete
                    </span>
                  </Ant.Tooltip>
                )}
              </>
            )}
          </div>
        </>
      }
      avatar={<Ant.Avatar src={user?.picture} alt={user?.name || comment.userId} />}
    />
  );
}
