import React from 'react';
import { Context as SettingsContext } from '../SettingsProvider';

interface Props {
  children: React.ReactNode;
}

export default function SettingsProviderMock_(props: Props) {
  return (
    <SettingsContext.Provider
      value={{
        features: ['RULES_ENGINE_V8'],
        settings: {},
        reloadSettings: () => {},
      }}
    >
      {props.children}
    </SettingsContext.Provider>
  );
}
