import React, { useState } from 'react';
import PropertyList from '../../../PropertyList';
import { ExtendedSchema } from '../../../types';
import s from './style.module.less';
import AdditionalProperties from './AdditionalProperties';
import { FieldMeta, FormContext, FormContextValue } from '@/components/library/Form/context';
import { getOrderedProps } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/utils';
import { isSchema } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/schema-utils';
import { InputProps } from '@/components/library/Form';
import { useFormContext } from '@/components/library/Form/utils/hooks';

// todo: fix any
interface Props extends InputProps<any> {
  schema: ExtendedSchema;
}

export default function GenericObjectInput(props: Props) {
  const { schema, value, onChange } = props;
  const properties = getOrderedProps(schema);
  const [fieldMeta, setFieldsMeta] = useState<{ [key: string]: FieldMeta }>({});

  const { alwaysShowErrors } = useFormContext();

  // todo: fix any
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
      onChange?.(newValue);
    },
  };

  return (
    <div className={s.children}>
      <FormContext.Provider value={subContext}>
        <PropertyList items={properties} labelProps={{ level: 2 }} />
        {isSchema(schema.additionalProperties) && (
          <AdditionalProperties
            schema={schema.additionalProperties}
            value={value}
            onChange={onChange}
          />
        )}
      </FormContext.Provider>
    </div>
  );
}
