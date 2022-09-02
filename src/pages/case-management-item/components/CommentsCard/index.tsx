import React, { useCallback, useState } from 'react';
import { Avatar, Comment as AntComment, List, message } from 'antd';
import CommentEditor from './CommentEditor';
import Comment from './Comment';
import * as Card from '@/components/ui/Card';
import { useAuth0User } from '@/utils/user-utils';
import { useApi } from '@/api';
import { Comment as TransactionComment } from '@/apis';
import { getErrorMessage } from '@/utils/lang';

interface Props {
  transactionId: string | undefined;
  comments: Array<TransactionComment>;
  onCommentsUpdate: (newComments: TransactionComment[]) => void;
}

export default function CommentsCard(props: Props) {
  const { comments, transactionId, onCommentsUpdate } = props;
  const user = useAuth0User();
  const currentUserId = user.userId ?? undefined;

  const [deletingCommentIds, setDeletingCommentIds] = useState<string[]>([]);
  const api = useApi();

  const handleDeleteComment = useCallback(
    async (transactionId: string, commentId: string) => {
      try {
        setDeletingCommentIds((prevIds) => [...prevIds, commentId]);
        await api.deleteTransactionsTransactionIdCommentsCommentId({ transactionId, commentId });
        setDeletingCommentIds((prevIds) => prevIds.filter((prevId) => prevId !== commentId));
        onCommentsUpdate(comments.filter((comment) => comment.id !== commentId));
        message.success('Comment deleted');
      } catch (e) {
        message.error(`Unable to delete comment! ${getErrorMessage(e)}`);
      }
    },
    [api, comments, onCommentsUpdate],
  );

  const handleCommentAdded = useCallback(
    (newComment: TransactionComment) => {
      onCommentsUpdate([...comments, newComment]);
    },
    [onCommentsUpdate, comments],
  );

  return (
    <Card.Root>
      <Card.Section>
        <Card.Title>{`Comments (${comments.length})`}</Card.Title>
      </Card.Section>
      <Card.Section>
        {comments.length > 0 && (
          <List<TransactionComment>
            dataSource={comments}
            itemLayout="horizontal"
            renderItem={(comment: TransactionComment) => (
              <Comment
                comment={comment}
                currentUserId={currentUserId}
                deletingCommentIds={deletingCommentIds}
                onDelete={() => {
                  if (comment.id != null && transactionId != null) {
                    handleDeleteComment(transactionId, comment.id);
                  }
                }}
              />
            )}
          />
        )}
        {transactionId != null && (
          <AntComment
            avatar={<Avatar src={user?.picture} />}
            content={
              <CommentEditor transactionId={transactionId} onCommentAdded={handleCommentAdded} />
            }
          />
        )}
      </Card.Section>
    </Card.Root>
  );
}
