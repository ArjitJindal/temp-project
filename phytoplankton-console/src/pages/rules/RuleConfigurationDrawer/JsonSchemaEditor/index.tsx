// TODO: Move JsonSchemaEditor/ to library

import { ExtendedSchema } from './types';
import {
  ChangeJsonSchemaEditorSettings,
  DEFAULT_FORM_SETTINGS,
  JsonSchemaEditorSettings,
} from './settings';
import { JsonSchemaEditorContext } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/context';
import PropertyList from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/PropertyList';
import { getOrderedProps } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/utils';

interface Props {
  settings?: Partial<JsonSchemaEditorSettings>;
  parametersSchema: ExtendedSchema;
}

export default function JsonSchemaEditor(props: Props) {
  const { settings = DEFAULT_FORM_SETTINGS, parametersSchema } = props;

  return (
    <JsonSchemaEditorContext.Provider value={{ rootSchema: parametersSchema }}>
      <ChangeJsonSchemaEditorSettings settings={settings}>
        <PropertyList items={getOrderedProps(parametersSchema)} />
      </ChangeJsonSchemaEditorSettings>
    </JsonSchemaEditorContext.Provider>
  );
}
