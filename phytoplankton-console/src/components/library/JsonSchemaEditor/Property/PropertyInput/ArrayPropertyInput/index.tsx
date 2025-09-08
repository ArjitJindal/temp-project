import { useCallback, useContext, useMemo } from 'react';
import cn from 'clsx';
import pluralize from 'pluralize';
import { humanizeAuto, normalizeCase } from '@flagright/lib/utils/humanize';
import { ExtendedSchema } from '../../../types';
import PropertyInput from '../index';
import { CollapsePropertiesLayout } from '../CollapsePropertiesLayout';
import s from './style.module.less';
import Button from '@/components/library/Button';
import Select from '@/components/library/Select';
import { dereferenceType, isString } from '@/components/library/JsonSchemaEditor/schema-utils';
import { InputProps } from '@/components/library/Form';
import { getUiSchema } from '@/components/library/JsonSchemaEditor/utils';
import SelectionGroup from '@/components/library/SelectionGroup';
import { useJsonSchemaEditorContext } from '@/components/library/JsonSchemaEditor/context';
import { PropertyContext } from '@/components/library/JsonSchemaEditor/Property';
import { useFormContext } from '@/components/library/Form/utils/hooks';
import {
  isArrayFieldValidator,
  isResultValid,
} from '@/components/library/Form/utils/validation/types';
import { validateField } from '@/components/library/Form/utils/validation/utils';
import { useGetAlias } from '@/components/AppWrapper/Providers/SettingsProvider';
interface Props extends InputProps<string[]> {
  schema: ExtendedSchema;
}

export default function ArrayPropertyInput(props: Props) {
  const { schema } = props;
  const uiSchema = getUiSchema(schema);
  const getAlias = useGetAlias();
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

    let displayNames =
      enumNames?.length && enumNames.length === enumItems.length ? enumNames : enumItems;

    if (['{{UserAlias}} KYC status', '{{UserAlias}} status'].includes(schema.title ?? '')) {
      displayNames = enumItems;
    }

    if (enumItems.length > 0 && enumItems.length <= 4) {
      return (
        <SelectionGroup
          mode="MULTIPLE"
          options={enumItems.filter(isString).map((item, i) => ({
            label: getAlias(String(displayNames[i] ?? item)),
            value: item,
          }))}
          {...props}
        />
      );
    }
    return (
      <Select
        isCopyable={true}
        allowNewOptions={enumItems.length === 0}
        mode={'MULTIPLE'}
        options={enumItems
          .filter(isString)
          .map((item, i) => ({ label: getAlias(String(displayNames[i] ?? item)), value: item }))}
        placeholder={`Select multiple ${pluralize(uiSchema['ui:entityName'] ?? 'option')}`}
        {...props}
      />
    );
  }
  return <GenericArrayPropertyInput {...props} />;
}

export function GenericArrayPropertyInput(props: Props) {
  const { onChange, schema } = props;

  const value = useMemo(() => props.value ?? [], [props.value]);
  const entityName = useEntityName(schema);

  const { alwaysShowErrors, fieldValidators } = useFormContext();
  const propertyContext = useContext(PropertyContext);
  let subFieldValidator = fieldValidators?.[propertyContext?.item.name ?? ''];
  subFieldValidator = isArrayFieldValidator(subFieldValidator)
    ? subFieldValidator.itemValidator
    : null;

  const handleClickAdd = useCallback(() => {
    onChange?.([...value, '']);
  }, [value, onChange]);

  return (
    <div className={cn(s.root)}>
      <div className={s.items}>
        {value.map((item, i) => {
          const handleDeleteItem = () => {
            const newValue = [...value];
            newValue.splice(i, 1);
            onChange?.(newValue.length === 0 ? undefined : newValue);
          };

          return (
            <CollapsePropertiesLayout
              className={s.root}
              fieldValidation={
                alwaysShowErrors && !isResultValid(validateField(subFieldValidator, item))
              }
              title={entityName}
              arrayItemProps={{
                handleDeleteItem: handleDeleteItem,
                itemCount: i,
              }}
              testId={`Property/${propertyContext?.item.name}/card`}
              headerClassName={s.cardHeader}
              key="collapse-properties-layout"
            >
              {schema.items && (
                <PropertyInput
                  value={item}
                  onChange={(newValue) => {
                    onChange?.(value.map((x, j) => (i === j ? newValue : x)));
                  }}
                  schema={schema.items}
                />
              )}
            </CollapsePropertiesLayout>
          );
        })}
        <div>
          <Button type="PRIMARY" onClick={handleClickAdd} className={s.addButton}>
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
