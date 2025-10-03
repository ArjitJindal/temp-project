import { useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
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
  USER_CHANGES_PROPOSALS,
  USER_CHANGES_PROPOSALS_BY_ID,
  ROLE,
  PERMISSIONS,
} from '@/utils/queries/keys';
import {
  InternalConsumerUser,
  InternalBusinessUser,
  AllUsersTableItemPreview,
  UserType,
  AccountRole,
  DrsScore,
} from '@/apis';
import { QueryResult } from '@/utils/queries/types';
import { AsyncResource, getOr } from '@/utils/asyncResource';
import { WorkflowChangesStrategy } from '@/hooks/api/workflows';
import { UserUpdateRequest } from '@/apis/models/UserUpdateRequest';
import { message } from '@/components/library/Message';
import type { UserApprovalUpdateRequest } from '@/apis';

export function useUsersUniques(
  field: any,
  params?: { filter?: string },
  options?: { enabled?: boolean },
) {
  const api = useApi();
  return useQuery(
    USERS_UNIQUES(field, params ?? {}),
    async () => {
      return await api.getUsersUniques({ field, ...(params ?? {}) });
    },
    options,
  );
}

export function useUsersFind(search: string) {
  const api = useApi();
  return useQuery(USERS_FIND(search), async () => {
    if (search === '') {
      return { items: [] } as any;
    }
    return await api.getAllUsersList({
      filterName: search,
      pageSize: 20,
      responseType: 'data',
    });
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

export function useUserDrs(userId: string, options?: { enabled?: boolean }) {
  const api = useApi();
  return useQuery(USERS_ITEM_RISKS_DRS(userId), () => api.getDrsValue({ userId }), options);
}

export function useUserKrs(userId: string, options?: { enabled?: boolean }) {
  const api = useApi();
  return useQuery(USERS_ITEM_RISKS_KRS(userId), () => api.getKrsValue({ userId }), options);
}

export function usePulseRiskAssignment(userId: string) {
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
        ManualRiskAssignmentPayload: vars.payload as any,
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
    return result;
  });
}

export function useUserEntityLinkedChildren(userId: string | undefined, params?: unknown) {
  const api = useApi();
  return useQuery(USERS_ENTITY_LINKED_ENTITIES_CHILD(userId, params), async () => {
    const result = await api.getUserEntityChildUsers({ userId: userId ?? '', ...(params as any) });
    return result;
  });
}

export function useRole(roleId: string, options?: { enabled?: boolean }) {
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
