import { uniqWith } from 'lodash';
import React, { useState } from 'react';
import CheckboxList from './CheckboxList';
import s from './index.module.less';
import { InputProps } from '@/components/library/Form/types';
import {
  ExportDataStructure,
  ExportKey,
  isEqual,
  removePrefix,
} from '@/components/library/Table/export';
import { useDeepEqualMemo } from '@/utils/hooks';

export type FieldPickerValue = ExportKey[];

interface Props extends InputProps<FieldPickerValue> {
  dataStructure: ExportDataStructure;
}

export default function FieldsPicker(props: Props) {
  const { dataStructure, value = [], onChange } = props;

  const [expandedKeys, setExpandedKeys] = useState<ExportKey>([]);

  return (
    <div className={s.root}>
      <NestedCheckboxList
        parentKeyPrefix={[]}
        dataStructure={dataStructure}
        value={value}
        onChange={onChange}
        expandedKeys={expandedKeys}
        setExpandedKeys={setExpandedKeys}
      />
      {expandedKeys.map((key, i) => {
        const parentKeyPrefix: ExportKey = expandedKeys.slice(0, i + 1);
        let nestedDataStructure: ExportDataStructure = dataStructure;
        for (const parentKey of parentKeyPrefix) {
          const field = nestedDataStructure?.fields.find((option) => option.id === parentKey);
          if (field == null || !('children' in field)) {
            return null;
          }
          nestedDataStructure = field.children;
        }
        return (
          <NestedCheckboxList
            key={key}
            parentKeyPrefix={parentKeyPrefix}
            dataStructure={nestedDataStructure}
            value={value}
            onChange={onChange}
            expandedKeys={expandedKeys}
            setExpandedKeys={setExpandedKeys}
          />
        );
      })}
    </div>
  );
}

/*
  Helper functions
*/
function NestedCheckboxList(props: {
  parentKeyPrefix: ExportKey;
  dataStructure: ExportDataStructure;
  value: FieldPickerValue;
  onChange?: (keys: FieldPickerValue) => void;
  expandedKeys: ExportKey;
  setExpandedKeys: (keys: ExportKey) => void;
}) {
  const { parentKeyPrefix, dataStructure, value, onChange, setExpandedKeys, expandedKeys } = props;

  const checklistValue: string[] = useDeepEqualMemo(
    () =>
      dataStructure.fields
        .filter((field): boolean => {
          const keysToCheck = !('children' in field)
            ? [[...parentKeyPrefix, field.id]]
            : getChildKeys(field.children, [...parentKeyPrefix, field.id]);
          return keysToCheck.every((nextKey) => value.some((usedKey) => isEqual(usedKey, nextKey)));
        })
        .map(({ id }) => id),
    [dataStructure.fields, parentKeyPrefix, value],
  );

  const partiallySelectedKeys: string[] = useDeepEqualMemo(
    () =>
      dataStructure.fields
        .filter((field): boolean => {
          if (!('children' in field)) {
            return false;
          }
          const keysToCheck =
            field.children == null
              ? [[...parentKeyPrefix, field.id]]
              : getChildKeys(field.children, [...parentKeyPrefix, field.id]);
          const selectedKeys = keysToCheck.filter((nextKey) =>
            value.some((usedKey) => isEqual(usedKey, nextKey)),
          );
          return selectedKeys.length > 0 && selectedKeys.length !== keysToCheck.length;
        })
        .map(({ id }) => id),
    [dataStructure.fields, parentKeyPrefix, value],
  );
  return (
    <React.Fragment key={parentKeyPrefix.join('.')}>
      {parentKeyPrefix.length > 0 && <div className={s.divider} />}
      <CheckboxList
        value={checklistValue}
        indeterminateKeys={partiallySelectedKeys}
        onCheckboxChange={(key, checked) => {
          const fullKey = [...parentKeyPrefix, key];
          const field = dataStructure.fields.find((field) => field.id === key);
          if (field == null) {
            return;
          }
          let childKeys;
          if ('children' in field) {
            childKeys = getChildKeys(field.children, fullKey);
          } else {
            childKeys = [fullKey];
          }

          if (checked) {
            onChange?.(uniqWith([...value, ...childKeys], isEqual));
          } else {
            onChange?.(value.filter((v) => !childKeys.some((x) => isEqual(v, x))));
          }
        }}
        options={dataStructure.fields.map((option) => ({
          label: option.label,
          value: option.id,
          hasChildren: 'children' in option,
        }))}
        expandedKeys={removePrefix(expandedKeys, parentKeyPrefix)}
        onExpand={(value) => {
          const newKey = [...parentKeyPrefix, value];
          if (isEqual(expandedKeys, newKey)) {
            setExpandedKeys(parentKeyPrefix);
          } else {
            setExpandedKeys(newKey);
          }
        }}
      />
    </React.Fragment>
  );
}

function getChildKeys(dataStructure: ExportDataStructure, parentKey: ExportKey): ExportKey[] {
  return dataStructure.fields.flatMap((option) => {
    if (!('children' in option)) {
      return [[...parentKey, option.id]];
    }
    return getChildKeys(option.children, [...parentKey, option.id]);
  });
}

export function getInitialKeys(dataStructure: ExportDataStructure): FieldPickerValue {
  return getChildKeys(dataStructure, []);
}
