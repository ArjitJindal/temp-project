import React from 'react';
import { ObjectDefaultApi as FlagrightApi } from '@/apis/types/ObjectParamAPI';
import { ApiContext } from '@/components/AppWrapper/Providers/ApiProvider';
import { MOCKED_ACCOUNTS } from '@/components/AppWrapper/Providers/mocks/mockedData';
import { Account } from '@/apis';

interface Props {
  children: React.ReactNode;
}

const MOCK_API: FlagrightApi = new Proxy<FlagrightApi>({} as FlagrightApi, {
  get: (_target, prop) => {
    if (prop === 'getAccounts') {
      return (): Promise<Account[]> => {
        return Promise.resolve(MOCKED_ACCOUNTS);
      };
    }
    if (prop === 'getQuestions') {
      return (): Promise<Account[]> => {
        return Promise.resolve([]);
      };
    }
    throw new Error(
      `This is a mock Flagright internal API implementation used for storybook. It doesn't support "${String(
        prop,
      )}" function yet. If you need to use it in your story, you can extend mock to support it`,
    );
  },
});

export default function ApiProviderMock_(props: Props) {
  return (
    <ApiContext.Provider
      value={{
        api: MOCK_API,
      }}
    >
      {props.children}
    </ApiContext.Provider>
  );
}
