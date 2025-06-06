import { Tooltip } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import cn from 'clsx';
import { useQueryClient } from '@tanstack/react-query';
import s from './index.module.less';
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
import { USERS_ITEM_RISKS_DRS, USER_AUDIT_LOGS_LIST } from '@/utils/queries/keys';
import { DEFAULT_RISK_LEVEL } from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/RiskFactorConfigurationForm/RiskFactorConfigurationStep/ParametersTable/const';
import { useHasResources } from '@/utils/user-utils';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
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
  }, [userId, api, settings.userAlias]);

  const defaultRiskScore = useRiskScore(DEFAULT_RISK_LEVEL);
  const defaultRiskLevel =
    useRiskLevel(
      drsScore && drsScore.length ? drsScore[drsScore.length - 1].drsScore : defaultRiskScore,
    ) ?? undefined;
  const handleLockingAndUnlocking = () => {
    if (!canUpdateManualRiskLevel) {
      message.warn('You are not authorized to update the manual risk level');
      return;
    }
    setSyncState(loading(getOr(syncState, null)));
    api
      .pulseManualRiskAssignment({
        userId: userId,
        ManualRiskAssignmentPayload: {
          riskLevel: getOr(
            map(
              syncState,
              ({ manualRiskLevel, derivedRiskLevel }) => manualRiskLevel || derivedRiskLevel,
            ),
            defaultRiskLevel,
          ),
          isUpdatable: isLocked,
        },
      })
      .then(async (response) => {
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
      })
      .catch((e) => {
        console.error(e);
        setSyncState(failed(e instanceof Error ? e.message : 'Unknown error'));
        message.fatal('Unable to lock risk level!', e);
      });
  };

  const handleChangeRiskLevel = (newRiskLevel: RiskLevel | undefined) => {
    if (!canUpdateManualRiskLevel) {
      message.warn('You are not authorized to update the manual risk level');
      return;
    }
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
          message.success(`${firstLetterUpper(settings.userAlias)} risk updated successfully!`);
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
  };

  return (
    <div className={s.root}>
      <RiskLevelSwitch
        isDisabled={
          isLocked || isLoading(syncState) || isFailed(syncState) || !canUpdateManualRiskLevel
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
        onChange={handleChangeRiskLevel}
      />

      {isSuccess(queryResult.data) && (
        <Tooltip
          title={
            isLocked
              ? `Click here to unlock the assigned risk level. This lets the system automatically update the ${settings.userAlias} risk level again`
              : `Click here to lock ${settings.userAlias} risk level. This prevents the system from changing the ${settings.userAlias} risk level automatically.`
          }
          placement="bottomLeft"
          arrowPointAtCenter
        >
          {isLocked ? (
            <LockLineIcon className={cn(s.lockIcon)} onClick={handleLockingAndUnlocking} />
          ) : (
            <UnlockIcon className={cn(s.lockIcon)} onClick={handleLockingAndUnlocking} />
          )}
        </Tooltip>
      )}
    </div>
  );
}
