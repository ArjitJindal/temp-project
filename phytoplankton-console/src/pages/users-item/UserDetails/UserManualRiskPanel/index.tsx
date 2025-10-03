import { useEffect, useMemo, useState } from 'react';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import cn from 'clsx';
import { useQueryClient } from '@tanstack/react-query';
import s from './index.module.less';
import Tooltip from '@/components/library/Tooltip';
import RiskLevelSwitch from '@/components/library/RiskLevelSwitch';
import { useApi } from '@/api';
import { RiskLevel, useRiskLevel, useRiskScore } from '@/utils/risk-levels';
import { message } from '@/components/library/Message';
import {
  AsyncResource,
  failed,
  getOr,
  init,
  isFailed,
  isLoading,
  isSuccess,
  loading,
  map,
  success,
} from '@/utils/asyncResource';
import { DrsScore } from '@/apis';
import LockLineIcon from '@/components/ui/icons/Remix/system/lock-line.react.svg';
import UnlockIcon from '@/components/ui/icons/Remix/system/lock-unlock-line.react.svg';
import {
  usePulseManualRiskAssignment,
  usePulseRiskAssignment,
  useUserDrs,
  usePostUserApprovalProposalMutation,
} from '@/hooks/api/users';
import {
  USER_AUDIT_LOGS_LIST,
  USER_CHANGES_PROPOSALS,
  USER_CHANGES_PROPOSALS_BY_ID,
} from '@/utils/queries/keys';
import { DEFAULT_RISK_LEVEL } from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/RiskFactorConfigurationForm/RiskFactorConfigurationStep/ParametersTable/const';
import { useHasResources } from '@/utils/user-utils';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useMutation } from '@/utils/queries/mutations/hooks';
import {
  useUserFieldChangesPendingApprovals,
  useUserFieldChangesStrategy,
  WorkflowChangesStrategy,
} from '@/hooks/api/workflows';
import PendingApprovalTag from '@/components/library/Tag/PendingApprovalTag';
import { CY_LOADING_FLAG_CLASS } from '@/utils/cypress';
import UserPendingApprovalsModal from '@/components/ui/UserPendingApprovalsModal';
import Confirm from '@/components/utils/Confirm';

interface Props {
  userId: string;
}

