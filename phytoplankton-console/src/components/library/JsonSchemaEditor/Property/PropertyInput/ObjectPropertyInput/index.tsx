import React, { useContext, useState } from 'react';
import PropertyList from '../../../PropertyList';
import { ExtendedSchema } from '../../../types';
import s from './style.module.less';
import AdditionalProperties from './AdditionalProperties';
import OneOf from './OneOf';
import { FieldMeta, FormContext, FormContextValue } from '@/components/library/Form/context';
import { useOrderedProps } from '@/components/library/JsonSchemaEditor/utils';
import { isSchema } from '@/components/library/JsonSchemaEditor/schema-utils';
import { InputProps } from '@/components/library/Form';
import { useFormContext } from '@/components/library/Form/utils/hooks';
import { Props as LabelProps } from '@/components/library/Label';
import { PropertyContext } from '@/components/library/JsonSchemaEditor/Property';
import {
  $IS_OPTIONAL,
  isArrayFieldValidator,
  isObjectFieldValidator,
} from '@/components/library/Form/utils/validation/types';

// todo: fix any
interface Props extends InputProps<any> {
  schema: ExtendedSchema;
  labelProps?: Partial<LabelProps>;
}

export default function GenericObjectInput(props: Props) {
  const { schema, value, onChange, labelProps } = props;
  const properties = useOrderedProps(schema);
  const [fieldMeta, setFieldsMeta] = useState<{ [key: string]: FieldMeta }>({});

  const { alwaysShowErrors, fieldValidators } = useFormContext();
  const propertyContext = useContext(PropertyContext);

  let subFieldValidator = fieldValidators?.[propertyContext?.item.name ?? ''];
  if (subFieldValidator != null) {
    if (isArrayFieldValidator(subFieldValidator)) {
      subFieldValidator = subFieldValidator.itemValidator;
    }
  }

  const subContext: FormContextValue<any> = {
    alwaysShowErrors: alwaysShowErrors,
    meta: fieldMeta,
    setMeta: (key, cb) => {
      setFieldsMeta((state) => ({
        ...state,
        [key]: cb(state[key] ?? {}),
      }));
    },
    values: value ?? {},
    setValues: (newValue) => {
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

  return (
    <div className={s.children}>
      <FormContext.Provider value={subContext}>
        <PropertyList items={properties} labelProps={{ level: 2, ...labelProps }} />
        {isSchema(schema.additionalProperties) && (
          <AdditionalProperties
            schema={schema.additionalProperties}
            value={value}
            onChange={onChange}
          />
        )}
        {Array.isArray(schema.oneOf) && schema.oneOf.every(isSchema) && (
          <OneOf schemas={schema.oneOf} value={value} onChange={onChange} />
        )}
      </FormContext.Provider>
    </div>
  );
}
