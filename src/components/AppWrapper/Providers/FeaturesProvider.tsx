import React, { useContext, useEffect, useState } from 'react';
import { PageLoading } from '@ant-design/pro-layout';
import { useApi } from '@/api';
import { Feature as FeatureName } from '@/apis';

interface ContextValue {
  features: FeatureName[] | undefined;
}

const Context = React.createContext<ContextValue | null>(null);

export function FeaturesProvider(props: {
  globalFeatures?: FeatureName[];
  children: React.ReactNode;
}) {
  const api = useApi();
  const [features, setFeatures] = useState<FeatureName[] | undefined>(undefined);
  useEffect(() => {
    async function fetch() {
      const settings = await api.getTenantsSettings();
      setFeatures((settings.features || []).concat(props.globalFeatures || []));
    }
    fetch().catch((e) => {
      setFeatures([]);
      console.error(e);
    });
  }, [api, props.globalFeatures]);
  return (
    <Context.Provider value={{ features }}>
      {features ? props.children : <PageLoading />}
    </Context.Provider>
  );
}

function useFeaturesContext() {
  const context = useContext(Context);
  if (context == null) {
    throw new Error(`Features context is not initialized`);
  }
  return context;
}

export function useFeatures(): FeatureName[] | undefined {
  const context = useFeaturesContext();
  return context.features;
}

export function useFeature(feature: FeatureName): boolean {
  const context = useFeaturesContext();
  return context.features?.includes(feature) || false;
}

export function Feature(props: {
  name: FeatureName;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const isEnabled = useFeature(props.name);
  return isEnabled ? <>{props.children}</> : <>{props.fallback}</>;
}