export default function UserManualRiskPanel(props: Props) {
  const { userId } = props;
  const _api = useApi();
  const [isLocked, setIsLocked] = useState(false);
  const queryResult = useUserDrs(userId);
  const pulseAssignmentQuery = usePulseRiskAssignment(userId);
  const postUserApprovalProposal = usePostUserApprovalProposalMutation();
  const manualRiskAssignment = usePulseManualRiskAssignment();
  const settings = useSettings();
  const canUpdateManualRiskLevel = useHasResources(['write:::users/user-manual-risk-levels/*']);
  const drsScore = useMemo(() => {
    if (isSuccess(queryResult.data)) {
      return queryResult.data.value;
    }
    return undefined;
  }, [queryResult.data]);

  const queryClient = useQueryClient();
  const [syncState, setSyncState] = useState<AsyncResource<DrsScore>>(init());
  useEffect(() => {
    setSyncState(pulseAssignmentQuery.data);
    if (isSuccess(pulseAssignmentQuery.data)) {
      setIsLocked(!pulseAssignmentQuery.data.value.isUpdatable);
    }
  }, [pulseAssignmentQuery.data]);

  const defaultRiskScore = useRiskScore(DEFAULT_RISK_LEVEL);
  const defaultRiskLevel =
    useRiskLevel(
      drsScore && drsScore.length ? drsScore[drsScore.length - 1].drsScore : defaultRiskScore,
    ) ?? undefined;

  const craChangesStrategyRes = useUserFieldChangesStrategy('Cra');
  const craLockChangesStrategyRes = useUserFieldChangesStrategy('CraLock');

  const pendingProposals = useUserFieldChangesPendingApprovals(userId, ['CraLock', 'Cra']);

  const lockingAndUnlockingMutation = useMutation<
    unknown,
    unknown,
    {
      changesStrategy: WorkflowChangesStrategy;
      isUpdatable: boolean;
      comment?: string;
    }
  >(async (vars) => {
    const { changesStrategy } = vars;
    if (!canUpdateManualRiskLevel) {
      message.warn('You are not authorized to update the manual risk level');
      return;
    }
    if (changesStrategy !== 'APPROVE') {
      setSyncState((syncState) => loading(getOr(syncState, null)));
    }
    if (changesStrategy === 'APPROVE' || changesStrategy === 'AUTO_APPROVE') {
      if (changesStrategy === 'APPROVE' && !vars.comment) {
        throw new Error(`Comment is required`);
      }
      const approvalResponse = await postUserApprovalProposal.mutateAsync({
        userId,
        changes: {
          proposedChanges: [
            {
              field: 'CraLock',
              value: vars.isUpdatable,
            },
          ],
          comment: vars.comment ?? '',
        },
      });

      if (approvalResponse.approvalStatus !== 'APPROVED') {
        await queryClient.invalidateQueries(USER_CHANGES_PROPOSALS());
        await queryClient.invalidateQueries(USER_CHANGES_PROPOSALS_BY_ID(userId));
        return;
      } else {
        pulseAssignmentQuery.refetch();
      }
    } else {
      try {
        const response = await manualRiskAssignment.mutateAsync({
          userId,
          payload: {
            riskLevel: getOr(
              map(
                syncState,
                ({ manualRiskLevel, derivedRiskLevel }) => manualRiskLevel || derivedRiskLevel,
              ),
              defaultRiskLevel,
            ),
            isUpdatable: vars.isUpdatable,
          },
        });
        setSyncState(success(response));
        pulseAssignmentQuery.refetch();
      } catch (e) {
        console.error(e);
        setSyncState(failed(e instanceof Error ? e.message : 'Unknown error'));
        message.fatal('Unable to lock risk level!', e);
      }
    }

    const userAlias = firstLetterUpper(settings.userAlias);
    if (isLocked) {
      message.success(`${userAlias} risk level unlocked successfully!`);
    } else {
      message.success(`${userAlias} risk level locked successfully!`);
    }
    setIsLocked(!isLocked);
    await queryClient.invalidateQueries(USER_AUDIT_LOGS_LIST(userId, {}));
  });

  const changeRiskLevelMutation = useMutation<
    unknown,
    unknown,
    {
      changesStrategy: WorkflowChangesStrategy;
      newRiskLevel: RiskLevel | undefined;
      comment?: string;
    }
  >(async (vars) => {
    const { changesStrategy, newRiskLevel, comment } = vars;
    if (!canUpdateManualRiskLevel) {
      message.warn('You are not authorized to update the manual risk level');
      return;
    }
    if (changesStrategy !== 'APPROVE') {
      setSyncState((syncState) => loading(getOr(syncState, null)));
    }

    try {
      if (changesStrategy !== 'DIRECT') {
        if (changesStrategy !== 'AUTO_APPROVE' && !comment) {
          throw new Error('Comment is required');
        }
        const approvalResponse = await postUserApprovalProposal.mutateAsync({
          userId,
          changes: {
            proposedChanges: [
              {
                field: 'Cra',
                value: newRiskLevel,
              },
            ],
            comment: comment ?? '',
          },
        });
        if (approvalResponse.approvalStatus !== 'APPROVED') {
          await queryClient.invalidateQueries(USER_CHANGES_PROPOSALS());
          await queryClient.invalidateQueries(USER_CHANGES_PROPOSALS_BY_ID(userId));
        } else {
          pulseAssignmentQuery.refetch();
        }
      } else {
        const response = await manualRiskAssignment.mutateAsync({
          userId,
          payload: {
            riskLevel: newRiskLevel,
          },
        });
        setSyncState(success(response));
        pulseAssignmentQuery.refetch();
      }
      if (changesStrategy !== 'APPROVE') {
        message.success(`${firstLetterUpper(settings.userAlias)} risk updated successfully`);
        await queryClient.invalidateQueries(USER_AUDIT_LOGS_LIST(userId, {}));
      }
    } catch (e) {
      console.error(e);
      if (changesStrategy !== 'APPROVE') {
        setSyncState(failed(e instanceof Error ? e.message : 'Unknown error'));
        message.fatal(`Unable to update ${settings.userAlias} risk level!`, e);
      } else {
        message.fatal(`Unable to create a changes proposal!`, e);
      }
    }
  });

  const lockedByPendingProposals =
    !isSuccess(pendingProposals) || pendingProposals.value.length > 0;

  return (
    <div className={s.root}>
      <Confirm<RiskLevel | undefined>
        title={'Changes request'}
        text={
          'These changes should be approved before they are applied. Please, add a comment with the reason for the change.'
        }
        res={changeRiskLevelMutation.dataResource}
        skipConfirm={getOr(craChangesStrategyRes, 'DIRECT') !== 'APPROVE'}
        commentRequired={true}
        requiredResources={[
          'write:::users/user-overview/*',
          'write:::users/user-manual-risk-levels/*',
        ]}
        onConfirm={({ comment, args }) => {
          changeRiskLevelMutation.mutate({
            changesStrategy: getOr(craChangesStrategyRes, 'DIRECT'),
            newRiskLevel: args,
            comment,
          });
        }}
      >
        {({ onClick }) => (
          <RiskLevelSwitch
            isDisabled={
              isLocked ||
              isLoading(syncState) ||
              isLoading(craChangesStrategyRes) ||
              isFailed(syncState) ||
              !canUpdateManualRiskLevel ||
              lockedByPendingProposals
            }
            value={
              !isSuccess(queryResult.data)
                ? undefined
                : getOr(
                    map(
                      syncState,
                      ({ manualRiskLevel, derivedRiskLevel }) =>
                        manualRiskLevel || derivedRiskLevel || undefined,
                    ),
                    defaultRiskLevel,
                  )
            }
            onChange={onClick}
          />
        )}
      </Confirm>

      {isSuccess(queryResult.data) && isSuccess(craLockChangesStrategyRes) && (
        <Tooltip
          title={
            lockedByPendingProposals
              ? 'There are pending proposals to update the risk level'
              : isLocked
              ? `Click here to unlock the assigned risk level. This lets the system automatically update the ${settings.userAlias} risk level again`
              : `Click here to lock ${settings.userAlias} risk level. This prevents the system from changing the ${settings.userAlias} risk level automatically.`
          }
          placement="bottomLeft"
        >
          <Confirm<boolean>
            title={'Changes request'}
            text={
              'These changes should be approved before they are applied. Please, add a comment with the reason for the change.'
            }
            res={lockingAndUnlockingMutation.dataResource}
            skipConfirm={craLockChangesStrategyRes.value !== 'APPROVE'}
            commentRequired={true}
            onConfirm={({ args: isUpdatable, comment }) => {
              lockingAndUnlockingMutation.mutate({
                changesStrategy: craLockChangesStrategyRes.value,
                isUpdatable,
                comment,
              });
            }}
            requiredResources={[
              'write:::users/user-overview/*',
              'write:::users/user-manual-risk-levels/*',
            ]}
          >
            {({ onClick }) => {
              const isLockBuzy =
                isLoading(syncState) ||
                isLoading(lockingAndUnlockingMutation.dataResource) ||
                isLoading(craLockChangesStrategyRes);
              const classNames = cn(s.lockIcon, {
                [s.isLoading]: isLockBuzy,
                [s.isDisabled]: lockedByPendingProposals,
                [CY_LOADING_FLAG_CLASS]: isLockBuzy,
              });
              return isLocked ? (
                <LockLineIcon className={classNames} onClick={() => onClick(true)} />
              ) : (
                <UnlockIcon className={classNames} onClick={() => onClick(false)} />
              );
            }}
          </Confirm>
        </Tooltip>
      )}
      {isSuccess(pendingProposals) && pendingProposals.value.length > 0 && (
        <PendingApprovalTag
          renderModal={({ isOpen, setIsOpen }) => (
            <UserPendingApprovalsModal
              userId={userId}
              isOpen={isOpen}
              onCancel={() => {
                setIsOpen(false);
              }}
              pendingProposalsRes={pendingProposals}
              requiredResources={['write:::users/user-manual-risk-levels/*']}
              onSuccess={() => {
                pulseAssignmentQuery.refetch();
                queryClient.invalidateQueries(USER_AUDIT_LOGS_LIST(userId, {}));
              }}
            />
          )}
        />
      )}
    </div>
  );
}
