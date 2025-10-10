import { createContext } from 'react';

interface ExternalStateContextValue<T = unknown> {
  value: T;
}

export const ExternalStateContext = createContext<ExternalStateContextValue | null>(null);
