import React from 'react';
import cn from 'clsx';
import { ExtendedSchema, PropertyItem } from '../types';
import { getUiSchema, useOrderedProps } from '../utils';
import PropertyInput from './PropertyInput';
import s from './style.module.less';
import { Props as LabelProps } from '@/components/library/Label';
import InputField from '@/components/library/Form/InputField';
import { useJsonSchemaEditorSettings } from '@/components/library/JsonSchemaEditor/settings';
import { humanizeAuto, humanizeCamelCase, humanizeSnakeCase } from '@/utils/humanize';
import { useDeepEqualMemo } from '@/utils/hooks';
import { neverReturn } from '@/utils/lang';
import { dereferenceType } from '@/components/library/JsonSchemaEditor/schema-utils';
import { useJsonSchemaEditorContext } from '@/components/library/JsonSchemaEditor/context';
import { useFeaturesEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  item: PropertyItem;
  labelProps?: Partial<LabelProps>;
  collapseForNestedProperties?: boolean;
  parentSchema?: ExtendedSchema;
}

export default function Property(props: Props) {
  const { item, labelProps, collapseForNestedProperties, parentSchema } = props;
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
      case 'CAMEL_CASE':
        return humanizeCamelCase;
      case 'AUTO':
        return humanizeAuto;
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
    default:
      break;
  }

  let labelLevel: 1 | 2 | 3 | undefined = undefined;
  switch (schema.type) {
    case 'object':
      labelLevel = 1;
      break;
    default:
      break;
  }

  const uiSchema = getUiSchema(schema);

  let labelPosition: 'TOP' | 'RIGHT' = 'TOP';
  if (schema.type === 'boolean') {
    labelPosition = 'RIGHT';
  } else if (uiSchema['ui:subtype'] === 'FINCEN_INDICATOR') {
    labelPosition = 'RIGHT';
  }

  const siblingPropertiesCount = useOrderedProps(parentSchema).length;
  const requiredFeatures = uiSchema['ui:requiredFeatures'] ?? [];
  const canShowProperty = useFeaturesEnabled(requiredFeatures);
  return canShowProperty ? (
    <PropertyContext.Provider value={{ item }}>
      <InputField<any>
        name={name}
        label={schema.title ?? humanizeFunction(name)}
        description={schema.description}
        labelProps={{
          element: labelElement,
          position: labelPosition,
          required: {
            value: item.isRequired,
            showHint: settings.showOptionalMark,
          },
          ...labelProps,
          level: labelLevel,
          testId: `Property/${item.name}`,
        }}
        hideLabel={schema.type === 'object' && collapseForNestedProperties && !!labelProps?.level}
      >
        {(inputProps) =>
          schema.type === 'object' && (!collapseForNestedProperties || !labelProps?.level) ? (
            <div
              className={cn(s.children, siblingPropertiesCount === 1 ? s.childrenSeparator : '')}
            >
              <PropertyInput {...inputProps} schema={schema} labelProps={labelProps} />
            </div>
          ) : (
            <PropertyInput
              {...inputProps}
              schema={schema}
              collapseForNestedProperties={collapseForNestedProperties}
              labelProps={labelProps}
            />
          )
        }
      </InputField>
    </PropertyContext.Provider>
  ) : (
    <></>
  );
}

function dontHumanize(name: string): string {
  return name;
}

interface PropertyContextValue {
  item: PropertyItem;
}
export const PropertyContext = React.createContext<PropertyContextValue | null>(null);
