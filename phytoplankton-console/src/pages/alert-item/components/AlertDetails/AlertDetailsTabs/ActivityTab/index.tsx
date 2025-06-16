import React, { useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { flatten } from 'lodash';
import { Alert, AlertStatus, Comment as ApiComment } from '@/apis';
import { useUsers } from '@/utils/user-utils';
import {
  CommentEditorRef,
  FormValues as CommentEditorFormValues,
} from '@/components/CommentEditor';
import { getErrorMessage } from '@/utils/lang';
import { useApi } from '@/api';
import { getOr, success } from '@/utils/asyncResource';
import { ALERT_ITEM, ALERT_ITEM_COMMENTS } from '@/utils/queries/keys';
import { message } from '@/components/library/Message';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { sanitizeComment } from '@/components/markdown/MarkdownEditor/mention-utlis';
import ActivityCard, { getLogData } from '@/components/ActivityCard';
import { useRiskClassificationScores } from '@/utils/risk-levels';

type ActivityLogParams = Partial<{
  filterActivityBy: string[];
  filterAlertStatus: AlertStatus[];
}>;

const DEFAULT_ACTIVITY_LOG_PARAMS: ActivityLogParams = {};

interface Props {
  alert: Alert | undefined;
}

export default function ActivityTab(props: Props) {
  const { alert } = props;
  const api = useApi({ debounce: 500 });
  const commentEditorRef = useRef<CommentEditorRef>(null);

  const queryClient = useQueryClient();

  const commentSubmitMutation = useMutation<
    ApiComment,
    unknown,
    { alertId: string; values: CommentEditorFormValues }
  >(
    async ({ alertId, values }): Promise<ApiComment> => {
      return await api.createAlertsComment({
        alertId,
        CommentRequest: {
          body: sanitizeComment(values.comment),
          files: values.files,
          parentId: values.parentCommentId,
        },
      });
    },
    {
      onSuccess: async (newComment, { alertId }) => {
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
    },
  );

  const commentDeleteMutation = useMutation<
    unknown,
    unknown,
    { commentId: string; groupId: string }
  >(
    async ({ commentId, groupId: alertId }): Promise<void> => {
      await api.deleteAlertsComment({
        alertId,
        commentId,
      });
    },
    {
      onSuccess: async (_, { commentId, groupId: alertId }) => {
        message.success('Comment deleted successfully');
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

  const [users, _] = useUsers();

  const riskClassificationQuery = useRiskClassificationScores();
  const riskClassificationValues = getOr(riskClassificationQuery, []);

  return (
    <ActivityCard
      defaultActivityLogParams={DEFAULT_ACTIVITY_LOG_PARAMS}
      logs={{
        request: async (params) => {
          if (alert?.alertId == null) {
            return [];
          }
          const { filterAlertStatus, filterActivityBy } = params;
          const response = await api.getAuditlog({
            sortField: 'timestamp',
            sortOrder: 'descend',
            searchEntityId: [alert?.alertId],
            filterActions: ['CREATE', 'UPDATE', 'ESCALATE', 'DELETE'],
            filterActionTakenBy: filterActivityBy,
            alertStatus: flatten(filterAlertStatus),
            includeRootUserRecords: true,
            pageSize: 100,
            entityIdExactMatch: true,
          });
          return getLogData(response.data, users, 'CASE', riskClassificationValues);
        },
        filters: ([_params, _setParams]) => (
          <>
            {/*<StatusFilterButton*/}
            {/*  initialState={params?.filterAlertStatus ?? []}*/}
            {/*  onConfirm={(value) => {*/}
            {/*    setParams((prevState) => ({*/}
            {/*      ...prevState,*/}
            {/*      filterAlertStatus: value,*/}
            {/*    }));*/}
            {/*  }}*/}
            {/*  title={'Alert status'}*/}
            {/*/>*/}
            {/*<ActivityByFilterButton*/}
            {/*  initialState={params?.filterActivityBy ?? []}*/}
            {/*  onConfirm={(value) => {*/}
            {/*    setParams((prevState) => ({*/}
            {/*      ...prevState,*/}
            {/*      filterActivityBy: value,*/}
            {/*    }));*/}
            {/*  }}*/}
            {/*/>*/}
          </>
        ),
      }}
      comments={{
        writeResources: ['write:::case-management/case-details/*'],
        handleAddComment: async (commentFormValues, groupId) => {
          return commentSubmitMutation.mutateAsync({
            alertId: groupId,
            values: commentFormValues,
          });
        },
        deleteCommentMutation: commentDeleteMutation,
        dataRes: success([
          {
            id: alert?.alertId ?? '',
            comments: alert?.comments ?? [],
          },
        ]),
      }}
    />
  );
}
