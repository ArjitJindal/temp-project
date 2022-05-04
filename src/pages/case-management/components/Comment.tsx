import * as Ant from 'antd';
import * as Icons from '@ant-design/icons';
import filesize from 'filesize';
import styles from './TransactionDetails.less';
import { Comment as ApiComment } from '@/apis';
import { useUserName } from '@/utils/user-utils';

interface Props {
  deletingCommentIds: string[];
  currentUserId: string | undefined;
  comment: ApiComment;
  onDelete: () => void;
}

export default function Comment(props: Props) {
  const { comment, currentUserId, deletingCommentIds, onDelete } = props;
  const userName = useUserName(comment.userId);
  // todo: i18n
  return (
    <Ant.Comment
      actions={
        currentUserId === comment.userId
          ? [
              comment.id && deletingCommentIds.includes(comment.id) ? (
                <span>Deleting...</span>
              ) : (
                <Ant.Tooltip key="delete" title="Delete">
                  <span onClick={() => deletingCommentIds.length === 0 && onDelete()}>Delete</span>
                </Ant.Tooltip>
              ),
            ]
          : []
      }
      content={
        <>
          <div className={styles.commentBody}>{comment.body}</div>
          {comment.files && (
            <>
              {comment.files.map((file) => (
                <Ant.Row align="middle" key={file.s3Key}>
                  <Ant.Space>
                    <Icons.PaperClipOutlined />
                    <a href={file.downloadLink}>{file.filename}</a>
                    {`(${filesize(file.size)})`}
                  </Ant.Space>
                </Ant.Row>
              ))}
            </>
          )}
        </>
      }
      datetime={comment.createdAt && new Date(comment.createdAt).toDateString()}
      author={userName}
    />
  );
}
