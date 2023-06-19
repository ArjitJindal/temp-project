import { createContext } from 'react';

interface AdditionalContextValue {
  partiallySelectedIds?: string[];
}

/*
  Additional context to pass additional information through the table components to columns
 */
export const AdditionalContext = createContext<AdditionalContextValue>({});
