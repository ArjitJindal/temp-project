import React, { useState } from 'react';
import { ExtendedSchema } from '../../../../types';
import PropertyInput from '../../index';
import s from './style.module.less';
import { InputProps } from '@/components/library/Form';
import SelectionGroup from '@/components/library/SelectionGroup';

interface Props extends InputProps<object> {
  schemas: ExtendedSchema[];
}

export default function OneOf(props: Props) {
  const { schemas, value, onChange } = props;

  const [selectedSchemaIndex, setSelectedSchemaIndex] = useState(0);
  if (schemas.length === 0) {
    return <></>;
  }
  const schema = schemas[selectedSchemaIndex] ?? schemas[0];

  return (
    <div className={s.root}>
      <SelectionGroup
        value={`${selectedSchemaIndex}`}
        mode={'SINGLE'}
        options={schemas.map((schema, i) => ({
          value: `${i}`,
          label: schema.title ?? `Subtype #${i + 1}`,
        }))}
        onChange={(newValue) => {
          if (typeof newValue === 'string') {
            setSelectedSchemaIndex(parseInt(newValue));
          }
        }}
      />
      <PropertyInput schema={schema} value={value} onChange={onChange} />
    </div>
  );
}
