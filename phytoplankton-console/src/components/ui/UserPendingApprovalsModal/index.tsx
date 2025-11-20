import { Fragment, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Resource } from '@flagright/lib/utils';
import s from './index.module.less';
import { UserApproval, UserProposedChange, RiskLevel } from '@/apis';
import Modal from '@/components/library/Modal';
import Table from '@/components/library/Table';
import {
  all,
  AsyncResource,
  getOr,
  isLoading,
  isSuccess,
  loading,
  success,
} from '@/utils/asyncResource';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { UNKNOWN } from '@/components/library/Table/standardDataTypes';
import { useWorkflows, WorkflowItem } from '@/utils/api/workflows';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useCurrentUserId } from '@/utils/user-utils';
import Alert from '@/components/library/Alert';
import { notEmpty } from '@/utils/array';
import Button from '@/components/library/Button';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import {
  USER_CHANGES_PROPOSALS,
  USER_CHANGES_PROPOSALS_BY_ID,
  USERS_ITEM,
} from '@/utils/queries/keys';
import { PepStatusValue } from '@/pages/users-item/UserDetails/ScreeningDetails/PepStatus';
import ErrorBoundary from '@/components/utils/ErrorBoundary';
import Skeleton from '@/components/library/Skeleton';
import { dayjs } from '@/utils/dayjs';
import AccountTag from '@/components/AccountTag';
import { useRoles } from '@/utils/api/auth';
import { useCurrentUserRoleId } from '@/utils/role-utils';
import Tooltip from '@/components/library/Tooltip';
import { getRiskLevelLabel, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

interface CraProposalValue {
  riskLevel?: RiskLevel;
  isUpdatable?: boolean;
  releaseAt?: number;
}

interface PepStatusProposalValue {
  pepStatus?: string;
  sanctionsStatus?: boolean;
  adverseMediaStatus?: boolean;
}

type RowItem = UserProposedChange & { key: string; comment: string; author: string };

interface Props {
  userId: string;
  pendingProposalsRes: AsyncResource<UserApproval[]>;
  isOpen: boolean;
  onCancel: () => void;
  onSuccess?: () => void;
  requiredResources: Resource[];
}

export default function UserPendingApprovalsModal(props: Props) {
  const { userId, requiredResources, pendingProposalsRes, isOpen, onCancel, onSuccess } = props;

  const pendingProposals = getOr(pendingProposalsRes, []);
  const workflowsQueryResults = useWorkflows(
    'change-approval',
    pendingProposals.map((x) => x.workflowRef),
  );

  const workflowResArray: AsyncResource<WorkflowItem>[] = workflowsQueryResults.map((x) => x.data);
  const workflowsRes: AsyncResource<WorkflowItem[]> = all(workflowResArray);

  const errorsRes = useErrors(pendingProposalsRes, workflowsRes);

  const api = useApi();
  const queryClient = useQueryClient();
  const changeProposalMutation = useMutation<
    unknown,
    unknown,
    {
      proposalIds: number[];
      action: 'accept' | 'reject' | 'cancel';
    }
  >(
    async (vars) => {
      const { proposalIds, action } = vars;
      for (const proposalId of proposalIds) {
        await api.postUserApprovalProcess({
          userId: userId,
          id: proposalId.toString(),
          UserApprovalRequest: {
            action,
          },
        });
      }
    },
    {
      onSuccess: async (_, vars) => {
        const { action } = vars;
        let messageText = '';
        if (action === 'accept') {
          messageText = 'Changes accepted successfully!';
          await queryClient.invalidateQueries(USERS_ITEM(userId));
        } else if (action === 'reject') {
          messageText = 'Changes rejected!';
        } else if (action === 'cancel') {
          messageText = 'Changes cancelled!';
        }
        message.success(messageText);
        onCancel();
        await queryClient.invalidateQueries(USER_CHANGES_PROPOSALS());
        await queryClient.invalidateQueries(USER_CHANGES_PROPOSALS_BY_ID(userId));
        onSuccess?.();
      },
      onError: (e) => {
        message.fatal('Failed to perform an action on pending changes', e);
      },
    },
  );

  return (
    <Modal
      title={'Changes for approval'}
      width={'L'}
      hideOk={true}
      isOpen={isOpen}
      onCancel={onCancel}
      footerExtra={
        <>
          <Button
            type="PRIMARY"
            onClick={() => {
              changeProposalMutation.mutate({
                proposalIds: pendingProposals.map(({ id }) => id).filter(notEmpty),
                action: 'accept',
              });
            }}
            requiredResources={requiredResources}
            isDisabled={isSuccess(errorsRes) && errorsRes.value.some((x) => x.acceptBlocked)}
            isLoading={isLoading(errorsRes) || isLoading(changeProposalMutation.dataResource)}
          >
            Accept
          </Button>
          <Button
            type="DANGER"
            onClick={() => {
              changeProposalMutation.mutate({
                proposalIds: pendingProposals.map(({ id }) => id).filter(notEmpty),
                action: 'reject',
              });
            }}
            requiredResources={requiredResources}
            isDisabled={isSuccess(errorsRes) && errorsRes.value.some((x) => x.rejectBlocked)}
            isLoading={isLoading(errorsRes) || isLoading(changeProposalMutation.dataResource)}
          >
            Reject
          </Button>
          {isSuccess(errorsRes) &&
            pendingProposals.length > 0 &&
            !errorsRes.value.some((x) => x.cancelBlocked) && (
              <Tooltip
                title={
                  'As an author of this proposal, you can discard it until it passed the first approval step'
                }
              >
                <Button
                  type="DANGER"
                  onClick={() => {
                    changeProposalMutation.mutate({
                      proposalIds: pendingProposals.map(({ id }) => id).filter(notEmpty),
                      action: 'cancel',
                    });
                  }}
                  requiredResources={requiredResources}
                  isLoading={isLoading(changeProposalMutation.dataResource)}
                >
                  Discard
                </Button>
              </Tooltip>
            )}
        </>
      }
    >
      <div className={s.root}>
        <AsyncResourceRenderer resource={errorsRes}>
          {(errors) =>
            errors.map((x, i) => (
              <Fragment key={i}>
                {x.messages.map((message, j) => (
                  <Alert type={'WARNING'} key={j}>
                    {message}
                  </Alert>
                ))}
              </Fragment>
            ))
          }
        </AsyncResourceRenderer>
        <Skeleton res={pendingProposalsRes}>
          {(pendingProposals) => <ChangesDetails pendingProposals={pendingProposals} />}
        </Skeleton>
      </div>
    </Modal>
  );
}

/*
  Helpers
 */

const columnHelper = new ColumnHelper<RowItem>();
function useColumns() {
  const settings = useSettings();
  return useMemo(
    () => [
      columnHelper.simple<'field'>({
        key: 'field',
        title: 'Parameter',
        type: {
          render: (value) => <>{getFieldName(value as string)}</>,
        },
      }),
      columnHelper.simple<'value'>({
        key: 'value',
        title: 'New value',
        defaultWidth: 300,
        type: {
          ...UNKNOWN,
          render: (value, context) => {
            const { item } = context;

            const field = item.field as string;

            if (field === 'PepStatus') {
              return (
                <ErrorBoundary>
                  <PepStatusValue pepStatus={value} />
                </ErrorBoundary>
              );
            } else if (field === 'SanctionsStatus') {
              return <>{value === undefined ? '-' : value ? 'Yes' : 'No'}</>;
            } else if (field === 'AdverseMediaStatus') {
              return <>{value === undefined ? '-' : value ? 'Yes' : 'No'}</>;
            } else if (field === 'eoddDate') {
              const dateValue = item.value as number | string | null;
              if (!dateValue) {
                return <>{''}</>;
              }

              // If it's a timestamp (number or numeric string)
              if (!isNaN(Number(dateValue))) {
                return <>{dayjs(Number(dateValue)).format('DD MMM YYYY')}</>;
              }

              // If it's already a date string
              return <>{dayjs(dateValue).format('DD MMM YYYY')}</>;
            } else if (field === 'Cra') {
              return <>{getRiskLevelLabel(value, settings).riskLevelLabel}</>;
            } else if (field === 'CraLock') {
              return <>{value ? 'Unlocked' : 'Locked'}</>;
            } else if (field === 'CraLockReleaseAt') {
              const timestamp = value as number;
              if (!timestamp) {
                return <>-</>;
              }
              return <>{dayjs(timestamp).format('DD MMM YYYY, HH:mm')}</>;
            }

            return UNKNOWN.render(value, context);
          },
          defaultWrapMode: 'WRAP',
        },
      }),
      columnHelper.display({
        id: 'comment',
        title: 'Comment',
        render: (item) => {
          return <>{item.comment ?? '-'}</>;
        },
      }),
      columnHelper.display({
        id: 'author',
        title: 'Author',
        render: (item) => {
          return <AccountTag accountId={item.author} />;
        },
      }),
    ],
    [settings],
  );
}

function ChangesDetails(props: { pendingProposals: UserApproval[] }) {
  const { pendingProposals } = props;
  const columns = useColumns();
  return (
    <Table<RowItem>
      rowKey={'key'}
      columns={columns}
      data={{
        items: pendingProposals.flatMap(({ id, comment, createdBy, proposedChanges }) =>
          proposedChanges.flatMap((change, i) => {
            // Unwind CRA object into separate rows
            if (change.field === 'Cra') {
              const craValue = change.value as CraProposalValue;
              const rows: RowItem[] = [];

              if (craValue.riskLevel !== undefined) {
                rows.push({
                  field: 'Cra',
                  value: craValue.riskLevel,
                  key: `${id}_${i}_riskLevel`,
                  comment: comment,
                  author: createdBy,
                });
              }

              if (craValue.isUpdatable !== undefined) {
                rows.push({
                  field: 'CraLock',
                  value: craValue.isUpdatable,
                  key: `${id}_${i}_isUpdatable`,
                  comment: comment,
                  author: createdBy,
                });
              }

              if (craValue.releaseAt) {
                rows.push({
                  field: 'CraLockReleaseAt',
                  value: craValue.releaseAt,
                  key: `${id}_${i}_releaseAt`,
                  comment: comment,
                  author: createdBy,
                });
              }

              return rows;
            }

            // Unwind PEP status object into separate rows
            if (change.field === 'PepStatus') {
              const pepValue = change.value as PepStatusProposalValue;
              const rows: RowItem[] = [];

              if (pepValue.pepStatus !== undefined) {
                rows.push({
                  field: 'PepStatus',
                  value: pepValue.pepStatus,
                  key: `${id}_${i}_pepStatus`,
                  comment: comment,
                  author: createdBy,
                });
              }

              if (pepValue.sanctionsStatus !== undefined) {
                rows.push({
                  field: 'SanctionsStatus',
                  value: pepValue.sanctionsStatus,
                  key: `${id}_${i}_sanctionsStatus`,
                  comment: comment,
                  author: createdBy,
                });
              }

              if (pepValue.adverseMediaStatus !== undefined) {
                rows.push({
                  field: 'AdverseMediaStatus',
                  value: pepValue.adverseMediaStatus,
                  key: `${id}_${i}_adverseMediaStatus`,
                  comment: comment,
                  author: createdBy,
                });
              }

              return rows;
            }

            // Return other fields as-is
            return [
              {
                ...change,
                key: `${id}_${i}`,
                comment: comment,
                author: createdBy,
              },
            ];
          }),
        ),
      }}
      toolsOptions={false}
      pagination={false}
      rowHeightMode={'AUTO'}
    />
  );
}

function useErrors(
  pendingProposalsRes: AsyncResource<UserApproval[]>,
  workflowsRes: AsyncResource<WorkflowItem[]>,
): AsyncResource<
  {
    acceptBlocked: boolean;
    rejectBlocked: boolean;
    cancelBlocked: boolean;
    messages: string[];
  }[]
> {
  const currentUserId = useCurrentUserId();
  const currentUserRoleId = useCurrentUserRoleId();
  const { roles: rolesRes } = useRoles();

  return useMemo(() => {
    if (!isSuccess(pendingProposalsRes) || !isSuccess(workflowsRes) || !isSuccess(rolesRes.data)) {
      return loading();
    }
    const pendingProposals = pendingProposalsRes.value;
    const workflows = workflowsRes.value;
    const roles = rolesRes.data.value.items;

    return success(
      pendingProposals
        .map((pendingProposal, i) => {
          const workflow = workflows[i];
          if (workflow.workflowType !== 'change-approval') {
            throw new Error('Invalid workflow type');
          }
          const currentStepRoleId = workflow.approvalChain[pendingProposal.approvalStep ?? 0];
          const currentStepRoleName =
            roles.find((r) => r.id === currentStepRoleId)?.name ?? currentStepRoleId;
          const isRoleMatching = currentUserRoleId === currentStepRoleId;
          const isCurrentUserAuthor = currentUserId === pendingProposal.createdBy;
          if (isCurrentUserAuthor) {
            const isCancelUnavailable =
              pendingProposal.approvalStep != null && pendingProposal.approvalStep > 0;
            return {
              acceptBlocked: true,
              rejectBlocked: true,
              cancelBlocked: isCancelUnavailable,
              messages: [
                `Before your changes take effect, they need to be approved by a user with a "${currentStepRoleName}" role`,
                ...(isCancelUnavailable
                  ? [
                      'This proposal has already passed first approval step, it is not possible to discard it now',
                    ]
                  : []),
              ],
            };
          } else if (!isRoleMatching) {
            return {
              acceptBlocked: true,
              rejectBlocked: true,
              cancelBlocked: true,
              messages: [
                `You need to have a "${currentStepRoleName}" role to approve these changes`,
              ],
            };
          }
          return {
            acceptBlocked: false,
            rejectBlocked: false,
            cancelBlocked: true,
            messages: [],
          };
        })
        .filter(notEmpty),
    );
  }, [pendingProposalsRes, workflowsRes, currentUserId, currentUserRoleId, rolesRes.data]);
}

function getFieldName(field: string): string {
  switch (field) {
    case 'Cra':
      return 'CRA level';
    case 'CraLock':
      return 'CRA lock status';
    case 'CraLockReleaseAt':
      return 'CRA auto-unlock';
    case 'eoddDate':
      return 'EODD';
    case 'PepStatus':
      return 'PEP status';
    case 'SanctionsStatus':
      return 'Sanctions status';
    case 'AdverseMediaStatus':
      return 'Adverse media status';
    default:
      return field;
  }
}
