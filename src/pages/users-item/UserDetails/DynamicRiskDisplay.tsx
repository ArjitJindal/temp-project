import { Spin, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { useApi } from '@/api';
import { DrsScore } from '@/apis';

interface Props {
  userId: string;
}

export default function DynamicRiskDisplay({ userId }: Props) {
  const api = useApi();

  const [syncState, setSyncState] = useState<DrsScore>();
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isCanceled = false;
    api
      .getDrsValue({ userId })
      .then((result: any) => {
        if (isCanceled) {
          return;
        }
        setSyncState(result);
        setLoading(false);
      })
      .catch((e) => {
        if (isCanceled) {
          return;
        }
        setLoading(false);
        console.error(e);
      });
    return () => {
      isCanceled = true;
    };
  }, [userId, api]);

  return (
    <Tag>
      {loading ? (
        <Spin />
      ) : syncState && syncState.drsScore ? (
        syncState.drsScore.toFixed(4)
      ) : (
        'N / A'
      )}
    </Tag>
  );
}
