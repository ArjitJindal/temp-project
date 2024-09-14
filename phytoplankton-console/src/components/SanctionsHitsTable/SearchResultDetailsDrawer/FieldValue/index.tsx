import React from 'react';

const URL_FIELDS = ['Related URL', 'Locationurl'];

interface Props {
  name: string;
  value: string;
}

export default function FieldValue(props: Props) {
  const { name, value } = props;
  if (name && URL_FIELDS.includes(name)) {
    return (
      <a href={value} target="_blank">
        {value}
      </a>
    );
  }
  return <b>{value}</b>;
}
