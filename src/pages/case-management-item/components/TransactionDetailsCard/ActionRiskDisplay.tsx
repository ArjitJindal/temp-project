import { Spin, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { useApi } from '@/api';
import { ArsScore } from '@/apis';

interface Props {
  transactionId: string;
}

export default function ActionRiskDisplay({ transactionId }: Props) {
  const api = useApi();

  const [syncState, setSyncState] = useState<ArsScore>();
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isCanceled = false;
    api
      .getArsValue({ transactionId })
      .then((result: any) => {
        if (isCanceled) {
          return;
        }
        setSyncState(result);
        setLoading(false);
      })
      .catch((e: any) => {
        if (isCanceled) {
          return;
        }
        setLoading(false);
        console.error(e);
      });
    return () => {
      isCanceled = true;
    };
  }, [transactionId, api]);

  return (
    <Tag>
      {loading ? (
        <Spin />
      ) : syncState && syncState.arsScore ? (
        syncState.arsScore.toFixed(4)
      ) : (
        'N / A'
      )}
    </Tag>
  );
}
