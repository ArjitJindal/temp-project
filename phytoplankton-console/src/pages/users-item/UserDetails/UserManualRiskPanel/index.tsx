import { useEffect, useMemo, useState } from 'react';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import cn from 'clsx';
import { useQueryClient } from '@tanstack/react-query';
import s from './index.module.less';
import CraLockModal, { CraLockModalData } from './CraLockModal';
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
import { useQuery } from '@/utils/queries/hooks';
import {
  USER_AUDIT_LOGS_LIST,
  USER_CHANGES_PROPOSALS,
  USER_CHANGES_PROPOSALS_BY_ID,
  USERS_ITEM_RISKS_DRS,
} from '@/utils/queries/keys';
import { DEFAULT_RISK_LEVEL } from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/RiskFactorConfigurationForm/RiskFactorConfigurationStep/ParametersTable/const';
import { useHasResources } from '@/utils/user-utils';
import { useSettings, useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useMutation } from '@/utils/queries/mutations/hooks';
import {
  useUserFieldChangesPendingApprovals,
  useUserFieldChangesStrategy,
  WorkflowChangesStrategy,
} from '@/utils/api/workflows';
import PendingApprovalTag from '@/components/library/Tag/PendingApprovalTag';
import { CY_LOADING_FLAG_CLASS } from '@/utils/cypress';
import UserPendingApprovalsModal from '@/components/ui/UserPendingApprovalsModal';
import Confirm from '@/components/utils/Confirm';

interface Props {
  userId: string;
}

