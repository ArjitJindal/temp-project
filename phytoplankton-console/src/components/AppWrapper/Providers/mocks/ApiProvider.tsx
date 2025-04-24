import React from 'react';
import { ObjectDefaultApi as FlagrightApi } from '@/apis/types/ObjectParamAPI';
import { ApiContext } from '@/components/AppWrapper/Providers/ApiProvider';
import {
  MOCKED_ACCOUNTS,
  MOCKED_RULE_CONFIG,
} from '@/components/AppWrapper/Providers/mocks/mockedData';
import {
  Account,
  AccountRole,
  LogicConfig,
  Rule,
  RuleInstance,
  RuleQueuesResponse,
  SLAPoliciesResponse,
  AlertListResponse,
} from '@/apis';

interface Props {
  children: React.ReactNode;
}

const MOCK_API: FlagrightApi = new Proxy<FlagrightApi>({} as FlagrightApi, {
  get: (_target, prop) => {
    if (typeof prop !== 'string') {
      return _target[prop];
    }
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
    if (prop === 'getSlaPolicies') {
      return (): Promise<SLAPoliciesResponse> => {
        const result: SLAPoliciesResponse = {
          items: [],
          total: 0,
        };
        return Promise.resolve(result);
      };
    }
    if (prop === 'getLogicConfig') {
      return (): Promise<LogicConfig> => {
        return Promise.resolve(MOCKED_RULE_CONFIG as unknown as LogicConfig);
      };
    }
    if (prop === 'getRules') {
      return (): Promise<Array<Rule>> => {
        return Promise.resolve([]);
      };
    }
    if (prop === 'getRuleInstances') {
      return (): Promise<Array<RuleInstance>> => {
        return Promise.resolve([]);
      };
    }
    if (prop === 'getRulesWithAlerts') {
      return (): Promise<Array<string>> => {
        return Promise.resolve([]);
      };
    }
    if (prop === 'getRuleQueues') {
      return (): Promise<RuleQueuesResponse> => {
        return Promise.resolve({
          total: 0,
          data: [],
        });
      };
    }
    if (prop === 'getUsersUniques') {
      return (): Promise<Array<string>> => {
        return Promise.resolve([]);
      };
    }
    if (prop === 'getRoles') {
      return (): Promise<Array<AccountRole>> => {
        return Promise.resolve([]);
      };
    }
    if (prop === 'getAlertList') {
      return (): Promise<AlertListResponse> => {
        return Promise.resolve({
          total: 0,
          data: [],
        });
      };
    }
    throw new Error(
      `This is a mock Flagright internal API implementation used for storybook. It doesn't support '${String(
        prop,
      )}' function yet. If you need to use it in your story, you can extend mock to support it`,
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
