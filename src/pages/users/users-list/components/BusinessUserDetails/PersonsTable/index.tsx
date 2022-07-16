import { Tag, Typography } from 'antd';
import React from 'react';
import s from './styles.module.less';
import { Address2, LegalDocument1, Person } from '@/apis';
import Table from '@/components/ui/Table';
import { formatConsumerName } from '@/utils/api/users';

function expandedRowRender(person: Person) {
  return (
    <div className={s.expandedRow}>
      <Typography.Title level={5}>Legal documents</Typography.Title>
      <Table<LegalDocument1 & { i: number }>
        className={s.table}
        search={false}
        form={{
          labelWrap: true,
        }}
        rowKey="i"
        dataSource={(person.legalDocuments ?? []).map((x, i) => ({ i, ...x }))}
        columns={[
          {
            title: 'Type',
            render: (_, document) => document.documentType ?? 'N/A',
          },
          {
            title: 'Number',
            render: (_, document) => document.documentNumber ?? 'N/A',
          },
          {
            title: 'Issued by',
            render: (_, document) => document.documentIssuedCountry ?? 'N/A',
          },
          {
            title: 'Date of issue',
            render: (_, document) => document.documentIssuedDate ?? 'N/A',
          },
          {
            title: 'Date of expiry',
            render: (_, document) => document.documentExpirationDate ?? 'N/A',
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
  );
}

function renderWebsite(website: string, i: number) {
  return (
    <p key={i}>
      <a key={i} href={website} target="_blank">
        {website}
      </a>
    </p>
  );
}

function renderEmail(email: string, i: number) {
  return (
    <a key={i} href={`mailto:${email}`}>
      {email}
    </a>
  );
}

function renderAddress(address: Address2, i: number) {
  return (
    <p key={i}>
      {[
        ...address.addressLines,
        [address.city, address.state].filter((x) => !!x).join(', '),
        address.postcode,
        address.country,
      ]
        .filter((x) => !!x)
        .map((str, j) => (
          <React.Fragment key={j}>
            {j !== 0 && <br />}
            {str}
          </React.Fragment>
        ))}
    </p>
  );
}

interface Props {
  persons: Array<Person>;
}

export default function PersonsTable(props: Props) {
  return (
    <Table<Person & { i: number }>
      className={s.table}
      search={false}
      form={{
        labelWrap: true,
      }}
      rowKey="i"
      dataSource={props.persons.map((person, i) => ({ i, ...person }))}
      expandable={{ expandedRowRender }}
      columns={[
        {
          title: 'General details',
          children: [
            {
              title: 'Name',
              render: (_, person) => formatConsumerName(person.generalDetails.name),
            },
            {
              title: 'Residence',
              render: (_, person) => person.generalDetails.countryOfResidence ?? 'N/A',
            },
            {
              title: 'Nationality',
              render: (_, person) => person.generalDetails.countryOfNationality ?? 'N/A',
            },
          ],
        },
        {
          title: 'Contact Details',
          children: [
            {
              title: 'Email',
              render: (_, person) => <>{person.contactDetails?.emailIds?.map(renderEmail) ?? ''}</>,
            },
            {
              title: 'Phone',
              render: (_, person) => person.contactDetails?.contactNumbers?.join(', ') ?? '',
            },
            {
              title: 'Website',
              render: (_, person) => (
                <>{person.contactDetails?.websites?.map(renderWebsite) ?? ''}</>
              ),
            },
            {
              title: 'Address',
              render: (_, person) => (
                <>{person.contactDetails?.addresses?.map(renderAddress) ?? ''}</>
              ),
            },
          ],
        },
      ]}
      pagination={false}
      options={{
        reload: false,
        density: false,
        setting: false,
      }}
      scroll={{ x: 1300 }}
    />
  );
}
