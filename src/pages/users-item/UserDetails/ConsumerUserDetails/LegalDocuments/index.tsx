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
  updateCollapseState?: (key: string, value: boolean) => void;
  title: string;
  collapsableKey: string;
}

type TableItem = LegalDocument & { i: number };

export function LegalDocumentsTable(prop: Props) {
  const { person, updateCollapseState, title, collapsableKey } = prop;

  const helper = new ColumnHelper<TableItem>();

  return (
    <Card.Root
      header={{ title, collapsableKey }}
      updateCollapseState={updateCollapseState}
      collapsable={updateCollapseState != null}
    >
      <Card.Section>
        <Table<TableItem>
          rowKey="i"
          data={{
            items: (person.legalDocuments ?? []).map((x, i) => ({ i, ...x })),
          }}
          columns={helper.list([
            helper.derived({
              title: 'Document Details',
              value: (document) => {
                return {
                  documentType: document.documentType,
                  documentNumber: document.documentNumber,
                };
              },
              type: {
                render: ({ documentType, documentNumber }) => {
                  return <DocumentDetails name={documentType} number={documentNumber} />;
                },
              },
            }),
            helper.simple({
              key: 'nameOnDocument',
              title: 'Name on Document',
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
              title: 'Date of Issue',
              type: DATE_TIME,
            }),
            helper.simple({
              key: 'documentExpirationDate',
              title: 'Date of Expiry',
              type: DATE_TIME,
            }),
            helper.simple({
              key: 'documentIssuedCountry',
              title: 'Country of Issue',
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
