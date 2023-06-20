import React, { useCallback, useState } from 'react';
import cn from 'clsx';
import pluralize from 'pluralize';
import { ExtendedSchema } from '../../../types';
import PropertyInput from '../index';
import s from './style.module.less';
import Button from '@/components/library/Button';
import Select from '@/components/library/Select';
import { isString } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/schema-utils';
import DeleteBin7LineIcon from '@/components/ui/icons/Remix/system/delete-bin-7-line.react.svg';
import { InputProps } from '@/components/library/Form';
import { getUiSchema } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/utils';
import SelectionGroup from '@/components/library/SelectionGroup';

// todo: fix any
interface Props extends InputProps<unknown[]> {
  schema: ExtendedSchema;
}

export default function ArrayPropertyInput(props: Props) {
  const { schema } = props;
  const uiSchema = getUiSchema(schema);
  if (schema.type !== 'array') {
    throw new Error(
      `This component should only be called for array property (passed property type is '${schema.type}')`,
    );
  }
  if (
    schema.items &&
    typeof schema.items === 'object' &&
    !Array.isArray(schema.items) &&
    schema.items.type === 'string'
  ) {
    const enumItems = schema.items.enum ?? [];
    const enumNames: string[] = schema.items.enumNames ?? [];

    const displayNames =
      enumNames?.length && enumNames.length === enumItems.length
        ? enumNames
        : (enumItems as string[]);

    if (enumItems.length > 0 && enumItems.length <= 3) {
      return (
        <SelectionGroup
          mode="MULTIPLE"
          options={enumItems
            .filter(isString)
            .map((item, i) => ({ label: displayNames[i] ?? item, value: item }))}
          {...(props as InputProps<string[]>)}
        />
      );
    }
    return (
      <Select
        mode={enumItems.length === 0 ? 'TAGS' : 'MULTIPLE'}
        options={enumItems
          .filter(isString)
          .map((item, i) => ({ label: displayNames[i] ?? item, value: item }))}
        placeholder={`Select multiple ${pluralize(uiSchema['ui:entityName'] ?? 'option')}`}
        {...(props as InputProps<string[]>)}
      />
    );
  }
  return <GenericArrayPropertyInput {...props} />;
}

export function GenericArrayPropertyInput(props: Props) {
  const { value = [], onChange, schema } = props;

  const [newItem, setNewItem] = useState<unknown>(undefined);

  const handleClickAdd = useCallback(() => {
    onChange?.([...value, newItem]);
    setNewItem(null);
  }, [newItem, value, onChange]);

  return (
    <div className={cn(s.root)}>
      <div className={s.items}>
        {value.map((item, i) => (
          <React.Fragment key={i}>
            <PropertyInput
              value={item}
              onChange={(newValue) => {
                onChange?.(value.map((x, j) => (i === j ? newValue : x)));
              }}
              schema={schema.items as ExtendedSchema}
            />
            <Button
              icon={<DeleteBin7LineIcon />}
              type="TEXT"
              onClick={() => {
                const newValue = [...value];
                newValue.splice(i, 1);
                onChange?.(newValue);
              }}
            >
              Delete
            </Button>
          </React.Fragment>
        ))}
        <div>
          <Button type="PRIMARY" onClick={handleClickAdd}>
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
