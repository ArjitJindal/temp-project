import { Tag, Typography } from 'antd';
import React from 'react';
import s from './styles.module.less';
import { Address, LegalDocument, Person } from '@/apis';
import { formatConsumerName } from '@/utils/api/users';
import CountryDisplay from '@/components/ui/CountryDisplay';
import Table from '@/components/ui/Table';

function expandedRowRender(person: Person) {
  return (
    <div className={s.expandedRow}>
      <Typography.Title level={5}>Legal documents</Typography.Title>
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
            title: 'Type',
            render: (_, document) => document.documentType ?? '-',
          },
          {
            title: 'Number',
            render: (_, document) => document.documentNumber ?? '-',
          },
          {
            title: 'Issued by',
            render: (_, document) => document.documentIssuedCountry ?? '-',
          },
          {
            title: 'Date of issue',
            render: (_, document) => document.documentIssuedDate ?? '-',
          },
          {
            title: 'Date of expiry',
            render: (_, document) => document.documentExpirationDate ?? '-',
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

function renderAddress(address: Address, i: number) {
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
      data={{
        items: props.persons.map((person, i) => ({ i, ...person })),
      }}
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
              render: (_, person) => (
                <CountryDisplay isoCode={person.generalDetails.countryOfResidence} />
              ),
            },
            {
              title: 'Nationality',
              render: (_, person) => (
                <CountryDisplay isoCode={person.generalDetails.countryOfNationality} />
              ),
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
