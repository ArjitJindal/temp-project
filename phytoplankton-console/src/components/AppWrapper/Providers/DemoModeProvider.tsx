import React, { useContext, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { message } from '@/components/library/Message';
import { clearAuth0LocalStorage, useAuth0User } from '@/utils/user-utils';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useApi } from '@/api';
import { AsyncResource, failed, loading, success } from '@/utils/asyncResource';

interface DemoModeContextValue {
  isDemoMode: AsyncResource<boolean>;
  switch: (value: boolean) => void;
}

const Context = React.createContext<DemoModeContextValue | null>(null);

export function useDemoMode(): [AsyncResource<boolean>, (value: boolean) => void] {
  const isDemoModeAvailable = useFeatureEnabled('DEMO_MODE');
  const context = useContext(Context);

  if (!isDemoModeAvailable) {
    return [success(false), () => {}];
  }

  if (context == null) {
    throw new Error(`Demo mode context is not initialized`);
  }

  return [context.isDemoMode, context.switch];
}

export default function DemoModeProvider(props: { children: React.ReactNode }) {
  const user = useAuth0User();
  const [isDemoMode, setDemoMode] = useState<AsyncResource<boolean>>(success(user.demoMode));
  const api = useApi();

  const mutation = useMutation<unknown, unknown, { demoMode: boolean }>(
    async (event) => {
      await api.accountChangeSettings({
        accountId: user.userId,
        AccountSettings: {
          demoMode: event.demoMode,
        },
      });
    },
    {
      onSuccess: (data, variables) => {
        setDemoMode(success(variables.demoMode));
        clearAuth0LocalStorage();
        // todo: instead of reloading page we need to refresh auth0 token and invalidate data in react-query
        window.location.reload();
      },
      onError: (err, variables) => {
        console.error(err);
        message.fatal(`Unable to switch demo mode!`, err);
        setDemoMode(failed(`Unable to switch demo mode!`, variables.demoMode));
      },
    },
  );

  const value = useMemo(
    () => ({
      isDemoMode,
      switch: (value: boolean) => {
        setDemoMode(loading(value));
        mutation.mutate({ demoMode: value });
      },
    }),
    [isDemoMode, setDemoMode, mutation],
  );
  return <Context.Provider value={value}>{props.children}</Context.Provider>;
}
