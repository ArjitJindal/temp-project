import React from 'react';
import { PropertyItem } from '../types';
import PropertyInput from './PropertyInput';
import { Props as LabelProps } from '@/components/library/Label';
import InputField from '@/components/library/Form/InputField';
import { useJsonSchemaEditorSettings } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/settings';
import { humanizeSnakeCase } from '@/utils/humanize';
import { useDeepEqualMemo } from '@/utils/hooks';
import { neverReturn } from '@/utils/lang';
import { dereferenceType } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/schema-utils';
import { useJsonSchemaEditorContext } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/context';

interface Props {
  item: PropertyItem;
  labelProps?: Partial<LabelProps>;
}

export default function Property(props: Props) {
  const { item, labelProps } = props;
  const { schema: _schema, name } = item;

  const settings = useJsonSchemaEditorSettings();

  const { rootSchema } = useJsonSchemaEditorContext();
  const schema = dereferenceType(_schema, rootSchema);

  const humanizeFunction = useDeepEqualMemo(() => {
    switch (settings.propertyNameStyle) {
      case 'AS_IS':
        return dontHumanize;
      case 'SNAKE_CASE':
        return humanizeSnakeCase;
      default:
        return neverReturn(settings.propertyNameStyle, dontHumanize);
    }
  }, [settings.propertyNameStyle]);

  let labelElement: 'div' | 'label' = 'div';
  switch (schema.type) {
    case 'boolean':
    case 'number':
    case 'integer':
    case 'string':
      labelElement = 'label';
      break;
  }

  let labelPosition: 'TOP' | 'RIGHT' = 'TOP';
  switch (schema.type) {
    case 'boolean':
      labelPosition = 'RIGHT';
      break;
  }

  return (
    <InputField<any>
      name={name}
      label={String(schema.title ?? humanizeFunction(name))}
      description={schema.description}
      labelProps={{
        element: labelElement,
        position: labelPosition,
        isOptional: !item.isRequired && settings.showOptionalMark,
        ...labelProps,
      }}
    >
      {(inputProps) => <PropertyInput {...inputProps} schema={schema} />}
    </InputField>
  );
}

function dontHumanize(name: string): string {
  return name;
}
