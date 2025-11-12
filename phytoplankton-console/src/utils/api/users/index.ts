import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Updater } from '@tanstack/react-table';
import {
  USERS_FIND,
  USERS_ITEM,
  USERS_ITEM_RISKS_DRS,
  USERS_ITEM_RISKS_KRS,
  USERS_ENTITY_LINKED_ENTITIES_PARENT,
  USERS_UNIQUES,
  USERS_ENTITY_LINKED_ENTITIES_CHILD,
  USER_EVENTS_LIST,
  USER_CHANGES_PROPOSALS,
  USER_CHANGES_PROPOSALS_BY_ID,
  USER_FIELDS_CHANGES_PROPOSALS,
  USER_TRS_RISK_SCORES,
} from '@/utils/queries/keys';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import { UsersUniquesField } from '@/apis/models/UsersUniquesField';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { CommonParams } from '@/components/library/Table/types';
import {
  InternalBusinessUser,
  InternalConsumerUser,
  SortOrder,
  UserType,
  WorkflowSettingsUserApprovalWorkflows,
} from '@/apis';
import { success } from '@/utils/asyncResource';

export const useUsersUniques = (field: UsersUniquesField, filter?: string) => {
  const api = useApi();
  return useQuery(USERS_UNIQUES(field, { filter }), async () => {
    return await api.getUsersUniques({ field, filter });
  });
};

export const useUsersFind = ({
  search,
  userType,
  filterType,
}: {
  search: string;
  userType?: UserType;
  filterType?: 'id' | 'name';
}) => {
  const api = useApi();
  return useQuery(
    USERS_FIND(search, { userType, filterType }),
    async () => {
      const users = await api.getAllUsersPreviewList({
        ...(filterType === 'name' && { filterName: search }),
        ...(filterType === 'id' && { filterId: search }),
        ...(userType && { filterUserType: userType }),
        includeCasesCount: true,
      });
      return {
        total: users.count,
        users: users.items,
      };
    },
    {
      enabled: !!search,
    },
  );
};

export const useUserDetails = (userId: string) => {
  const api = useApi();
  return useQuery<InternalConsumerUser | InternalBusinessUser>(
    USERS_ITEM(userId),
    () => {
      return api.getUsersItem({ userId });
    },
    {
      enabled: !!userId,
    },
  );
};

export const useUserDrsRiskScore = (userId: string) => {
  const api = useApi();
  const isRiskScoringEnabled = useFeatureEnabled('RISK_SCORING');

  return useQuery(
    USERS_ITEM_RISKS_DRS(userId),
    () => {
      return api.getDrsValue({ userId });
    },
    {
      enabled: isRiskScoringEnabled && !!userId,
    },
  );
};

export const useUserKrsRiskScore = (userId: string) => {
  const api = useApi();
  const isRiskScoringEnabled = useFeatureEnabled('RISK_SCORING');

  return useQuery(
    USERS_ITEM_RISKS_KRS(userId),
    () => {
      return api.getKrsValue({ userId });
    },
    {
      enabled: isRiskScoringEnabled && !!userId,
    },
  );
};

export const useUserTrsRiskScore = (userId: string) => {
  const api = useApi();
  return useQuery(USER_TRS_RISK_SCORES(userId), () => api.getTrsScores({ userId }), {
    enabled: !!userId,
  });
};

export const useUserEntityLinkedEntitiesParent = (userId: string) => {
  const api = useApi();
  return useQuery(
    USERS_ENTITY_LINKED_ENTITIES_PARENT(userId),
    async () => {
      const result = await api.getUserEntityParentUser({
        userId,
      });
      return {
        items: result,
        total: result.length,
      };
    },
    {
      enabled: !!userId,
    },
  );
};

export const useUserEntityLinkedEntitiesChild = (userId: string, params: CommonParams) => {
  const api = useApi();
  return usePaginatedQuery(USERS_ENTITY_LINKED_ENTITIES_CHILD(userId, params), async (_) => {
    const result = await api.getUserEntityChildUsers({
      userId,
      page: params.page,
      pageSize: params.pageSize,
    });
    return {
      items: result.items,
      total: result.count,
    };
  });
};

export const useUserEventsList = (userId: string, params: CommonParams) => {
  const api = useApi();
  return useQuery(
    USER_EVENTS_LIST({ userId, params }),
    async () => {
      return await api.getEventsList({
        userId,
        page: params.page,
        pageSize: params.pageSize,
        sortField: params.sort[0]?.[0],
        sortOrder: params.sort[0]?.[1] as SortOrder,
      });
    },
    {
      enabled: !!userId,
    },
  );
};

export const useUserApprovalProposals = () => {
  const api = useApi();
  const isApprovalWorkflowsEnabled = useFeatureEnabled('USER_CHANGES_APPROVAL');

  const queryResult = useQuery(USER_CHANGES_PROPOSALS(), () => api.getAllUserApprovalProposals(), {
    enabled: isApprovalWorkflowsEnabled,
  });

  if (!isApprovalWorkflowsEnabled) {
    return {
      data: success([]),
      refetch: queryResult.refetch,
    };
  }

  return queryResult;
};

export const useUserApprovalProposalsById = (userId: string) => {
  const api = useApi();
  const isApprovalWorkflowsEnabled = useFeatureEnabled('USER_CHANGES_APPROVAL');

  const queryResult = useQuery(
    USER_CHANGES_PROPOSALS_BY_ID(userId),
    () => api.getUserApprovalProposals({ userId }),
    {
      enabled: isApprovalWorkflowsEnabled && !!userId,
    },
  );

  if (!isApprovalWorkflowsEnabled) {
    return {
      data: success([]),
      refetch: queryResult.refetch,
    };
  }

  return queryResult;
};

export const useUserChangesPendingApprovals = (
  userId: string,
  fields: (keyof WorkflowSettingsUserApprovalWorkflows)[],
) => {
  const api = useApi();
  const isApprovalWorkflowsEnabled = useFeatureEnabled('USER_CHANGES_APPROVAL');

  const queryResult = useQuery(
    USER_FIELDS_CHANGES_PROPOSALS(
      userId,
      fields.map((x) => `${x}`),
    ),
    async () => {
      const approvals = await api.getUserApprovalProposals({
        userId,
      });
      return approvals.filter((approval) =>
        approval.proposedChanges.some((change) =>
          fields.includes(change.field as keyof WorkflowSettingsUserApprovalWorkflows),
        ),
      );
    },
    {
      enabled: isApprovalWorkflowsEnabled && !!userId,
    },
  );

  if (!isApprovalWorkflowsEnabled) {
    return {
      data: success([]),
      refetch: queryResult.refetch,
    };
  }

  return queryResult;
};

export const useUserUpdates = () => {
  const queryClient = useQueryClient();

  const updateUserQueryData = useCallback(
    (userId: string, updater: Updater<InternalConsumerUser | InternalBusinessUser | undefined>) => {
      queryClient.setQueryData<InternalConsumerUser | InternalBusinessUser | undefined>(
        USERS_ITEM(userId),
        updater,
      );
    },
    [queryClient],
  );

  return { updateUserQueryData };
};
