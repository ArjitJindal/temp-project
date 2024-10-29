import { flatten } from 'lodash';
import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import ActivityCard from '@/components/ActivityCard';
import { useApi } from '@/api';
import { useUsers } from '@/utils/user-utils';
import { LogItemData } from '@/components/ActivityCard/LogCard/LogContainer/LogItem';
import CaseIcon from '@/components/ui/icons/Remix/business/stack-line.react.svg';
import Avatar from '@/components/library/Avatar';
import {
  getCreateStatement,
  isActionUpdate,
  isActionCreate,
  isActionEscalate,
  isActionDelete,
} from '@/components/ActivityCard/helpers';
import {
  AuditLog,
  Account,
  InternalConsumerUser,
  InternalBusinessUser,
  Comment,
  RiskClassificationScore,
} from '@/apis';
import { getOr, success } from '@/utils/asyncResource';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';
import { USERS_ITEM } from '@/utils/queries/keys';
import ActivityByFilterButton from '@/components/ActivityCard/Filters/ActivityByFilterButton';
import { FormValues } from '@/components/CommentEditor';
import { useRiskClassificationScores } from '@/utils/risk-levels';

interface Props {
  user: InternalConsumerUser | InternalBusinessUser;
  comments: {
    handleAddComment: (commentFormValues: FormValues) => Promise<Comment>;
    onCommentAdded: (newComment: Comment) => void;
  };
}

export default function UserActivityCard(props: Props) {
  const { user, comments } = props;
  const api = useApi();
  const [users, _] = useUsers();

  const queryClient = useQueryClient();

  const riskClassificationQuery = useRiskClassificationScores();
  const riskClassificationValues = getOr(riskClassificationQuery, []);

  const deleteCommentMutation = useMutation<
    unknown,
    unknown,
    { commentId: string; groupId: string }
  >(
    async (variables) => {
      await api.deleteUsersUserIdCommentsCommentId({
        userId: user.userId,
        commentId: variables.commentId,
      });
    },
    {
      onSuccess: (data, variables) => {
        message.success('Comment deleted!');
        queryClient.setQueryData<InternalConsumerUser | InternalBusinessUser>(
          USERS_ITEM(user.userId),
          (user) => {
            if (user == null) {
              return user;
            }
            return {
              ...user,
              comments: (user?.comments ?? []).filter((x) => x.id !== variables.commentId),
            };
          },
        );
      },
      onError: (e) => {
        console.error(e);
        message.success('Unable to delete comment!');
      },
    },
  );

  return (
    <ActivityCard
      logs={{
        request: async (params) => {
          const { filterCaseStatus, filterAlertStatus, filterActivityBy } = params;
          const response = await api.getAuditlog({
            sortField: 'timestamp',
            sortOrder: 'descend',
            searchEntityId: [user.userId],
            filterActions: ['CREATE', 'UPDATE', 'ESCALATE', 'DELETE'],
            filterActionTakenBy: filterActivityBy,
            alertStatus: flatten(filterAlertStatus),
            caseStatus: flatten(filterCaseStatus),
            includeRootUserRecords: true,
            pageSize: 100,
          });
          return getLogData(response.data, users, 'CASE', riskClassificationValues);
        },
        filters: ([params, setParams]) => {
          return (
            <ActivityByFilterButton
              initialState={params?.filterActivityBy ?? []}
              onConfirm={(value) => {
                setParams((prevState) => ({
                  ...prevState,
                  filterActivityBy: value,
                }));
              }}
            />
          );
        },
      }}
      comments={{
        writePermissions: ['users:user-comments:write'],
        handleAddComment: comments.handleAddComment,
        onCommentAdded: comments.onCommentAdded,
        dataRes: success([
          {
            id: 'user-comments',
            comments: user.comments ?? [],
          },
        ]),
        deleteCommentMutation,
      }}
    />
  );
}

const getLogData = (
  logs: AuditLog[],
  users: { [userId: string]: Account },
  type: 'USER' | 'CASE',
  riskClassificationValues: RiskClassificationScore[],
): LogItemData[] => {
  const logItemData: LogItemData[] = logs
    .map((log) => {
      let currentUser: Account | null = null;
      if (log?.user?.id && users[log?.user?.id]) {
        currentUser = users[log?.user?.id];
      }
      const getIcon = (type: string) => {
        return type === 'CASE' ? (
          <CaseIcon width={20} height={20} />
        ) : (
          <Avatar size="small" user={currentUser} />
        );
      };

      const createStatement = getCreateStatement(log, users, type, riskClassificationValues);
      if (isActionUpdate(log)) {
        return createStatement
          ? {
              timestamp: log.timestamp,
              user: log.user,
              icon: getIcon('USER'),
              statement: createStatement,
            }
          : null;
      } else if (isActionCreate(log)) {
        return createStatement
          ? {
              timestamp: log.timestamp,
              user: log.user,
              icon: getIcon(log.subtype === 'COMMENT' ? 'USER' : type),
              statement: createStatement,
            }
          : null;
      } else if (isActionEscalate(log)) {
        return createStatement
          ? {
              timestamp: log.timestamp,
              user: log.user,
              icon: getIcon('CASE'),
              statement: createStatement,
            }
          : null;
      } else if (isActionDelete(log)) {
        return createStatement
          ? {
              timestamp: log.timestamp,
              user: log.user,
              icon: getIcon('USER'),
              statement: createStatement,
            }
          : null;
      }
      return null;
    })
    .filter((log) => log !== null) as LogItemData[];
  return logItemData;
};
