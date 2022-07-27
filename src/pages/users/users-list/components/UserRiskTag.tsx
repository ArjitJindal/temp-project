import { Form, message } from 'antd';
import { useEffect, useState } from 'react';
import RiskLevelTag from './RiskLevelTag';
import { useApi } from '@/api';
import { ManualRiskAssignmentUserState } from '@/apis';
import { RiskLevel } from '@/utils/risk-levels';
import { AsyncResource, failed, getOr, init, loading, map, success } from '@/utils/asyncResource';

interface Props {
  userId: string;
}

export default function UserRiskTag(props: Props) {
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
        setSyncState(failed(e instanceof Error ? e.message : 'Unknown error'));
      });
    return () => {
      isCanceled = true;
    };
  }, [userId, api]);

  return (
    <RiskLevelTag
      current={getOr(
        map(syncState, ({ riskLevel }) => riskLevel ?? null),
        null,
      )}
    />
  );
}
