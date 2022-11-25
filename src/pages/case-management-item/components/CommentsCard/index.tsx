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
import { ExpandTabRef } from '@/pages/case-management-item/TransactionCaseDetails';

interface Props {
  caseId: string | undefined;
  comments: Array<TransactionComment>;
  onCommentsUpdate: (newComments: TransactionComment[]) => void;
  reference?: React.Ref<ExpandTabRef>;
  updateCollapseState: (key: string, value: boolean) => void;
  caseStatus?: CaseStatus;
  onReload: () => void;
}

export default function CommentsCard(props: Props) {
  const { comments, caseId, onCommentsUpdate, caseStatus, updateCollapseState } = props;
  const user = useAuth0User();
  const currentUserId = user.userId ?? undefined;
  const [deletingCommentIds, setDeletingCommentIds] = useState<string[]>([]);
  const api = useApi();

  const handleDeleteComment = useCallback(
    async (caseId: string, commentId: string) => {
      try {
        setDeletingCommentIds((prevIds) => [...prevIds, commentId]);
        await api.deleteCasesCaseIdCommentsCommentId({ caseId, commentId });
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
        header={{
          title: `Comments (${comments.length})`,
          collapsable: true,
          collapsedByDefault: true,
        }}
        ref={props.reference}
        onCollapseChange={(isCollapsed) => updateCollapseState('comments', isCollapsed)}
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
                    if (comment.id != null && caseId != null) {
                      handleDeleteComment(caseId, comment.id);
                    }
                  }}
                />
              )}
            />
          )}
        </Card.Section>
      </Card.Root>
      {caseId &&
        ReactDOM.createPortal(
          <FixedCommentEditor
            caseId={caseId}
            user={user}
            handleCommentAdded={handleCommentAdded}
            caseStatus={caseStatus}
            onReload={props.onReload}
          />,
          document.getElementById('page-wrapper-root') as HTMLElement,
        )}
    </>
  );
}
