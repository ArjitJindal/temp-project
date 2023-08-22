import React from 'react';
import { ExtendedSchema } from '../../../types';
import TextInput from '@/components/library/TextInput';
import NumberInput from '@/components/library/NumberInput';
import Checkbox from '@/components/library/Checkbox';
import Select from '@/components/library/Select';
import { InputProps } from '@/components/library/Form';
import { getUiSchema } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/utils';
import DatePicker from '@/components/ui/DatePicker';
import { DATE_TIME_ISO_FORMAT, Dayjs, dayjs, YEAR_MONTH_DATE_FORMAT } from '@/utils/dayjs';

// todo: fix any
interface Props extends InputProps<any> {
  schema: ExtendedSchema;
}

export default function SimplePropertyInput(props: Props) {
  const { schema, ...inputProps } = props;
  const uiSchema = getUiSchema(schema);
  switch (schema.type) {
    case 'string': {
      if (schema.enum != null) {
        const enums = schema.enum ?? [];
        const enumNames = schema.enumNames ?? [];

        const displayOptions =
          enumNames?.length && enumNames.length === enums.length
            ? (enumNames as string[])
            : (enums as string[]);

        return (
          <Select
            {...inputProps}
            mode="SINGLE"
            isDisabled={schema.readOnly}
            placeholder={`Select ${uiSchema['ui:entityName'] ?? 'option'}`}
            options={(schema.enum ?? [])
              .filter((x): x is string => typeof x === 'string')
              .map((item, i) => ({ value: item, label: displayOptions[i] ?? item }))}
          />
        );
      }
      if (schema.format === 'date-time' || schema.format === 'date') {
        let value: Dayjs | null = null;
        if (inputProps.value == null) {
          value = null;
        } else if (schema.format === 'date-time') {
          value = dayjs(inputProps.value, DATE_TIME_ISO_FORMAT);
        } else if (schema.format === 'date') {
          value = dayjs(inputProps.value, YEAR_MONTH_DATE_FORMAT);
        }
        return (
          <DatePicker
            showTime={schema.format === 'date-time'}
            value={value}
            allowClear
            onChange={(dayjsValue) => {
              let newValue: string | undefined;
              if (dayjsValue == null) {
                newValue = undefined;
              } else if (schema.format === 'date-time') {
                newValue = dayjsValue.format(DATE_TIME_ISO_FORMAT);
              } else if (schema.format === 'date') {
                newValue = dayjsValue.format(YEAR_MONTH_DATE_FORMAT);
              }
              inputProps.onChange?.(newValue);
            }}
          />
        );
      }
      return <TextInput {...inputProps} placeholder="Enter text" isDisabled={schema.readOnly} />;
    }
    case 'boolean':
      return <Checkbox {...inputProps} value={inputProps.value ?? false} />;
    case 'number':
    case 'integer':
      if (schema.enum != null) {
        const enums = schema.enum ?? [];
        const enumNames = schema.enumNames ?? [];

        const displayOptions =
          enumNames?.length && enumNames.length === enums.length
            ? (enumNames as string[])
            : (enums as string[]);

        return (
          <Select<number>
            {...inputProps}
            mode="SINGLE"
            placeholder={`Select ${uiSchema['ui:entityName'] ?? 'option'}`}
            options={(schema.enum ?? [])
              .map((x) => Number.parseInt(`${x}`))
              .filter((x): x is number => !Number.isNaN(x))
              .map((item, i) => ({ value: item, label: displayOptions[i] ?? item }))}
          />
        );
      }
      return (
        <NumberInput
          placeholder="Enter number"
          {...inputProps}
          min={schema.minimum}
          max={schema.maximum}
        />
      );
    case 'array':
    case 'null':
    case 'any':
  }

  console.error(`Schema type "${schema.type}" is not supported`);

  return <></>;
}
