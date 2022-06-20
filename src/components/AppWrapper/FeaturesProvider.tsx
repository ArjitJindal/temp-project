import React, { useContext } from 'react';

interface Features {
  [key: string]: boolean;
}

interface ContextValue {
  features: Features;
}

const Context = React.createContext<ContextValue | null>(null);

export function FeaturesProvider(props: { initialFeatures: Features; children: React.ReactNode }) {
  return (
    <Context.Provider
      value={{
        features: props.initialFeatures,
      }}
    >
      {props.children}
    </Context.Provider>
  );
}

export function useFeaturesContext() {
  const context = useContext(Context);
  if (context == null) {
    throw new Error(`Features context is not initialized`);
  }
  return context;
}

export function useFeature(feature: string): boolean {
  const context = useFeaturesContext();
  return context.features[feature] ?? false;
}

export function Feature(props: { name: string; children: React.ReactNode }) {
  const isEnabled = useFeature(props.name);
  return isEnabled ? <>{props.children}</> : <></>;
}
