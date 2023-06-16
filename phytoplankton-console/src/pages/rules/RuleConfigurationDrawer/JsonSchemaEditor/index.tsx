import PropertyList from './PropertyList';
import { ExtendedSchema } from './types';
import { getOrderedProps } from './utils';
import {
  ChangeJsonSchemaEditorSettings,
  DEFAULT_FORM_SETTINGS,
  JsonSchemaEditorSettings,
} from './settings';
import { JsonSchemaEditorContext } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/context';

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
