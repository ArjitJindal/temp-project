import React, { useContext } from 'react';
import { useDeepEqualMemo } from '@/utils/hooks';

export interface JsonSchemaEditorSettings {
  propertyNameStyle: 'SNAKE_CASE' | 'AS_IS';
  showOptionalMark: boolean;
}

export const DEFAULT_FORM_SETTINGS: JsonSchemaEditorSettings = {
  propertyNameStyle: 'AS_IS',
  showOptionalMark: true,
};
export const JsonSchemaEditorSettingsContext =
  React.createContext<JsonSchemaEditorSettings>(DEFAULT_FORM_SETTINGS);

export function ChangeJsonSchemaEditorSettings(props: {
  settings?: Partial<JsonSchemaEditorSettings>;
  children: React.ReactNode;
}) {
  const settings = useContext(JsonSchemaEditorSettingsContext);
  const newSettings = useDeepEqualMemo(
    () => ({ ...settings, ...props.settings }),
    [settings, props.settings],
  );

  return (
    <JsonSchemaEditorSettingsContext.Provider value={newSettings}>
      {props.children}
    </JsonSchemaEditorSettingsContext.Provider>
  );
}

export function useJsonSchemaEditorSettings(): JsonSchemaEditorSettings {
  return useContext(JsonSchemaEditorSettingsContext);
}
