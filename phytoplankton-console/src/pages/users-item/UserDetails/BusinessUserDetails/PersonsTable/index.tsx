import { Typography } from 'antd';
import React from 'react';
import s from './styles.module.less';
import { LegalDocument, Person } from '@/apis';
import { formatConsumerName } from '@/utils/api/users';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import {
  ADDRESS,
  COUNTRY,
  EMAIL,
  EXTERNAL_LINK,
  STRING,
  TAGS,
} from '@/components/library/Table/standardDataTypes';
import { array } from '@/components/library/Table/dataTypeHelpers';
import { dayjs } from '@/utils/dayjs';

export function expandedRowRender(person: Person) {
  const helper = new ColumnHelper<LegalDocument & { i: number }>();
  return (
    <div className={s.expandedRow}>
      <Typography.Title level={5}>Legal documents</Typography.Title>
      <Table<LegalDocument & { i: number }>
        rowKey="i"
        data={{
          items: (person.legalDocuments ?? []).map((x, i) => ({ i, ...x })),
        }}
        columns={[
          helper.simple<'documentType'>({
            title: 'Type',
            key: 'documentType',
          }),
          helper.simple<'documentNumber'>({
            title: 'Number',
            key: 'documentNumber',
          }),
          helper.simple<'documentIssuedCountry'>({
            title: 'Issued by',
            key: 'documentIssuedCountry',
            type: COUNTRY,
          }),
          helper.simple({
            title: 'Date of issue',
            key: 'documentIssuedDate',
            type: {
              render: (documentIssuedDate) => (
                <>{documentIssuedDate ? dayjs(documentIssuedDate).format('DD/MM/YYYY') : '-'}</>
              ),
            },
          }),
          helper.simple({
            title: 'Date of expiry',
            key: 'documentExpirationDate',
            type: {
              render: (documentExpirationDate) => (
                <>
                  {documentExpirationDate
                    ? dayjs(documentExpirationDate).format('DD/MM/YYYY')
                    : '-'}
                </>
              ),
            },
          }),
          helper.simple({
            title: 'Tags',
            key: 'tags',
            type: TAGS,
          }),
        ]}
        pagination={false}
        hideFilters={true}
      />
    </div>
  );
}

interface Props {
  persons: Array<Person>;
}

export default function PersonsTable(props: Props) {
  const helper = new ColumnHelper<Person & { i: number }>();
  return (
    <Table<Person & { i: number }>
      hideFilters={true}
      rowKey="i"
      data={{
        items: props.persons.map((person, i) => ({ i, ...person })),
      }}
      renderExpanded={expandedRowRender}
      columns={helper.list([
        helper.group({
          title: 'General details',
          children: [
            helper.simple({
              title: 'Name',
              key: 'generalDetails.name',
              type: {
                render: (name) => <>{formatConsumerName(name)}</>,
              },
            }),
            helper.simple({
              title: 'Residence',
              key: 'generalDetails.countryOfResidence',
              type: COUNTRY,
            }),
            helper.simple({
              title: 'Nationality',
              key: 'generalDetails.countryOfNationality',
              type: COUNTRY,
            }),
          ],
        }),
        helper.group({
          title: 'Contact details',
          children: [
            helper.simple({
              key: 'contactDetails.emailIds',
              title: 'Email',
              type: array(EMAIL),
            }),
            helper.simple({
              key: 'contactDetails.contactNumbers',
              title: 'Phone',
              type: array(STRING),
            }),
            helper.simple({
              title: 'Website',
              key: 'contactDetails.websites',
              type: array(EXTERNAL_LINK),
            }),
            helper.simple({
              title: 'Address',
              key: 'contactDetails.addresses',
              type: array(ADDRESS),
            }),
          ],
        }),
      ])}
      pagination={false}
      fixedExpandedContainer={true}
    />
  );
}
