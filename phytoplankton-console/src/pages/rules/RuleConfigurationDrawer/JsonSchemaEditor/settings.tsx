import React, { useContext, useMemo } from 'react';

export interface JsonSchemaEditorSettings {
  showOptionalMark: boolean;
}

const DEFAULT_FORM_SETTINGS: JsonSchemaEditorSettings = {
  showOptionalMark: true,
};
export const JsonSchemaEditorSettingsContext =
  React.createContext<JsonSchemaEditorSettings>(DEFAULT_FORM_SETTINGS);

export function ChangeJsonSchemaEditorSettings(props: {
  settings?: Partial<JsonSchemaEditorSettings>;
  children: React.ReactNode;
}) {
  const settings = useContext(JsonSchemaEditorSettingsContext);
  const newSettings = useMemo(
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
