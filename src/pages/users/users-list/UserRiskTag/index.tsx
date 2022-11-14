import React, { useEffect, useState } from 'react';
import RiskLevelTag from '@/components/ui/RiskLevelTag';
import { useApi } from '@/api';
import { ManualRiskAssignmentUserState } from '@/apis';
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
      .getPulseRiskAssignment({ userId })
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

  const level = getOr(
    map(syncState, ({ riskLevel }) => riskLevel ?? null),
    null,
  );

  return level ? <RiskLevelTag level={level} /> : <>-</>;
}
