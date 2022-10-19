import { Spin, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { useApi } from '@/api';
import { KrsScore } from '@/apis';

interface Props {
  userId: string;
}

export default function KycRiskDisplay({ userId }: Props) {
  const api = useApi();

  const [syncState, setSyncState] = useState<KrsScore>();
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isCanceled = false;
    api
      .getKrsValue({ userId })
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

  return <Tag>{loading ? <Spin /> : syncState ? syncState.krsScore : 'N / A'}</Tag>;
}
