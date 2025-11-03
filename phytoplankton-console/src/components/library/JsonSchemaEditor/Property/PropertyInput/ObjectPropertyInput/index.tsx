import React, { useContext, useState } from 'react';
import PropertyList from '../../../PropertyList';
import { ExtendedSchema } from '../../../types';
import { CollapsePropertiesLayout } from '../CollapsePropertiesLayout';
import { useJsonSchemaEditorSettings } from '../../../settings';
import s from './style.module.less';
import AdditionalProperties from './AdditionalProperties';
import OneOf from './OneOf';
import { FieldMeta, FormContext, FormContextValue } from '@/components/library/Form/context';
import { useOrderedProps } from '@/components/library/JsonSchemaEditor/utils';
import { isSchema } from '@/components/library/JsonSchemaEditor/schema-utils';
import { InputProps } from '@/components/library/Form';
import { useFormContext } from '@/components/library/Form/utils/hooks';
import Label, { Props as LabelProps } from '@/components/library/Label';
import { PropertyContext } from '@/components/library/JsonSchemaEditor/Property';
import {
  $IS_OPTIONAL,
  isArrayFieldValidator,
  isObjectFieldValidator,
  isResultValid,
} from '@/components/library/Form/utils/validation/types';
import { Updater, applyUpdater } from '@/utils/state';
import { validateField } from '@/components/library/Form/utils/validation/utils';

// todo: fix any
interface Props extends InputProps<any> {
  schema: ExtendedSchema;
  labelProps?: Partial<LabelProps>;
  collapseForNestedProperties?: boolean;
}

export default function ObjectPropertyInput(props: Props) {
  const { schema, value, onChange, labelProps, collapseForNestedProperties } = props;
  const properties = useOrderedProps(schema);
  const [fieldMeta, setFieldsMeta] = useState<{ [key: string]: FieldMeta }>({});

  const { alwaysShowErrors, fieldValidators, isDisabled } = useFormContext();
  const propertyContext = useContext(PropertyContext);

  let subFieldValidator = fieldValidators?.[propertyContext?.item.name ?? ''];
  if (subFieldValidator != null) {
    if (isArrayFieldValidator(subFieldValidator)) {
      subFieldValidator = subFieldValidator.itemValidator;
    }
  }
  const subContext: FormContextValue<any> = {
    isDisabled,
    alwaysShowErrors: alwaysShowErrors,
    meta: fieldMeta,
    setMeta: (key, cb) => {
      setFieldsMeta((state) => ({
        ...state,
        [key]: cb(state[key] ?? {}),
      }));
    },
    values: value ?? {},
    setValues: (updater: Updater<any>) => {
      const newValue = applyUpdater(value, updater);
      onChange?.(
        newValue != null && !Object.entries(newValue).some(([_, value]) => value != null)
          ? null
          : newValue,
      );
    },
    fieldValidators:
      isObjectFieldValidator(subFieldValidator) &&
      subFieldValidator?.[$IS_OPTIONAL] &&
      value == null
        ? undefined
        : subFieldValidator,
  };
  const settings = useJsonSchemaEditorSettings();
  const labelRequiredProps = {
    value: !!propertyContext?.item.isRequired,
    showHint: settings.showOptionalMark,
  };
  const isInvalid = alwaysShowErrors && !isResultValid(validateField(subFieldValidator, value));
  const showOneofInCollapsePropertyLayout = schema.showOneOfInCollapse ?? false; // control showing of one of in collapse
  return (
    <div className={s.children}>
      <FormContext.Provider value={subContext}>
        {collapseForNestedProperties && labelProps?.level ? (
          <CollapsePropertiesLayout
            className={s.collapse}
            fieldValidation={isInvalid}
            title={
              <Label
                label={schema.title ?? propertyContext?.label}
                description={schema.description}
                required={labelRequiredProps}
                testId={`Property/${propertyContext?.item.name}/card`}
              />
            }
            headerClassName={s.cardHeader}
          >
            {showOneofInCollapsePropertyLayout && Array.isArray(schema.oneOf) ? (
              <OneOf schemas={schema.oneOf} value={value} onChange={onChange} />
            ) : (
              <PropertyList
                items={properties}
                labelProps={{
                  ...labelProps,
                  level: 2,
                }}
                collapseForNestedProperties
                parentSchema={schema}
              />
            )}
          </CollapsePropertiesLayout>
        ) : (
          <PropertyList
            items={properties}
            labelProps={{
              level: 2,
              ...labelProps,
            }}
            collapseForNestedProperties
          />
        )}
        {isSchema(schema.additionalProperties) && (
          <AdditionalProperties
            schema={schema.additionalProperties}
            value={value}
            onChange={onChange}
          />
        )}
        {!showOneofInCollapsePropertyLayout &&
          Array.isArray(schema.oneOf) &&
          schema.oneOf.every(isSchema) && (
            <OneOf schemas={schema.oneOf} value={value} onChange={onChange} />
          )}
      </FormContext.Provider>
    </div>
  );
}
