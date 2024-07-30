import React from 'react';
import { ComplyAdvantageSearchHitDocFields } from '@/apis';

const URL_FIELDS = ['Related URL', 'Locationurl'];

interface Props {
  field: ComplyAdvantageSearchHitDocFields;
}

export default function FieldValue(props: Props) {
  const { field } = props;
  if (field.name && URL_FIELDS.includes(field.name)) {
    return (
      <a href={field.value} target="_blank">
        {field.value}
      </a>
    );
  }
  return <b>{field.value}</b>;
}
