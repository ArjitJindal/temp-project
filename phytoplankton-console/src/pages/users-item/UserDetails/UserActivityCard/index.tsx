import { flatten } from 'lodash';
import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import ActivityCard from '@/components/ActivityCard';
import { useApi } from '@/api';
import { CommentType, useUsers } from '@/utils/user-utils';
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
import { success } from '@/utils/asyncResource';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';
import { USERS_ITEM } from '@/utils/queries/keys';
import ActivityByFilterButton from '@/components/ActivityCard/Filters/ActivityByFilterButton';
import { FormValues } from '@/components/CommentEditor';
import { useRiskClassificationScores } from '@/utils/risk-levels';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import {
  ActivityLogFilterParams,
  DEFAULT_ACTIVITY_LOG_PARAMS,
} from '@/pages/case-management-item/CaseDetails';

interface Props {
  user: InternalConsumerUser | InternalBusinessUser;
  comments: {
    handleAddComment: (commentFormValues: FormValues) => Promise<Comment>;
    onCommentAdded: (newComment: Comment, commentType: CommentType, personId?: string) => void;
  };
}

interface AliasMapping {
  [key: string]: string;
}

export default function UserActivityCard(props: Props) {
  const { user, comments } = props;
  const api = useApi({ debounce: 500 });
  const [users, _] = useUsers();
  const queryClient = useQueryClient();
  const riskClassificationValues = useRiskClassificationScores();

  const settings = useSettings();
  const configRiskLevelAliasArray = settings?.riskLevelAlias || [];

  const riskLevelAlias: AliasMapping = {};
  configRiskLevelAliasArray.forEach((entry) => {
    if (entry.level && entry.alias) {
      riskLevelAlias[entry.level] = entry.alias;
    }
  });

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
        message.success('Comment deleted successfully');
        queryClient.setQueryData<InternalConsumerUser | InternalBusinessUser>(
          USERS_ITEM(user.userId),
          (user) => {
            if (user == null) {
              return user;
            }
            return {
              ...user,
              comments: (user?.comments ?? []).filter((x) => x.id !== variables.commentId),
              shareHolders: (user as InternalBusinessUser).shareHolders?.map((shareHolder) => {
                return {
                  ...shareHolder,
                  attachments: shareHolder.attachments?.filter(
                    (attachment) => attachment.id !== variables.commentId,
                  ),
                };
              }),
              directors: (user as InternalBusinessUser).directors?.map((director) => {
                return {
                  ...director,
                  attachments: director.attachments?.filter(
                    (attachment) => attachment.id !== variables.commentId,
                  ),
                };
              }),
              attachments: user.attachments?.filter(
                (attachment) => attachment.id != variables.commentId,
              ),
            };
          },
        );
      },
      onError: (e) => {
        console.error(e);
        message.error('Unable to delete comment');
      },
    },
  );

  return (
    <ActivityCard<ActivityLogFilterParams>
      defaultActivityLogParams={DEFAULT_ACTIVITY_LOG_PARAMS}
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
            entityIdExactMatch: true,
          });

          return getLogData(response.data, users, 'CASE', riskClassificationValues, riskLevelAlias);
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
        writeResources: ['write:::users/user-comments/*'],
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
  riskLevelAlias: AliasMapping,
): LogItemData[] => {
  const logItemData: LogItemData[] = logs
    .map((log, index) => {
      let currentUser: Account | null = null;
      if (log?.user?.id && users[log?.user?.id]) {
        currentUser = users[log?.user?.id];
      }
      const getIcon = (type: string) => {
        return type === 'CASE' ? (
          <CaseIcon width={20} height={20} key={index} />
        ) : (
          <Avatar size="small" user={currentUser} key={index} />
        );
      };

      const createStatement = getCreateStatement(
        log,
        users,
        type,
        riskClassificationValues,
        riskLevelAlias,
      );
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
