import React from 'react';
import s from './index.module.less';
import DocumentDetails from './DocumentDetails';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import { InternalConsumerUser, LegalDocument } from '@/apis';
import CountryDisplay from '@/components/ui/CountryDisplay';
import Table from '@/components/ui/Table';
import * as Card from '@/components/ui/Card';
import KeyValueTag from '@/components/ui/KeyValueTag';

interface Props {
  person: InternalConsumerUser;
  updateCollapseState?: (key: string, value: boolean) => void;
  title: string;
  collapsableKey: string;
}

export function LegalDocumentsTable(prop: Props) {
  const { person, updateCollapseState, title, collapsableKey } = prop;
  return (
    <Card.Root header={{ title, collapsableKey }} updateCollapseState={updateCollapseState}>
      <div className={s.expandedRow}>
        <Table<LegalDocument & { i: number }>
          className={s.table}
          search={false}
          form={{
            labelWrap: true,
          }}
          rowKey="i"
          data={{
            items: (person.legalDocuments ?? []).map((x, i) => ({ i, ...x })),
          }}
          columns={[
            {
              title: 'Document Details',
              render: (_, document) => {
                return (
                  <DocumentDetails name={document.documentType} number={document.documentNumber} />
                );
              },
            },
            {
              title: 'Name on Document',
              render: (_, document) => document.nameOnDocument ?? '-',
            },
            {
              title: 'Date of Issue',
              render: (_, document) => {
                {
                  return document.documentIssuedDate
                    ? dayjs(document.documentIssuedDate).format(DEFAULT_DATE_TIME_FORMAT)
                    : -'-';
                }
              },
            },
            {
              title: 'Date of Expiry',
              render: (_, document) => {
                {
                  return document.documentExpirationDate
                    ? dayjs(document.documentExpirationDate).format(DEFAULT_DATE_TIME_FORMAT)
                    : '-';
                }
              },
            },
            {
              title: 'Country of Issue',
              render: (_, document) => {
                return <CountryDisplay isoCode={document.documentIssuedCountry ?? '-'} />;
              },
            },
            {
              title: 'Tags',
              render: (_, document) => (
                <>
                  {(document.tags ?? []).map((tag) => (
                    <KeyValueTag key={tag.key} tag={tag} />
                  ))}
                </>
              ),
            },
          ]}
          options={{
            reload: false,
            density: false,
            setting: false,
          }}
          pagination={'HIDE'}
        />
      </div>
    </Card.Root>
  );
}
