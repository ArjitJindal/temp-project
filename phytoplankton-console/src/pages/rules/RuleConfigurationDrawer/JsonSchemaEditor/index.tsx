import React from 'react';
import { ExtendedSchema } from './types';
import {
  ChangeJsonSchemaEditorSettings,
  DEFAULT_FORM_SETTINGS,
  JsonSchemaEditorSettings,
} from './settings';
import { JsonSchemaEditorContext } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/context';
import GenericObjectInput from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/Property/PropertyInput/ObjectPropertyInput';
import { useFormContext } from '@/components/library/Form/utils/hooks';

interface Props {
  settings?: Partial<JsonSchemaEditorSettings>;
  parametersSchema: ExtendedSchema;
}

export default function JsonSchemaEditor(props: Props) {
  const { settings = DEFAULT_FORM_SETTINGS, parametersSchema } = props;
  const { values, setValues } = useFormContext();

  return (
    <JsonSchemaEditorContext.Provider value={{ rootSchema: parametersSchema }}>
      <ChangeJsonSchemaEditorSettings settings={settings}>
        <GenericObjectInput
          schema={parametersSchema}
          value={values}
          onChange={setValues}
          labelProps={{ level: 1 }}
        />
      </ChangeJsonSchemaEditorSettings>
    </JsonSchemaEditorContext.Provider>
  );
}