export default function UserManualRiskPanel(props: Props) {
  const { userId } = props;
  const api = useApi();
  const [isLocked, setIsLocked] = useState(false);
  const [isCraLockModalOpen, setIsCraLockModalOpen] = useState(false);
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<RiskLevel | undefined>();
  const [isUnifiedMode, setIsUnifiedMode] = useState(false); // Track modal mode

  // Feature flags
  const hasTimerFeature = useFeatureEnabled('CRA_LOCK_TIMER');
  const hasApprovalFeature = useFeatureEnabled('USER_CHANGES_APPROVAL');
  const queryResult = useQuery(USERS_ITEM_RISKS_DRS(userId), () => api.getDrsValue({ userId }));
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
  const [syncTrigger, setSyncTrigger] = useState(0);
  useEffect(() => {
    let isCanceled = false;
    setSyncState((syncState) => loading(getOr(syncState, null)));
    api
      .getPulseRiskAssignment({ userId })
      .then((result) => {
        if (isCanceled) {
          return;
        }

        setSyncState(success(result));
        setIsLocked(result ? !result.isUpdatable : false);
      })
      .catch((e) => {
        if (isCanceled) {
          return;
        }
        console.error(e);
        // todo: i18n
        setSyncState(failed(e instanceof Error ? e.message : 'Unknown error'));
        message.fatal(`Unable to get ${settings.userAlias} risk level`, e);
      });
    return () => {
      isCanceled = true;
    };
  }, [userId, api, settings.userAlias, syncTrigger]);

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
      releaseAt?: number;
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

      const proposedChanges = [
        {
          field: 'CraLock',
          value: vars.isUpdatable,
        },
      ];

      // Add releaseAt field if provided (for timer feature support)
      if (vars.releaseAt) {
        proposedChanges.push({
          field: 'CraLockReleaseAt',
          value: vars.releaseAt as any,
        });
      }

      const approvalResponse = await api.postUserApprovalProposal({
        userId: userId,
        UserApprovalUpdateRequest: {
          proposedChanges,
          comment: vars.comment ?? '',
        },
      });

      if (approvalResponse.approvalStatus !== 'APPROVED') {
        await queryClient.invalidateQueries(USER_CHANGES_PROPOSALS());
        await queryClient.invalidateQueries(USER_CHANGES_PROPOSALS_BY_ID(userId));
        return;
      } else {
        setSyncTrigger((x) => x + 1);
      }
    } else {
      try {
        const response = await api.pulseManualRiskAssignment({
          userId: userId,
          ManualRiskAssignmentPayload: {
            riskLevel: getOr(
              map(
                syncState,
                ({ manualRiskLevel, derivedRiskLevel }) => manualRiskLevel || derivedRiskLevel,
              ),
              defaultRiskLevel,
            ),
            isUpdatable: vars.isUpdatable,
            releaseAt: vars.releaseAt,
          },
        });
        setSyncState(success(response));
        const newIsLocked = !vars.isUpdatable; // Convert isUpdatable to isLocked state
        setIsLocked(newIsLocked);
      } catch (e) {
        console.error(e);
        setSyncState(failed(e instanceof Error ? e.message : 'Unknown error'));
        message.fatal('Unable to lock risk level!', e);
      }
    }

    // Handle success messages and state updates for direct operations only
    if (changesStrategy !== 'APPROVE') {
      const userAlias = firstLetterUpper(settings.userAlias);
      const newIsLocked = !vars.isUpdatable; // Convert isUpdatable to isLocked state

      if (newIsLocked) {
        message.success(`${userAlias} risk level locked successfully!`);
      } else {
        message.success(`${userAlias} risk level unlocked successfully!`);
      }
      await queryClient.invalidateQueries(USER_AUDIT_LOGS_LIST(userId, {}));
    }
  });

  const changeRiskLevelMutation = useMutation<
    unknown,
    unknown,
    {
      changesStrategy: WorkflowChangesStrategy;
      newRiskLevel: RiskLevel | undefined;
      comment?: string;
      releaseAt?: number; // For unified CRA + Lock behavior
    }
  >(async (vars) => {
    const { changesStrategy, newRiskLevel, comment, releaseAt } = vars;
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

        // Create proposals with both CRA risk level and lock changes
        const proposedChanges = [
          {
            field: 'Cra',
            value: newRiskLevel,
          },
        ];

        // Add CRA lock change for unified behavior (Scenarios 2 & 4)
        if (hasTimerFeature || hasApprovalFeature) {
          proposedChanges.push({
            field: 'CraLock',
            value: false as any, // Lock the CRA (isUpdatable: false)
          });

          // Add release time if provided (timer feature)
          if (releaseAt) {
            proposedChanges.push({
              field: 'CraLockReleaseAt',
              value: releaseAt as any,
            });
          }
        }

        const approvalResponse = await api.postUserApprovalProposal({
          userId: userId,
          UserApprovalUpdateRequest: {
            proposedChanges,
            comment: comment ?? '',
          },
        });
        if (approvalResponse.approvalStatus !== 'APPROVED') {
          await queryClient.invalidateQueries(USER_CHANGES_PROPOSALS());
          await queryClient.invalidateQueries(USER_CHANGES_PROPOSALS_BY_ID(userId));
        } else {
          setSyncTrigger((x) => x + 1);
        }
      } else {
        // Direct execution: Scenario 1 & 3
        const response = await api.pulseManualRiskAssignment({
          userId: userId,
          ManualRiskAssignmentPayload: {
            riskLevel: newRiskLevel,
            isUpdatable: false, // Always lock when setting CRA level
            releaseAt: releaseAt, // Include timer if provided
          },
        });
        setSyncState(success(response));
        const newIsLocked = true; // Always locked when setting risk level
        setIsLocked(newIsLocked);
      }
      if (changesStrategy !== 'APPROVE') {
        message.success(
          `${firstLetterUpper(settings.userAlias)} risk updated and locked successfully`,
        );
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

  // Extract lock data for the modal
  const lockData: CraLockModalData | undefined = useMemo(() => {
    if (!isSuccess(syncState)) {
      return undefined;
    }
    const drsData = syncState.value;

    return {
      lockedAt: drsData.lockedAt,
      lockExpiresAt: drsData.lockExpiresAt,
      currentRiskLevel: drsData.manualRiskLevel || drsData.derivedRiskLevel, // For unified mode
    };
  }, [syncState]);

  // Handle modal confirmation for timer feature (lock-only or unified)
  const handleCraLockModalConfirm = async (data: {
    isUpdatable: boolean;
    comment: string;
    releaseAt?: number;
    riskLevel?: RiskLevel; // For unified mode
  }) => {
    if (isUnifiedMode) {
      // Unified mode: Change risk level + lock
      const craStrategy = getOr(craChangesStrategyRes, 'DIRECT');
      changeRiskLevelMutation.mutate({
        changesStrategy: craStrategy,
        newRiskLevel: data.riskLevel,
        comment: data.comment,
        releaseAt: data.releaseAt,
      });
    } else {
      // Lock-only mode
      const craLockStrategy = getOr(craLockChangesStrategyRes, 'DIRECT');
      lockingAndUnlockingMutation.mutate({
        changesStrategy: craLockStrategy,
        isUpdatable: data.isUpdatable,
        comment: data.comment,
        releaseAt: data.releaseAt,
      });
    }
    setIsCraLockModalOpen(false);
  };

  return (
    <div className={s.root}>
      <Confirm<RiskLevel | undefined>
        title={'Changes request'}
        text={
          'These changes should be approved before they are applied. Please, add a comment with the reason for the change.'
        }
        res={changeRiskLevelMutation.dataResource}
        skipConfirm={hasTimerFeature || getOr(craChangesStrategyRes, 'DIRECT') !== 'APPROVE'}
        commentRequired={true}
        requiredResources={[
          'write:::users/user-overview/*',
          'write:::users/user-manual-risk-levels/*',
        ]}
        onConfirm={({ comment, args }) => {
          // Route to different behaviors based on feature flags
          const selectedRiskLevel = args;

          // Scenario 3 & 4: Timer feature enabled -> Show unified modal
          if (hasTimerFeature) {
            setSelectedRiskLevel(selectedRiskLevel);
            setIsUnifiedMode(true); // Enable unified mode
            setIsCraLockModalOpen(true);
            return;
          }

          // Scenario 1 & 2: No timer feature -> Direct execution with auto-lock
          changeRiskLevelMutation.mutate({
            changesStrategy: getOr(craChangesStrategyRes, 'DIRECT'),
            newRiskLevel: selectedRiskLevel,
            comment,
            releaseAt: undefined, // No timer for scenarios 1 & 2
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
              const handleIconClick = () => {
                if (lockedByPendingProposals) {
                  return;
                }

                if (hasTimerFeature) {
                  // Scenario 3 or 4: Timer feature enabled - show modal
                  setIsUnifiedMode(false); // Lock-only mode
                  setIsCraLockModalOpen(true);
                } else {
                  // Scenario 1 or 2: No timer feature - use original confirm dialog
                  // The original confirm dialog already handles approval vs direct call
                  // When locked → user wants to unlock → send isUpdatable: true
                  // When unlocked → user wants to lock → send isUpdatable: false
                  onClick(isLocked);
                }
              };

              return isLocked ? (
                <LockLineIcon className={classNames} onClick={handleIconClick} />
              ) : (
                <UnlockIcon className={classNames} onClick={handleIconClick} />
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
                setSyncTrigger((x) => x + 1);
                queryClient.invalidateQueries(USERS_ITEM_RISKS_DRS(userId));
              }}
            />
          )}
        />
      )}

      {/* CRA Lock Modal - Supports both lock-only and unified mode */}
      {hasTimerFeature && (
        <CraLockModal
          isOpen={isCraLockModalOpen}
          onClose={() => setIsCraLockModalOpen(false)}
          onConfirm={handleCraLockModalConfirm}
          isLocked={isLocked}
          lockData={lockData}
          isLoading={isLoading(
            isUnifiedMode
              ? changeRiskLevelMutation.dataResource
              : lockingAndUnlockingMutation.dataResource,
          )}
          isUnifiedMode={isUnifiedMode}
          selectedRiskLevel={selectedRiskLevel}
        />
      )}
    </div>
  );
}
