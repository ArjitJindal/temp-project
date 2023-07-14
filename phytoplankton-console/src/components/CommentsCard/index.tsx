import React, { useCallback, useState } from 'react';
import Comment from './Comment';
import { message } from '@/components/library/Message';
import * as Card from '@/components/ui/Card';
import { useAuth0User } from '@/utils/user-utils';
import { useApi } from '@/api';
import { Comment as TransactionComment } from '@/apis';
import { getErrorMessage } from '@/utils/lang';

interface Props {
  id?: string;
  comments: Array<TransactionComment>;
  onCommentsUpdate: (newComments: TransactionComment[]) => void;
  commentType: 'CASE' | 'USER';
  title?: string;
}

export default function CommentsCard(props: Props) {
  const { comments, id, onCommentsUpdate, commentType, title } = props;
  const user = useAuth0User();
  const currentUserId = user.userId ?? undefined;
  const [deletingCommentIds, setDeletingCommentIds] = useState<string[]>([]);
  const api = useApi();

  // todo: use mutation instead, implement cache update
  const handleDeleteComment = useCallback(
    async (commentId: string, id: string, commentType: string) => {
      try {
        setDeletingCommentIds((prevIds) => [...prevIds, commentId]);
        if (commentType === 'CASE') {
          await api.deleteCasesCaseIdCommentsCommentId({ caseId: id, commentId });
        } else {
          await api.deleteUsersUserIdCommentsCommentId({ userId: id, commentId });
        }
        setDeletingCommentIds((prevIds) => prevIds.filter((prevId) => prevId !== commentId));
        onCommentsUpdate(comments.filter((comment) => comment.id !== commentId));
        message.success('Comment deleted');
      } catch (e) {
        message.fatal(`Unable to delete comment! ${getErrorMessage(e)}`, e);
      }
    },
    [api, comments, onCommentsUpdate],
  );

  return (
    <>
      <Card.Root header={title != null ? { title: `${title} (${comments.length})` } : undefined}>
        <Card.Section>
          {comments.length === 0 && <div>No comments yet</div>}
          {comments.map((comment) => (
            <Comment
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              deletingCommentIds={deletingCommentIds}
              onDelete={() => {
                if (comment.id != null && id != null) {
                  handleDeleteComment(comment.id, id, commentType);
                }
              }}
            />
          ))}
        </Card.Section>
      </Card.Root>
    </>
  );
}
