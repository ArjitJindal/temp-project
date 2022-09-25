import { Tag } from 'antd';
import React from 'react';
import moment from 'moment';
import s from './index.module.less';
import DocumentDetails from './DocumentDetails';
import { InternalConsumerUser, LegalDocument } from '@/apis';
import CountryDisplay from '@/components/ui/CountryDisplay';
import Table from '@/components/ui/Table';
import * as Card from '@/components/ui/Card';
import { DEFAULT_DATE_TIME_DISPLAY_FORMAT } from '@/utils/dates';

interface Props {
  person: InternalConsumerUser;
}

export function LegalDocumentsTable(prop: Props) {
  const { person } = prop;
  return (
    <Card.Root
      header={{
        title: 'Legal Documents',
      }}
    >
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
                  return (
                    moment(document.documentIssuedCountry).format(
                      DEFAULT_DATE_TIME_DISPLAY_FORMAT,
                    ) ?? '-'
                  );
                }
              },
            },
            {
              title: 'Date of Expiry',
              render: (_, document) => {
                {
                  return (
                    moment(document.documentExpirationDate).format(
                      DEFAULT_DATE_TIME_DISPLAY_FORMAT,
                    ) ?? '-'
                  );
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
                    <Tag color="processing" key={tag.key}>
                      {tag.value}
                    </Tag>
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
          pagination={false}
        />
      </div>
    </Card.Root>
  );
}
