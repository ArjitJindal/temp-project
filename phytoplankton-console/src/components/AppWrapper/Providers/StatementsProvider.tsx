import React, { createContext, useContext } from 'react';
import { PermissionStatements } from '@/apis';
import { useQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { PageLoading } from '@/components/PageLoading';
import { PERMISSIONS_STATEMENTS } from '@/utils/queries/keys';

interface StatementsContextValue {
  statements: PermissionStatements[];
}

export const StatementsContext = createContext<StatementsContextValue | undefined>(undefined);

export const useResources = () => {
  const context = useContext(StatementsContext);
  if (!context) {
    throw new Error('useResources must be used within a StatementsProvider');
  }
  return context;
};

export const StatementsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}): JSX.Element => {
  const api = useApi();

  const queryResult = useQuery(PERMISSIONS_STATEMENTS(), () => {
    return api.getRolesByNameStatements();
  });

  return (
    <AsyncResourceRenderer resource={queryResult.data} renderLoading={() => <PageLoading />}>
      {(statements) => (
        <StatementsContext.Provider value={{ statements }}>{children}</StatementsContext.Provider>
      )}
    </AsyncResourceRenderer>
  );
};

export default StatementsProvider;
