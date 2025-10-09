import { useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/api';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import { useMutation } from '@/utils/queries/mutations/hooks';
import {
  USERS_UNIQUES,
  USERS_FIND,
  USERS_ITEM,
  USERS_ITEM_RISKS_DRS,
  USERS_ITEM_RISKS_KRS,
  USERS_ENTITY_LINKED_ENTITIES_PARENT,
  USERS_ENTITY_LINKED_ENTITIES_CHILD,
  USER_AUDIT_LOGS_LIST,
  USER_EVENTS_LIST,
  USER_CHANGES_PROPOSALS,
  USER_CHANGES_PROPOSALS_BY_ID,
  ROLE,
  PERMISSIONS,
  USERS,
  USER_TRS_RISK_SCORES,
  ROLES_LIST,
  ACCOUNT_LIST,
} from '@/utils/queries/keys';
import {
  InternalConsumerUser,
  InternalBusinessUser,
  AllUsersTableItemPreview,
  UserType,
  AccountRole,
  SortOrder,
  DrsScore,
  AllUsersTableItem,
  UserApprovalUpdateRequest,
} from '@/apis';
import { QueryResult, QueryOptions } from '@/utils/queries/types';
import type { PaginatedData } from '@/utils/queries/hooks';
import { AsyncResource, getOr } from '@/utils/asyncResource';
import { WorkflowChangesStrategy, usePendingProposalsUserIds } from '@/hooks/api/workflows';
import { UserUpdateRequest } from '@/apis/models/UserUpdateRequest';
import { message } from '@/components/library/Message';
import { dayjs } from '@/utils/dayjs';
import type {
  Account,
  AccountDeletePayload,
  EDDReview,
  EDDReviewUpdateRequest,
  AllUsersOffsetPaginateListResponse,
} from '@/apis';

export function useUsersUniques(
  field: any,
  params?: { filter?: string },
  options?: QueryOptions<string[], string[]>,
): QueryResult<string[]> {
  const api = useApi();
  return useQuery<string[]>(
    USERS_UNIQUES(field, params ?? {}),
    async () => {
      const res = await api.getUsersUniques({ field, ...(params ?? {}) });
      return res as string[];
    },
    options,
  );
}

export function useUsersFind(search: string) {
  const api = useApi();
  return useQuery(USERS_FIND(search), async () => {
    if (search === '') {
      return { items: [] };
    }
    return await api.getAllUsersList({
      filterName: search,
      pageSize: 20,
      responseType: 'data',
    });
  });
}

export function useUsersByTimeRange(
  userType: 'CONSUMER' | 'BUSINESS',
  dateRange?: { startTimestamp?: number; endTimestamp?: number },
): QueryResult<AllUsersOffsetPaginateListResponse> {
  const api = useApi();
  const start = dateRange?.startTimestamp ?? 0;
  const end = dateRange?.endTimestamp ?? Date.now();
  return useQuery(USERS(userType, { start, end }), async () => {
    if (userType === 'CONSUMER') {
      return await api.getConsumerUsersList({ afterTimestamp: start, beforeTimestamp: end });
    } else {
      return await api.getBusinessUsersList({ afterTimestamp: start, beforeTimestamp: end });
    }
  });
}

export type UsersPreviewSearchResponse = {
  total: number;
  users: AllUsersTableItemPreview[];
};

export function useUsersPreviewSearch(
  search: string,
  userType?: UserType,
  filterType?: 'id' | 'name',
): QueryResult<UsersPreviewSearchResponse> {
  const api = useApi();
  return useQuery(
    ['users', 'preview', 'find', search, { userType, filterType }],
    async (): Promise<UsersPreviewSearchResponse> => {
      if (search === '') {
        return { total: 0, users: [] };
      }
      const users = await api.getAllUsersPreviewList({
        ...(filterType === 'name' && { filterName: search }),
        ...(filterType === 'id' && { filterId: search }),
        includeCasesCount: true,
        ...(userType && { filterUserType: userType }),
      });
      return { total: users.count, users: users.items };
    },
  );
}

export function useUserTrsScores(userId: string) {
  const api = useApi();
  return useQuery(USER_TRS_RISK_SCORES(userId), () => api.getTrsScores({ userId }));
}

// Accounts and roles
export function useRolesList(): QueryResult<{ items: AccountRole[]; total: number }> {
  const api = useApi();
  return useQuery(ROLES_LIST(), async () => {
    const roles = await api.getRoles();
    return { items: roles, total: roles.length };
  });
}

export function useAccountsList(): QueryResult<Account[]> {
  const api = useApi();
  return useQuery(
    ACCOUNT_LIST(),
    async () => {
      try {
        return await api.getAccounts();
      } catch (e) {
        console.error(e);
        return [];
      }
    },
    {
      staleTime: Infinity,
    },
  );
}

export function useUsersList(
  type: 'business' | 'consumer' | 'all',
  params: any,
  pendingProposalsUserIdsRes?: AsyncResource<string[] | undefined>,
): QueryResult<PaginatedData<AllUsersTableItem>> {
  const api = useApi({ debounce: 500 });
  const computedPendingRes = usePendingProposalsUserIds({
    pendingApproval: params?.pendingApproval,
  });
  const pendingRes = pendingProposalsUserIdsRes ?? computedPendingRes;
  return usePaginatedQuery<AllUsersTableItem>(
    USERS(type, { ...params, pendingProposalsUserIds: pendingRes }),
    async (paginationParams) => {
      const pendingProposalsUserIds = getOr(pendingRes, undefined);
      if (
        params?.pendingApproval === 'true' &&
        pendingProposalsUserIds != null &&
        pendingProposalsUserIds.length === 0
      ) {
        return { items: [], total: 0 };
      }

      const filterUserIds = pendingProposalsUserIds;

      const queryObj: any = {
        pageSize: params.pageSize,
        page: params.page,
        sortField: params.sort?.[0]?.[0],
        sortOrder: params.sort?.[0]?.[1] ?? 'ascend',
        afterTimestamp: params.createdTimestamp ? dayjs(params.createdTimestamp[0]).valueOf() : 0,
        beforeTimestamp: params.createdTimestamp
          ? dayjs(params.createdTimestamp[1]).valueOf()
          : undefined,
        filterId: filterUserIds == null ? params.userId : undefined,
        filterParentId: params.parentUserId,
        filterTagKey: params.tagKey,
        filterTagValue: params.tagValue,
        filterRiskLevel: params.riskLevels,
        filterRiskLevelLocked: params.riskLevelLocked,
        filterIsPepHit: params.isPepHit,
        filterPepCountry: params.pepCountry,
        filterPepRank: params.pepRank,
        filterCountryOfResidence: params.countryOfResidence,
        filterCountryOfNationality: params.countryOfNationality,
        filterUserState: params.userState,
        filterKycStatus: params.kycStatus,
        filterName: params.userName,
        filterIds: filterUserIds,
        ...paginationParams,
      };

      const response =
        type === 'business'
          ? await api.getBusinessUsersList({
              ...queryObj,
              filterUserRegistrationStatus: params.userRegistrationStatus,
              responseType: 'data',
            })
          : type === 'consumer'
          ? await api.getConsumerUsersList({
              ...queryObj,
              filterIsPepHit: params.isPepHit,
              responseType: 'data',
            })
          : await api.getAllUsersList({ ...queryObj, responseType: 'data' });

      const countResponse =
        type === 'business'
          ? await api.getBusinessUsersList({
              ...queryObj,
              filterUserRegistrationStatus: params.userRegistrationStatus,
              responseType: 'count',
            })
          : type === 'consumer'
          ? await api.getConsumerUsersList({
              ...queryObj,
              filterIsPepHit: params.isPepHit,
              responseType: 'count',
            })
          : await api.getAllUsersList({ ...queryObj, responseType: 'count' });

      return { total: countResponse.count, items: response.items };
    },
  );
}

export const useConsoleUser = (
  id?: string,
): QueryResult<InternalConsumerUser | InternalBusinessUser> => {
  const api = useApi();
  return useQuery<InternalConsumerUser | InternalBusinessUser>(USERS_ITEM(id), () => {
    if (id == null) {
      throw new Error(`Id is not defined`);
    }
    return api.getUsersItem({ userId: id });
  });
};

export function useUserDrs(userId: string, options?: QueryOptions) {
  const api = useApi();
  return useQuery(USERS_ITEM_RISKS_DRS(userId), () => api.getDrsValue({ userId }), options);
}

export function useUserKrs(userId: string, options?: QueryOptions) {
  const api = useApi();
  return useQuery(USERS_ITEM_RISKS_KRS(userId), () => api.getKrsValue({ userId }), options);
}

export function usePulseRiskAssignment(userId: string): QueryResult<DrsScore> {
  const api = useApi();
  return useQuery<DrsScore>(['pulse-risk-assignment', userId], () =>
    api.getPulseRiskAssignment({ userId }),
  );
}

export function usePulseManualRiskAssignment() {
  const api = useApi();
  return useMutation(
    (vars: { userId: string; payload: { riskLevel?: any; isUpdatable?: boolean } }) =>
      api.pulseManualRiskAssignment({
        userId: vars.userId,
        ManualRiskAssignmentPayload: vars.payload,
      }),
  );
}

export function usePostUserApprovalProposalMutation() {
  const api = useApi();
  return useMutation((vars: { userId: string; changes: UserApprovalUpdateRequest }) =>
    api.postUserApprovalProposal({ userId: vars.userId, UserApprovalUpdateRequest: vars.changes }),
  );
}

export function useProcessUserApprovalMutation() {
  const api = useApi();
  return useMutation(
    (vars: { userId: string; id: string; action: 'accept' | 'reject' | 'cancel' }) =>
      api.postUserApprovalProcess({
        userId: vars.userId,
        id: vars.id,
        UserApprovalRequest: { action: vars.action },
      }),
  );
}

export function useUserScreeningStatus(userId: string) {
  const api = useApi();
  return useQuery(['user-status', userId], async () => {
    return await api.getUserScreeningStatus({ userId });
  });
}

export function useUpdateConsumerUserMutation() {
  const api = useApi();
  return useMutation((vars: { userId: string; updates: UserUpdateRequest }) =>
    api.postConsumerUsersUserId({ userId: vars.userId, UserUpdateRequest: vars.updates }),
  );
}

export function useUserEntityLinkedParents(userId: string | undefined) {
  const api = useApi();
  return useQuery(USERS_ENTITY_LINKED_ENTITIES_PARENT(userId), async () => {
    const result = await api.getUserEntityParentUser({ userId: userId ?? '' });
    return { items: result, total: result.length };
  });
}

export function useUserEntityLinkedChildren(
  userId: string | undefined,
  params?: Record<string, any>,
) {
  const api = useApi();
  return useQuery(USERS_ENTITY_LINKED_ENTITIES_CHILD(userId, params), async () => {
    const result = await api.getUserEntityChildUsers({
      userId: userId ?? '',
      ...(params as Record<string, any>),
    });
    return result;
  });
}

export function useRole(roleId: string, options?: QueryOptions<AccountRole, AccountRole>) {
  const api = useApi();
  return useQuery<AccountRole>(ROLE(roleId), async () => api.getRole({ roleId }), options);
}

export function usePermissions(search: string) {
  const api = useApi();
  return useQuery(PERMISSIONS(search), async () => api.getAllPermissions({ search }));
}

export interface EoddFormValues {
  eoddDate: string;
}

export function useEODDChangeMutation(
  user: InternalConsumerUser | InternalBusinessUser,
  changeStrategyRes: AsyncResource<WorkflowChangesStrategy>,
) {
  const api = useApi();
  const queryClient = useQueryClient();

  const changeStrategy = getOr(changeStrategyRes, 'DIRECT');

  return useMutation(
    async (vars: { formValues: EoddFormValues; comment?: string }) => {
      const { formValues: values, comment } = vars;

      const dateTimestamp = values.eoddDate ? new Date(values.eoddDate).getTime() : 0;

      if (changeStrategy !== 'DIRECT') {
        const dismissLoading = message.loading(
          changeStrategy === 'AUTO_APPROVE' ? 'Updating EODD...' : 'Creating a proposal...',
        );
        try {
          if (changeStrategy === 'APPROVE' && !comment) {
            throw new Error(`Comment is required here`);
          }
          await api.postUserApprovalProposal({
            userId: user.userId,
            UserApprovalUpdateRequest: {
              proposedChanges: [
                {
                  field: 'eoddDate',
                  value: dateTimestamp,
                },
              ],
              comment: comment ?? '',
            },
          });
          if (changeStrategy === 'APPROVE') {
            await queryClient.invalidateQueries(USER_CHANGES_PROPOSALS());
            await queryClient.invalidateQueries(USER_CHANGES_PROPOSALS_BY_ID(user.userId));
          }
        } finally {
          dismissLoading();
        }
      } else {
        const messageLoading = message.loading('Updating EODD...');
        try {
          const payload: UserUpdateRequest = {
            eoddDate: dateTimestamp,
          };

          let updatedComment;
          if (user.type === 'CONSUMER') {
            updatedComment = await api.postConsumerUsersUserId({
              userId: user.userId,
              UserUpdateRequest: payload,
            });
          } else {
            updatedComment = await api.postBusinessUsersUserId({
              userId: user.userId,
              UserUpdateRequest: payload,
            });
          }
          return { eoddDate: values.eoddDate, updatedComment };
        } finally {
          messageLoading();
        }
      }
    },
    {
      onSuccess: async () => {
        if (changeStrategy === 'APPROVE') {
          message.success('Change proposal created successfully');
          await queryClient.invalidateQueries(USER_CHANGES_PROPOSALS());
          await queryClient.invalidateQueries(USER_CHANGES_PROPOSALS_BY_ID(user.userId));
        } else {
          message.success('EODD date updated successfully');
          await queryClient.invalidateQueries(USERS_ITEM(user.userId));
          await queryClient.invalidateQueries(USER_AUDIT_LOGS_LIST(user.userId, {}));
        }
      },
      onError: (error: Error) => {
        message.fatal(`Error updating EODD: ${error.message}`);
      },
    },
  );
}

// Accounts management
export function useResetAccountMfa(options?: Parameters<typeof useMutation>[1]) {
  const api = useApi();
  return useMutation<unknown, unknown, { userId: string }>(
    async (payload) => api.resetAccountMfa({ accountId: payload.userId }),
    options,
  );
}

export function useDeactivateAccount(
  options?: Parameters<
    typeof useMutation<Account, Error, { accountId: string; deactivate: boolean }>
  >[1],
) {
  const api = useApi();
  return useMutation<Account, Error, { accountId: string; deactivate: boolean }>(
    async (payload) =>
      api.accountsDeactivate({
        accountId: payload.accountId,
        InlineObject2: { deactivate: payload.deactivate },
      }),
    options,
  );
}

export function useDeleteAccount(
  options?: Parameters<
    typeof useMutation<unknown, unknown, AccountDeletePayload & { userId: string }>
  >[1],
) {
  const api = useApi();
  return useMutation<unknown, unknown, AccountDeletePayload & { userId: string }>(
    async (payload) =>
      api.accountsDelete({
        AccountDeletePayload: { reassignTo: payload.reassignTo },
        accountId: payload.userId,
      }),
    options,
  );
}

// EDD Reviews
export function useEddReviews(userId: string) {
  const api = useApi();
  return useQuery(['edd-reviews', userId], async () => {
    return await api.getUsersUserIdEddReviews({ userId });
  });
}

export function useEddReview(userId: string, eddId: string | null) {
  const api = useApi();
  return useQuery(
    ['edd-review', eddId],
    async () => await api.getUsersUserIdEddReviewsEddReviewId({ userId, eddReviewId: eddId ?? '' }),
    { enabled: !!eddId },
  );
}

export function usePatchEddReview(userId: string, getSelectedEddId: () => string | null) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation<EDDReview, unknown, EDDReviewUpdateRequest>(
    async (data) => {
      const eddId = getSelectedEddId();
      if (!eddId) {
        throw new Error('No EDD review selected');
      }
      const response = await api.patchUsersUserIdEddReviewsEddReviewId({
        userId,
        eddReviewId: eddId,
        EDDReviewUpdateRequest: data,
      });
      return response;
    },
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ['edd-reviews', userId] });
      },
    },
  );
}

export function useUserEvents(userId: string, params: any) {
  const api = useApi();
  return useQuery(USER_EVENTS_LIST({ userId, params }), async () => {
    return await api.getEventsList({
      userId,
      page: params.page,
      pageSize: params.pageSize,
      sortField: params.sort?.[0]?.[0],
      sortOrder: params.sort?.[0]?.[1] as SortOrder,
    });
  });
}
