import React from 'react';
import { Context as SettingsContext } from '../SettingsProvider';
import { Feature } from '@/apis';

interface Props {
  children: React.ReactNode;
  features?: Feature[];
}

export default function SettingsProviderMock_(props: Props) {
  const { children, features } = props;

  return (
    <SettingsContext.Provider
      value={{
        features: features ?? ['RULES_ENGINE_V8'],
        settings: {},
        reloadSettings: () => {},
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
