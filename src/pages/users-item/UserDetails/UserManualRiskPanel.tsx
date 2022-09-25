import { Form, message } from 'antd';
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

interface Props {
  userId: string;
}

export default function UserManualRiskPanel(props: Props) {
  const { userId } = props;
  const api = useApi();
  const [syncState, setSyncState] = useState<AsyncResource<ManualRiskAssignmentUserState>>(init());
  useEffect(() => {
    let isCanceled = false;
    setSyncState(loading());
    api
      .getPulseManualRiskAssignment({ userId })
      .then((result) => {
        if (isCanceled) {
          return;
        }
        setSyncState(success(result));
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
      />
    </Form.Item>
  );
}
