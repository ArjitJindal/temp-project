import React, { useContext } from 'react';
import type { ExtendedSchema } from './types';

export interface JsonSchemaEditorContextValue {
  rootSchema: ExtendedSchema;
}
export const JsonSchemaEditorContext = React.createContext<JsonSchemaEditorContextValue | null>(
  null,
);

export function useJsonSchemaEditorContext(): Partial<JsonSchemaEditorContextValue> {
  const context = useContext(JsonSchemaEditorContext);
  return context ?? {};
}
