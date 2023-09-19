import React from 'react';
import DocumentDetails from './DocumentDetails';
import { InternalConsumerUser, LegalDocument } from '@/apis';
import Table from '@/components/library/Table';
import * as Card from '@/components/ui/Card';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { formatConsumerName } from '@/utils/api/users';
import { COUNTRY, DATE_TIME, TAGS } from '@/components/library/Table/standardDataTypes';

interface Props {
  person: InternalConsumerUser;
  title: string;
}

type TableItem = LegalDocument & { i: number };

export function LegalDocumentsTable(prop: Props) {
  const { person, title } = prop;

  const helper = new ColumnHelper<TableItem>();

  return (
    <Card.Root header={{ title }}>
      <Card.Section>
        <Table<TableItem>
          rowKey="i"
          data={{
            items: (person.legalDocuments ?? []).map((x, i) => ({ i, ...x })),
          }}
          columns={helper.list([
            helper.derived({
              title: 'Document details',
              value: (document) => {
                return {
                  documentType: document.documentType,
                  documentNumber: document.documentNumber,
                };
              },
              type: {
                render: (data) => {
                  if (data) {
                    const { documentType, documentNumber } = data;
                    return <DocumentDetails name={documentType} number={documentNumber} />;
                  }
                  return <></>;
                },
              },
            }),
            helper.simple({
              key: 'nameOnDocument',
              title: 'Name on document',
              type: {
                render: (nameOnDocument) => (
                  <>{nameOnDocument ? formatConsumerName(nameOnDocument) : '-'}</>
                ),
                stringify: (nameOnDocument) =>
                  nameOnDocument ? formatConsumerName(nameOnDocument) : '-',
              },
            }),
            helper.simple({
              key: 'documentIssuedDate',
              title: 'Date of issue',
              type: DATE_TIME,
            }),
            helper.simple({
              key: 'documentExpirationDate',
              title: 'Date of expiry',
              type: DATE_TIME,
            }),
            helper.simple({
              key: 'documentIssuedCountry',
              title: 'Country of issue',
              type: COUNTRY,
            }),
            helper.simple({
              key: 'tags',
              title: 'Tags',
              type: TAGS,
            }),
          ])}
          toolsOptions={false}
          pagination={false}
        />
      </Card.Section>
    </Card.Root>
  );
}
