import React, { useCallback, useContext, useMemo, useState } from 'react';
import cn from 'clsx';
import pluralize from 'pluralize';
import { ExtendedSchema } from '../../../types';
import PropertyInput from '../index';
import s from './style.module.less';
import Button from '@/components/library/Button';
import Select from '@/components/library/Select';
import {
  dereferenceType,
  isString,
} from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/schema-utils';
import DeleteBin7LineIcon from '@/components/ui/icons/Remix/system/delete-bin-7-line.react.svg';
import { InputProps } from '@/components/library/Form';
import { getUiSchema } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/utils';
import SelectionGroup from '@/components/library/SelectionGroup';
import * as Card from '@/components/ui/Card';
import { useJsonSchemaEditorContext } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/context';
import { PropertyContext } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/Property';
import { humanizeAuto, normalizeCase } from '@/utils/humanize';

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
  const { onChange, schema } = props;
  const [newItem, setNewItem] = useState<unknown>(undefined);
  const value = useMemo(() => props.value ?? [], [props.value]);
  const entityName = useEntityName(schema);

  const handleClickAdd = useCallback(() => {
    onChange?.([...value, newItem]);
    setNewItem(null);
  }, [newItem, value, onChange]);

  return (
    <div className={cn(s.root)}>
      <div className={s.items}>
        {value.map((item, i) => (
          <Card.Root
            key={i}
            className={s.root}
            isCollapsable={true}
            isCollapsedByDefault={true}
            header={{
              title: normalizeCase(`${entityName ?? 'Item'} #${i + 1}`),
              titleSize: 'SMALL',
              link: (
                <Button
                  icon={<DeleteBin7LineIcon />}
                  type="TEXT"
                  size="SMALL"
                  isDanger={true}
                  onClick={() => {
                    const newValue = [...value];
                    newValue.splice(i, 1);
                    onChange?.(newValue);
                  }}
                />
              ),
            }}
          >
            <Card.Section>
              <PropertyInput
                value={item}
                onChange={(newValue) => {
                  onChange?.(value.map((x, j) => (i === j ? newValue : x)));
                }}
                schema={schema.items as ExtendedSchema}
              />
            </Card.Section>
          </Card.Root>
        ))}
        <div>
          <Button type="PRIMARY" onClick={handleClickAdd}>
            {normalizeCase(`Add ${entityName ? ` ${entityName}` : ''}`)}
          </Button>
        </div>
      </div>
    </div>
  );
}

function useEntityName(schema: ExtendedSchema): string | undefined {
  const { rootSchema } = useJsonSchemaEditorContext();
  const propertyContext = useContext(PropertyContext);
  if (propertyContext != null) {
    return humanizeAuto(pluralize.singular(propertyContext.item.name));
  }
  if (schema.items == null) {
    return undefined;
  }
  const fullType = dereferenceType(schema.items, rootSchema);
  if (fullType.title != null) {
    return fullType.title;
  }
  return undefined;
}
