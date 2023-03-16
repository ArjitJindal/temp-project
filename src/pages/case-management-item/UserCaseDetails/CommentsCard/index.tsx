import React, { useState } from 'react';
import { message } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import s from './index.module.less';
import * as Card from '@/components/ui/Card';
import Comment from '@/components/CommentsCard/Comment';
import { useAuth0User } from '@/utils/user-utils';
import { useApi } from '@/api';
import { Case, Comment as ApiComment } from '@/apis';
import { getErrorMessage, neverThrow } from '@/utils/lang';
import { P } from '@/components/ui/Typography';
import { ALERT_ITEM_COMMENTS, CASES_ITEM } from '@/utils/queries/keys';

export interface CommentGroup {
  title: string;
  type: 'CASE' | 'ALERT';
  id: string;
  comments: ApiComment[];
}

interface Props {
  id?: string;
  comments: CommentGroup[];
  updateCollapseState?: (key: string, value: boolean) => void;
  collapsableKey: string;
  title: string;
}

export default function CommentsCard(props: Props) {
  const { comments, updateCollapseState, collapsableKey, title } = props;
  const user = useAuth0User();
  const currentUserId = user.userId ?? undefined;
  const [deletingCommentIds, setDeletingCommentIds] = useState<string[]>([]);
  const api = useApi();
  const queryClient = useQueryClient();

  const deleteCommentMutation = useMutation<
    unknown,
    unknown,
    { parentId: string; commentId: string; commentType: 'CASE' | 'ALERT' }
  >(
    async (variables) => {
      const { parentId, commentId, commentType } = variables;
      try {
        setDeletingCommentIds((prevIds) => [...prevIds, commentId]);
        if (commentType === 'CASE') {
          await api.deleteCasesCaseIdCommentsCommentId({ caseId: parentId, commentId });
        } else if (commentType === 'ALERT') {
          await api.deleteAlertsComment({ alertId: parentId, commentId });
        } else {
          throw neverThrow(commentType, 'Unknown comment type');
        }
        setDeletingCommentIds((prevIds) => prevIds.filter((prevId) => prevId !== commentId));
        message.success('Comment deleted');
      } catch (e) {
        message.error(`Unable to delete comment! ${getErrorMessage(e)}`);
      }
    },
    {
      onSuccess: async (data, variables) => {
        const { parentId, commentId, commentType } = variables;
        if (commentType === 'ALERT') {
          await queryClient.setQueryData<ApiComment[]>(ALERT_ITEM_COMMENTS(parentId), (comments) =>
            comments?.filter((x) => x.id !== commentId),
          );
        } else if (commentType === 'CASE') {
          await queryClient.setQueryData<Case>(
            CASES_ITEM(parentId),
            (caseItem: Case | undefined): Case | undefined =>
              caseItem
                ? {
                    ...caseItem,
                    comments: caseItem.comments?.filter((x) => x.id !== commentId),
                  }
                : undefined,
          );
        } else {
          throw neverThrow(commentType, 'Unknown type');
        }
      },
    },
  );

  const totalCommentsLength = comments.reduce((acc, group) => acc + group.comments.length, 0);

  return (
    <>
      <Card.Root
        header={{ title: `${title} (${totalCommentsLength})`, collapsableKey }}
        updateCollapseState={updateCollapseState}
        disabled={totalCommentsLength === 0}
      >
        <Card.Section>
          <div className={s.root}>
            {comments
              .filter((group) => group.comments.length > 0)
              .map((group) => (
                <div className={s.group} key={group.title}>
                  <P bold>{group.title}</P>
                  <div className={s.groupComments}>
                    {group.comments.map((comment) => (
                      <Comment
                        key={comment.id}
                        comment={comment}
                        currentUserId={currentUserId}
                        deletingCommentIds={deletingCommentIds}
                        onDelete={() => {
                          if (comment.id != null) {
                            deleteCommentMutation.mutate({
                              parentId: group.id,
                              commentId: comment.id,
                              commentType: group.type,
                            });
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </Card.Section>
      </Card.Root>
    </>
  );
}
