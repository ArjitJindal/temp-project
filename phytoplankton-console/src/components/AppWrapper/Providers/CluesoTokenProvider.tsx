import { useSearchParams } from 'react-router-dom';
import React, { createContext, useEffect, useState } from 'react';
import { useApi } from '@/api';

interface Props {
  children: React.ReactNode;
}

export const CluesoContext = createContext('');

export default function CluesoTokenProvider(props: Props) {
  const api = useApi();
  const [params] = useSearchParams();
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    api.getCluesoAuthToken().then((clueso) => {
      clueso.token && setToken(clueso.token);
    });
  }, [api, params]);

  return <CluesoContext.Provider value={token}>{props.children}</CluesoContext.Provider>;
}
