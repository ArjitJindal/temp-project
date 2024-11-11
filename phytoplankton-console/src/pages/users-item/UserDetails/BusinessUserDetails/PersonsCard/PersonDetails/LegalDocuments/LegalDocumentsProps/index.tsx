import React from 'react';
import s from './index.module.less';
import * as Form from '@/components/ui/Form';
import KeyValueTag from '@/components/library/Tag/KeyValueTag';
import { ConsumerName, LegalDocument, CountryCode, Tag } from '@/apis';
import { formatConsumerName } from '@/utils/api/users';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { dayjs, DEFAULT_DATE_FORMAT } from '@/utils/dayjs';
import TagList from '@/components/library/Tag/TagList';

interface Props {
  legalDocument: LegalDocument;
}

const LegalDocumentKey = [
  'documentType',
  'documentNumber',
  'nameOnDocument',
  'documentIssuedCountry',
  'documentIssuedDate',
  'documentExpirationDate',
  'tags',
];

export default function LegalDocumentsProps(props: Props) {
  const { legalDocument } = props;

  return (
    <div className={s.root}>
      {LegalDocumentKey.map((key) => (
        <Form.Layout.Label
          key={key}
          orientation="vertical"
          title={renderKey(key)}
          className={s.property}
        >
          {renderValue(key, legalDocument[key])}
        </Form.Layout.Label>
      ))}
    </div>
  );
}

function renderValue(key: string, value: unknown): React.ReactNode {
  if (value == null) {
    return '-';
  }
  if (key === 'nameOnDocument') {
    return formatConsumerName(value as ConsumerName);
  }
  if (key == 'documentIssuedCountry') {
    return <CountryDisplay isoCode={value as CountryCode} />;
  }
  if (key == 'documentIssuedDate') {
    return dayjs(value as number).format(DEFAULT_DATE_FORMAT);
  }
  if (key == 'documentExpirationDate') {
    return dayjs(value as number).format(DEFAULT_DATE_FORMAT);
  }
  if (key == 'tags') {
    return (value as Array<Tag>).length ? (
      <TagList>
        {(value as Array<Tag>).map((tag) => (
          <KeyValueTag key={tag.key} tag={tag} />
        ))}
      </TagList>
    ) : (
      <> - </>
    );
  }
  return stringifyValue(value);
}

function renderKey(key: string): string {
  if (key == null) {
    return '-';
  }
  if (key === 'documentType') {
    return 'Type';
  }
  if (key === 'documentNumber') {
    return 'Number';
  }
  if (key === 'nameOnDocument') {
    return 'Name';
  }
  if (key == 'documentIssuedCountry') {
    return 'Issued Country';
  }
  if (key == 'documentIssuedDate') {
    return 'Date of issue';
  }
  if (key == 'documentExpirationDate') {
    return 'Date of expiry';
  }
  if (key == 'tags') {
    return 'Tags';
  }
  return stringifyValue(key);
}

function stringifyValue(value: unknown): string {
  if (value == null) {
    return '-';
  }
  if (isSimpleValue(value)) {
    return `${value}`;
  }
  if (Array.isArray(value)) {
    return value.map(stringifyValue).join(', ');
  }
  return JSON.stringify(value);
}

function isSimpleValue(value: unknown): value is string | number | boolean {
  const valueType = typeof value;
  return valueType === 'string' || valueType === 'number' || valueType === 'boolean';
}
