import { useMemo } from 'react';
import cn from 'classnames';
import { ExtendedSchema } from './types';
import {
  ChangeJsonSchemaEditorSettings,
  DEFAULT_FORM_SETTINGS,
  JsonSchemaEditorSettings,
} from './settings';
import s from './style.module.less';
import { JsonSchemaEditorContext } from '@/components/library/JsonSchemaEditor/context';
import PropertyList from '@/components/library/JsonSchemaEditor/PropertyList';
import { getOrderedProps } from '@/components/library/JsonSchemaEditor/utils';

interface Props {
  settings?: Partial<JsonSchemaEditorSettings>;
  parametersSchema: ExtendedSchema;
  className?: string;
}

export default function JsonSchemaEditor(props: Props) {
  const { settings = DEFAULT_FORM_SETTINGS, parametersSchema, className } = props;
  const items = useMemo(() => getOrderedProps(parametersSchema), [parametersSchema]);
  return (
    <div className={cn(s.root, className)}>
      <JsonSchemaEditorContext.Provider value={{ rootSchema: parametersSchema }}>
        <ChangeJsonSchemaEditorSettings settings={settings}>
          <PropertyList
            items={items}
            collapseForNestedProperties={settings.collapseForNestedProperties}
            parentSchema={parametersSchema}
          />
        </ChangeJsonSchemaEditorSettings>
      </JsonSchemaEditorContext.Provider>
    </div>
  );
}
