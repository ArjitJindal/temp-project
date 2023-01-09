import React, { useCallback, useState } from 'react';
import ReactDOM from 'react-dom';
import { List, message } from 'antd';
import Comment from './Comment';
import FixedCommentEditor from './FixedCommentEditor';
import * as Card from '@/components/ui/Card';
import { useAuth0User } from '@/utils/user-utils';
import { useApi } from '@/api';
import { CaseStatus, Comment as TransactionComment } from '@/apis';
import { getErrorMessage } from '@/utils/lang';

interface Props {
  id?: string;
  comments: Array<TransactionComment>;
  onCommentsUpdate: (newComments: TransactionComment[]) => void;
  updateCollapseState?: (key: string, value: boolean) => void;
  caseStatus?: CaseStatus;
  onReload: () => void;
  commentType: 'CASE' | 'USER';
  collapsableKey: string;
  title: string;
}

export default function CommentsCard(props: Props) {
  const {
    comments,
    id,
    onCommentsUpdate,
    caseStatus,
    updateCollapseState,
    commentType,
    collapsableKey,
    title,
  } = props;
  const user = useAuth0User();
  const currentUserId = user.userId ?? undefined;
  const [deletingCommentIds, setDeletingCommentIds] = useState<string[]>([]);
  const api = useApi();

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
    <>
      <Card.Root
        header={{ title: `${title} (${comments.length})`, collapsableKey }}
        updateCollapseState={updateCollapseState}
      >
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
                    if (comment.id != null && id != null) {
                      handleDeleteComment(comment.id, id, commentType);
                    }
                  }}
                />
              )}
            />
          )}
        </Card.Section>
      </Card.Root>
      {id &&
        ReactDOM.createPortal(
          <FixedCommentEditor
            id={id}
            user={user}
            handleCommentAdded={handleCommentAdded}
            caseStatus={caseStatus}
            onReload={props.onReload}
            commentType={commentType}
          />,
          document.getElementById('page-wrapper-root') as HTMLElement,
        )}
    </>
  );
}
