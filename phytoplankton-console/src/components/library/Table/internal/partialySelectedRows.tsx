import { createContext } from 'react';
import { SelectionInfo } from '../types';

interface AdditionalContextValue {
  partiallySelectedIds?: string[];
  selectionInfo?: SelectionInfo;
}

/*
  Additional context to pass additional information through the table components to columns
 */
export const AdditionalContext = createContext<AdditionalContextValue>({});
