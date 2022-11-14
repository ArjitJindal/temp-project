import { Form, message, Tooltip } from 'antd';
import { useEffect, useState } from 'react';
import RiskLevelSwitch from '@/components/ui/RiskLevelSwitch';
import { useApi } from '@/api';
import { ManualRiskAssignmentUserState } from '@/apis';
import { RiskLevel } from '@/utils/risk-levels';
import {
  AsyncResource,
  failed,
  getOr,
  init,
  isFailed,
  isLoading,
  loading,
  map,
  success,
} from '@/utils/asyncResource';
import Button from '@/components/ui/Button';

interface Props {
  userId: string;
}

export default function UserManualRiskPanel(props: Props) {
  const { userId } = props;
  const api = useApi();
  const [isLocked, setIsLocked] = useState(false);
  const [syncState, setSyncState] = useState<AsyncResource<ManualRiskAssignmentUserState>>(init());
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
        message.error('Unable to get user risk level!');
      });
    return () => {
      isCanceled = true;
    };
  }, [userId, api]);

  const handleLockingAndUnlocking = () => {
    setIsLocked(!isLocked);
    setSyncState(loading(getOr(syncState, null)));
    api
      .pulseManualRiskAssignment({
        userId: userId,
        ManualRiskAssignmentPayload: {
          riskLevel: getOr(
            map(syncState, ({ riskLevel }) => riskLevel ?? undefined),
            undefined,
          ),
          isUpdatable: !isLocked,
        },
      })
      .then((response) => {
        message.success('User risk level locked successfully!');
        setSyncState(success(response));
      })
      .catch((e) => {
        console.error(e);
        setSyncState(failed(e instanceof Error ? e.message : 'Unknown error'));
        message.error('Unable to lock risk level!');
      });
  };

  const handleChangeRiskLevel = (newRiskLevel: RiskLevel) => {
    setSyncState(loading(getOr(syncState, null)));
    api
      .pulseManualRiskAssignment({
        userId: userId,
        ManualRiskAssignmentPayload: {
          riskLevel: newRiskLevel,
        },
      })
      .then((response) => {
        // todo: i18n
        message.success('User risk updates successfully!');
        setSyncState(success(response));
      })
      .catch((e) => {
        console.error(e);
        // todo: i18n
        setSyncState(failed(e instanceof Error ? e.message : 'Unknown error'));
        message.error('Unable to update user risk level!');
      });
  };

  return (
    <Form.Item name="field" style={{ margin: 0 }}>
      <RiskLevelSwitch
        disabled={isLoading(syncState) || isFailed(syncState)}
        current={getOr(
          map(syncState, ({ riskLevel }) => riskLevel ?? null),
          null,
        )}
        onChange={handleChangeRiskLevel}
      />{' '}
      <Tooltip
        title={
          isLocked
            ? 'Click here to unlock the assigned risk level. This lets the system automatically update the user risk level again'
            : 'Click here to lock user risk level. This prevents the system from changing the user risk level automatically.'
        }
      >
        <Button onClick={handleLockingAndUnlocking}>{isLocked ? 'Unlock' : 'Lock'}</Button>
      </Tooltip>
    </Form.Item>
  );
}
