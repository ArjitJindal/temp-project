import React, { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import s from './index.module.less';
import * as Card from '@/components/ui/Card';
import { Alert, Comment as ApiComment } from '@/apis';
import Comment from '@/components/CommentsCard/Comment';
import { useAuth0User } from '@/utils/user-utils';
import { getMutationAsyncResource } from '@/utils/queries/hooks';
import CommentEditor, {
  CommentEditorRef,
  FormValues as CommentEditorFormValues,
} from '@/components/CommentEditor';
import { getErrorMessage } from '@/utils/lang';
import { useApi } from '@/api';
import { AsyncResource } from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { ALERT_ITEM } from '@/utils/queries/keys';
import { message } from '@/components/library/Message';

interface Props {
  alertRes: AsyncResource<Alert>;
}

export default function Comments(props: Props) {
  const { alertRes } = props;
  const user = useAuth0User();
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
        Comment: { body: values.comment, files: values.files },
      });
    },
    {
      onSuccess: async (data, { alertId }) => {
        message.success('Comment successfully added!');
        commentEditorRef.current?.reset();
        await queryClient.invalidateQueries({
          queryKey: ALERT_ITEM(alertId),
        });
      },
      onError: async (error) => {
        console.log(error);
        message.error(`Unable to add comment! ${getErrorMessage(error)}`);
      },
    },
  );

  const [deletingCommentIds, setDeletingCommentIds] = useState<string[]>([]);

  const commentDeleteMutation = useMutation<
    unknown,
    unknown,
    { alertId: string; commentId: string }
  >(
    async ({ alertId, commentId }): Promise<void> => {
      setDeletingCommentIds((prevState) => [...prevState, commentId]);
      try {
        await api.deleteAlertsComment({
          alertId,
          commentId,
        });
      } finally {
        setDeletingCommentIds((prevState) => prevState.filter((id) => id !== commentId));
      }
    },
    {
      onSuccess: async (_, { alertId }) => {
        message.success('Comment deleted!');
        await queryClient.invalidateQueries({
          queryKey: ALERT_ITEM(alertId),
        });
      },
      onError: (error) => {
        console.log(error);
        message.error(`Unable to delete comment! ${getErrorMessage(error)}`);
      },
    },
  );

  return (
    <AsyncResourceRenderer<Alert> resource={alertRes}>
      {({ alertId, comments = [] }) => (
        <Card.Root collapsable={false}>
          <Card.Section>
            {comments.length > 0 ? (
              <div className={s.list}>
                {comments.map((comment) => (
                  <Comment
                    key={comment.id}
                    comment={comment}
                    currentUserId={currentUserId}
                    deletingCommentIds={deletingCommentIds}
                    onDelete={() => {
                      if (comment.id != null && alertId != null) {
                        commentDeleteMutation.mutate({
                          alertId,
                          commentId: comment.id,
                        });
                      }
                    }}
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
              submitRes={getMutationAsyncResource(commentSubmitMutation)}
              placeholder={'Add your narrative as a comment here'}
              onChangeValues={setCommentFormValues}
              onSubmit={(values) => {
                if (alertId != null) {
                  commentSubmitMutation.mutate({
                    alertId,
                    values,
                  });
                }
              }}
            />
          </Card.Section>
        </Card.Root>
      )}
    </AsyncResourceRenderer>
  );
}
