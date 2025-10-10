import React from 'react';
import { ExtendedSchema, UiSchemaFincenGender } from '../../../../../types';
import s from './style.module.less';
import { InputProps } from '@/components/library/Form';
import { useFormState } from '@/components/library/Form/utils/hooks';
import SelectionGroup from '@/components/library/SelectionGroup';

type InternalType = 'MALE' | 'FEMALE' | 'UNKNOWN';

interface Props extends InputProps<void> {
  uiSchema?: UiSchemaFincenGender;
  schema: ExtendedSchema;
}

export default function Gender(props: Props) {
  const { schema } = props;
  const formState = useFormState<{ [key: string]: unknown }>();
  const uiSchema = schema['ui:schema'] ?? {};
  const maleIndicatorField = uiSchema['ui:maleIndicatorField'];
  const femaleIndicatorField = uiSchema['ui:femaleIndicatorField'];
  const unknownIndicatorField = uiSchema['ui:unknownIndicatorField'];
  let value: InternalType = 'UNKNOWN';
  if (formState.values[maleIndicatorField] === 'Y') {
    value = 'MALE';
  } else if (formState.values[femaleIndicatorField] === 'Y') {
    value = 'FEMALE';
  } else if (formState.values[unknownIndicatorField] === 'Y') {
    value = 'UNKNOWN';
  }
  return (
    <div className={s.root}>
      <SelectionGroup<InternalType>
        mode="SINGLE"
        value={value}
        options={[
          { value: 'MALE', label: 'Male' },
          { value: 'FEMALE', label: 'Female' },
          { value: 'UNKNOWN', label: 'Unknown' },
        ]}
        onChange={(newValue) => {
          formState.setValues({
            ...formState.values,
            [maleIndicatorField]: newValue === 'MALE' ? 'Y' : undefined,
            [femaleIndicatorField]: newValue === 'FEMALE' ? 'Y' : undefined,
            [unknownIndicatorField]: newValue === 'UNKNOWN' || newValue == null ? 'Y' : undefined,
          });
        }}
      />
    </div>
  );
}
