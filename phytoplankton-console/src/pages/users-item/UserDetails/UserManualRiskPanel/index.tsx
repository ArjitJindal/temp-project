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
import { useQuery } from '@/utils/queries/hooks';
import {
  USER_AUDIT_LOGS_LIST,
  USER_CHANGES_PROPOSALS,
  USER_CHANGES_PROPOSALS_BY_ID,
  USERS_ITEM_RISKS_DRS,
} from '@/utils/queries/keys';
import { DEFAULT_RISK_LEVEL } from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/RiskFactorConfigurationForm/RiskFactorConfigurationStep/ParametersTable/const';
import { useHasResources } from '@/utils/user-utils';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useMutation } from '@/utils/queries/mutations/hooks';
import {
  useUserFieldChainDefined,
  useUserFieldChangesPendingApprovals,
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
    setSyncState(loading());
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

  const makeProposalCraRes = useUserFieldChainDefined('Cra');
  const makeProposalCraLockRes = useUserFieldChainDefined('CraLock');
  const makeProposalCra = getOr(makeProposalCraRes, false);
  const makeProposalCraLock = getOr(makeProposalCraLockRes, false);

  const pendingProposals = useUserFieldChangesPendingApprovals(userId, ['CraLock', 'Cra']);

  const lockingAndUnlockingMutation = useMutation<
    unknown,
    unknown,
    {
      isUpdatable: boolean;
      comment?: string;
    }
  >(async (vars) => {
    if (!canUpdateManualRiskLevel) {
      message.warn('You are not authorized to update the manual risk level');
      return;
    }

    if (makeProposalCraLock) {
      if (!vars.comment) {
        throw new Error(`Comment is required`);
      }
      await api.postUserApprovalProposal({
        userId: userId,
        UserApprovalUpdateRequest: {
          proposedChanges: [
            {
              field: 'CraLock',
              value: vars.isUpdatable,
            },
          ],
          comment: vars.comment,
        },
      });
      await queryClient.invalidateQueries(USER_CHANGES_PROPOSALS());
      await queryClient.invalidateQueries(USER_CHANGES_PROPOSALS_BY_ID(userId));
      return;
    }

    setSyncState(loading(getOr(syncState, null)));

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
        },
      });
      const userAlias = firstLetterUpper(settings.userAlias);
      if (isLocked) {
        message.success(`${userAlias} risk level unlocked successfully!`);
        setSyncState(success(response));
      } else {
        message.success(`${userAlias} risk level locked successfully!`);
        setSyncState(success(response));
      }
      setIsLocked(!isLocked);
      await queryClient.invalidateQueries(USER_AUDIT_LOGS_LIST(userId, {}));
    } catch (e) {
      console.error(e);
      setSyncState(failed(e instanceof Error ? e.message : 'Unknown error'));
      message.fatal('Unable to lock risk level!', e);
    }
  });

  const changeRiskLevelMutation = useMutation<
    unknown,
    unknown,
    {
      newRiskLevel: RiskLevel | undefined;
      comment?: string;
    }
  >(async (vars) => {
    const { newRiskLevel, comment } = vars;
    if (!canUpdateManualRiskLevel) {
      message.warn('You are not authorized to update the manual risk level');
      return;
    }
    if (makeProposalCra) {
      if (!comment) {
        throw new Error('Comment is required');
      }
      await api.postUserApprovalProposal({
        userId: userId,
        UserApprovalUpdateRequest: {
          proposedChanges: [
            {
              field: 'Cra',
              value: newRiskLevel,
            },
          ],
          comment: comment,
        },
      });
      await queryClient.invalidateQueries(USER_CHANGES_PROPOSALS());
      await queryClient.invalidateQueries(USER_CHANGES_PROPOSALS_BY_ID(userId));
      return;
    }
    // todo: if approval workflows are enabled, we should show a modal with a confirmation dialog
    if (!isLocked && newRiskLevel != null) {
      setSyncState(loading(getOr(syncState, null)));
      api
        .pulseManualRiskAssignment({
          userId: userId,
          ManualRiskAssignmentPayload: {
            riskLevel: newRiskLevel,
          },
        })
        .then(async (response) => {
          // todo: i18n
          message.success(`${firstLetterUpper(settings.userAlias)} risk updated successfully`);
          setSyncState(success(response));
          await queryClient.invalidateQueries(USER_AUDIT_LOGS_LIST(userId, {}));
        })
        .catch((e) => {
          console.error(e);
          // todo: i18n
          setSyncState(failed(e instanceof Error ? e.message : 'Unknown error'));
          message.fatal(`Unable to update ${settings.userAlias} risk level!`, e);
        });
    }
  });

  const lockedByPendingProposals =
    !isSuccess(pendingProposals) || pendingProposals.value.length > 0;

  return (
    <div className={s.root}>
      <Confirm<RiskLevel | undefined>
        title={'Changes request'}
        text={
          'These changes should be approved before they are applied. Please, lease a comment with the reason for the change.'
        }
        res={changeRiskLevelMutation.dataResource}
        skipConfirm={!makeProposalCra}
        commentRequired={true}
        requiredResources={[
          'write:::users/user-overview/*',
          'write:::users/user-manual-risk-levels/*',
        ]}
        onConfirm={({ comment, args }) => {
          changeRiskLevelMutation.mutate({
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
              isLoading(makeProposalCraRes) ||
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

      {isSuccess(queryResult.data) && (
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
              'These changes should be approved before they are applied. Please, lease a comment with the reason for the change.'
            }
            res={lockingAndUnlockingMutation.dataResource}
            skipConfirm={!makeProposalCraLock}
            commentRequired={true}
            onConfirm={({ args: isUpdatable, comment }) => {
              lockingAndUnlockingMutation.mutate({ isUpdatable, comment });
            }}
            requiredResources={[
              'write:::users/user-overview/*',
              'write:::users/user-manual-risk-levels/*',
            ]}
          >
            {({ onClick }) => {
              const isLockBuzy =
                isLoading(lockingAndUnlockingMutation.dataResource) ||
                isLoading(makeProposalCraLockRes);
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
                setSyncTrigger((x) => x + 1);
                queryClient.invalidateQueries(USERS_ITEM_RISKS_DRS(userId));
              }}
            />
          )}
        />
      )}
    </div>
  );
}
