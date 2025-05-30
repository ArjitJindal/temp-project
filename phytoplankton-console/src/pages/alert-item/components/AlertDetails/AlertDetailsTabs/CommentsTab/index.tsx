import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import s from './index.module.less';
import * as Card from '@/components/ui/Card';
import { Alert, Comment as ApiComment } from '@/apis';
import Comment from '@/components/CommentsCard/Comment';
import { useAuth0User, useHasPermissions } from '@/utils/user-utils';
import { adaptMutationVariables } from '@/utils/queries/mutations/helpers';
import CommentEditor, {
  CommentEditorRef,
  FormValues as CommentEditorFormValues,
} from '@/components/CommentEditor';
import { getErrorMessage } from '@/utils/lang';
import { useApi } from '@/api';
import { ALERT_ITEM, ALERT_ITEM_COMMENTS } from '@/utils/queries/keys';
import { message } from '@/components/library/Message';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { sanitizeComment } from '@/components/markdown/MarkdownEditor/mention-utlis';
import { getCommentsWithReplies } from '@/components/CommentsCard/utils';

interface Props {
  alert: Alert | undefined;
}

export default function CommentsTab(props: Props) {
  const { alert } = props;
  const user = useAuth0User();
  const hasCommentWritePermission = useHasPermissions(
    ['case-management:case-details:write'],
    ['write:::case-management/case-details/*'],
  );
  const api = useApi();
  const currentUserId = user.userId ?? undefined;
  const commentEditorRef = useRef<CommentEditorRef>(null);
  const [commentFormValues, setCommentFormValues] = useState<CommentEditorFormValues>({
    comment: '',
    files: [],
  });

  const queryClient = useQueryClient();

  const commentSubmitMutation = useMutation<
    ApiComment,
    unknown,
    { alertId: string; values: CommentEditorFormValues }
  >(
    async ({ alertId, values }): Promise<ApiComment> => {
      return await api.createAlertsComment({
        alertId,
        CommentRequest: { body: sanitizeComment(values.comment), files: values.files },
      });
    },
    {
      onSuccess: async (newComment, { alertId }) => {
        message.success('Comment successfully added!');
        commentEditorRef.current?.reset();
        queryClient.setQueryData<Alert>(ALERT_ITEM(alertId), (alert) => {
          if (!alert) {
            return undefined;
          }
          return {
            ...alert,
            comments: [...(alert?.comments ?? []), newComment],
          };
        });
        queryClient.setQueryData<ApiComment[]>(ALERT_ITEM_COMMENTS(alertId), (comments) => {
          return [...(comments ?? []), newComment];
        });
      },
      onError: async (error) => {
        message.fatal(`Unable to add comment! ${getErrorMessage(error)}`, error);
      },
    },
  );

  const commentDeleteMutation = useMutation<
    unknown,
    unknown,
    { alertId: string; commentId: string }
  >(
    async ({ alertId, commentId }): Promise<void> => {
      await api.deleteAlertsComment({
        alertId,
        commentId,
      });
    },
    {
      onSuccess: async (_, { alertId, commentId }) => {
        message.success('Comment deleted!');
        queryClient.setQueryData<Alert>(ALERT_ITEM(alertId), (alert) => {
          if (!alert) {
            return undefined;
          }
          return {
            ...alert,
            comments: (alert?.comments ?? []).filter((comment) => comment.id !== commentId),
          };
        });
        queryClient.setQueryData<ApiComment[]>(ALERT_ITEM_COMMENTS(alertId), (comments) => {
          if (comments == null) {
            return comments;
          }
          return comments.filter((comment) => comment.id !== commentId);
        });
      },
      onError: (error) => {
        message.fatal(`Unable to delete comment! ${getErrorMessage(error)}`, error);
      },
    },
  );

  const handleAddCommentReply = async (commentFormValues: CommentEditorFormValues) => {
    if (alert?.alertId == null) {
      throw new Error(`Alert ID is not defined`);
    }
    return await api.createAlertsCommentReply({
      alertId: alert?.alertId,
      commentId: commentFormValues.parentCommentId ?? '',
      CommentRequest: { body: commentFormValues.comment, files: commentFormValues.files },
    });
  };

  const handleNewComment = (newComment) => {
    queryClient.setQueryData<Alert>(ALERT_ITEM(alert?.alertId ?? ''), (alert) => {
      if (!alert) {
        return undefined;
      }
      return {
        ...alert,
        comments: [...(alert?.comments ?? []), newComment],
      };
    });
  };

  return (
    <Card.Root>
      <Card.Section testId={'comments-section'}>
        {alert && alert?.comments?.length ? (
          <div className={s.list}>
            {getCommentsWithReplies(alert?.comments ?? []).map((comment) => (
              <Comment
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
                deleteCommentMutation={adaptMutationVariables(
                  commentDeleteMutation,
                  (variables: { commentId: string }): { alertId: string; commentId: string } => {
                    if (alert?.alertId == null) {
                      throw new Error(`Unable to delete comment, alertId is empty`);
                    }
                    return { ...variables, alertId: alert?.alertId };
                  },
                )}
                handleAddComment={handleAddCommentReply}
                onCommentAdded={handleNewComment}
                hasCommentWritePermission={hasCommentWritePermission}
              />
            ))}
          </div>
        ) : (
          <p>No comments yet. You can add your narrative as a comment below.</p>
        )}
      </Card.Section>
      <Card.Section>
        <CommentEditor
          ref={commentEditorRef}
          values={commentFormValues}
          submitRes={commentSubmitMutation.dataResource}
          placeholder={'Add your narrative as a comment here'}
          onChangeValues={setCommentFormValues}
          onSubmit={(values) => {
            if (alert?.alertId != null) {
              commentSubmitMutation.mutate({
                alertId: alert?.alertId,
                values,
              });
            }
          }}
        />
      </Card.Section>
    </Card.Root>
  );
}
