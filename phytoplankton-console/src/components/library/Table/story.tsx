import React, { useEffect, useMemo, useState } from 'react';
import { groupBy } from 'lodash';
import { BOOLEAN, LONG_TEXT, NUMBER, RISK_LEVEL, STRING } from './standardDataTypes';
import { AllParams, CommonParams, SimpleColumn } from './types';
import { DEFAULT_PARAMS_STATE } from './consts';
import Table from './index';
import { UseCase } from '@/pages/storybook/components';
import Button from '@/components/library/Button';
import { PaginatedData } from '@/utils/queries/hooks';
import { AsyncResource, failed, getOr, init, loading, success } from '@/utils/asyncResource';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { RiskLevel } from '@/utils/risk-levels';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';

interface TableItem {
  id: string; // guid
  isBlocked: boolean;
  firstName: string;
  lastName: string;
  age: number;
  bio: string; // short biography of a person
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  bankAccount: {
    accountNumber: string;
    routingNumber: string;
    bankName: string;
  };
}

interface SimpleTableItem {
  id: string;
  city: string;
  firstName: string;
  lastName: string;
}

type User = InternalBusinessUser | InternalConsumerUser;

export default function (): JSX.Element {
  return (
    <>
      <UseCase title="Header subtitle">
        <WithParams>
          {(params, onChangeParams) => {
            const helper = new ColumnHelper<TableItem>();
            return (
              <Table<TableItem>
                tableId="header_subtitle"
                rowKey="id"
                params={params}
                onChangeParams={onChangeParams}
                columns={helper.list([
                  helper.simple<'firstName'>({
                    key: 'firstName',
                    title: 'First name',
                    subtitle: 'Simple column subtitle',
                    tooltip: 'Tooltip text',
                    sorting: true,
                  }),
                  helper.derived<string>({
                    title: 'Full name',
                    subtitle: 'Derived column subtitle',
                    tooltip: 'Tooltip text',
                    sorting: true,
                    value: (entity): string => `${entity.firstName} ${entity.lastName}`,
                  }),
                  helper.display({
                    title: 'Actions',
                    subtitle: 'Display column subtitle',
                    tooltip: 'Tooltip text',
                    render: () => <></>,
                  }),
                  helper.group({
                    title: 'Address',
                    subtitle: 'Group column subtitle',
                    tooltip: 'Tooltip text',
                    children: [
                      helper.simple<'address.street'>({
                        key: 'address.street',
                        title: 'Street',
                        sorting: true,
                      }),
                      helper.simple<'address.city'>({
                        key: 'address.city',
                        title: 'City',
                        sorting: true,
                      }),
                    ],
                  }),
                ])}
                data={dataSource(params)}
              />
            );
          }}
        </WithParams>
      </UseCase>
      <InternalStateCase />
      <UseCase title="Fixed height">
        <WithParams>
          {(params, onChangeParams) => {
            const helper = new ColumnHelper<TableItem>();
            return (
              <Table<TableItem>
                pagination={true}
                tableId="downloading"
                rowKey="id"
                params={params}
                fitHeight={300}
                onChangeParams={onChangeParams}
                columns={[
                  helper.simple<'firstName'>({
                    key: 'firstName',
                    title: 'First name',
                    filtering: true,
                  }),
                  helper.simple<'lastName'>({
                    key: 'lastName',
                    title: 'Last name',
                    filtering: true,
                    sorting: 'desc',
                  }),
                  helper.simple<'bio'>({
                    key: 'bio',
                    type: LONG_TEXT,
                    title: 'Bio',
                    filtering: true,
                    sorting: true,
                  }),
                  helper.simple<'age'>({
                    key: 'age',
                    type: NUMBER,
                    title: 'Age',
                    filtering: true,
                    sorting: true,
                  }),
                  helper.group({
                    title: 'Address',
                    children: [
                      helper.simple<'address.street'>({
                        key: 'address.street',
                        title: 'Street',
                        filtering: true,
                      }),
                      helper.simple<'address.city'>({
                        key: 'address.city',
                        title: 'City',
                        filtering: true,
                      }),
                      helper.simple<'address.state'>({
                        key: 'address.state',
                        title: 'State',
                        filtering: true,
                      }),
                      helper.simple<'address.zip'>({
                        key: 'address.zip',
                        title: 'Zip',
                        filtering: true,
                      }),
                    ],
                  }),
                  helper.group({
                    title: 'Bank account',
                    children: [
                      helper.simple<'bankAccount.accountNumber'>({
                        key: 'bankAccount.accountNumber',
                        type: STRING,
                        title: 'Account number',
                        filtering: true,
                      }),
                      helper.simple<'bankAccount.routingNumber'>({
                        key: 'bankAccount.routingNumber',
                        type: STRING,
                        title: 'Routing number',
                        filtering: true,
                      }),
                      helper.simple<'bankAccount.bankName'>({
                        key: 'bankAccount.bankName',
                        type: STRING,
                        title: 'Bank name',
                        filtering: true,
                      }),
                    ],
                  }),
                ]}
                data={dataSource(params)}
                onPaginateData={async (params) => dataSource(params)}
              />
            );
          }}
        </WithParams>
      </UseCase>
      <UseCase title="Showing error message">
        <WithParams>
          {(params, onChangeParams) => {
            const helper = new ColumnHelper<TableItem>();
            return (
              <Table<TableItem>
                sizingMode="FULL_WIDTH"
                pagination={true}
                tableId="downloading"
                rowKey="id"
                params={params}
                onChangeParams={onChangeParams}
                columns={helper.list([
                  helper.simple<'firstName'>({
                    key: 'firstName',
                    title: 'First name',
                    filtering: true,
                  }),
                  helper.simple<'lastName'>({
                    key: 'lastName',
                    title: 'Last name',
                    filtering: true,
                    sorting: 'desc',
                  }),
                ])}
                data={failed('Test error message')}
              />
            );
          }}
        </WithParams>
      </UseCase>
      <UseCase title="Full width mode">
        <WithParams>
          {(params, onChangeParams) => {
            const helper = new ColumnHelper<TableItem>();
            return (
              <Table<TableItem>
                sizingMode="FULL_WIDTH"
                pagination={true}
                tableId="downloading"
                rowKey="id"
                params={params}
                onChangeParams={onChangeParams}
                columns={helper.list([
                  helper.simple<'age'>({
                    key: 'age',
                    title: 'Age',
                  }),
                  helper.group({
                    title: 'Name',
                    children: [
                      helper.simple<'firstName'>({
                        key: 'firstName',
                        title: 'First name',
                      }),
                      helper.simple<'lastName'>({
                        key: 'lastName',
                        title: 'Last name',
                      }),
                    ],
                  }),
                ])}
                data={dataSource(params)}
              />
            );
          }}
        </WithParams>
      </UseCase>
      <AsyncFetchCase />
      <UseCase title="Type check">
        <WithParams>
          {(params, onChangeParams) => {
            const helper = new ColumnHelper<User>();
            return (
              <Table<User>
                pagination={true}
                tableId="downloading"
                rowKey="userId"
                params={params}
                onChangeParams={onChangeParams}
                columns={helper.list([
                  helper.simple<'userId'>({
                    key: 'userId',
                    title: 'First name',
                    filtering: true,
                    type: STRING,
                  }),
                  helper.derived<RiskLevel>({
                    value: (entity): RiskLevel => (entity.createdTimestamp > 60 ? 'HIGH' : 'LOW'),
                    title: 'Risk level',
                    filtering: true,
                    type: RISK_LEVEL,
                  }),
                ])}
                data={{
                  items: [],
                }}
              />
            );
          }}
        </WithParams>
      </UseCase>
      <UseCase title="Downloading">
        <WithParams>
          {(params, onChangeParams) => {
            const helper = new ColumnHelper<TableItem>();
            return (
              <Table<TableItem>
                pagination={true}
                tableId="downloading"
                rowKey="id"
                params={params}
                onChangeParams={onChangeParams}
                columns={[
                  helper.simple<'firstName'>({
                    key: 'firstName',
                    title: 'First name',
                    filtering: true,
                  }),
                  helper.simple<'lastName'>({
                    key: 'lastName',
                    title: 'Last name',
                    filtering: true,
                    sorting: 'desc',
                  }),
                  helper.simple<'bio'>({
                    key: 'bio',
                    type: LONG_TEXT,
                    title: 'Bio',
                    filtering: true,
                    sorting: true,
                  }),
                  helper.simple<'age'>({
                    key: 'age',
                    type: NUMBER,
                    title: 'Age',
                    filtering: true,
                    sorting: true,
                  }),
                  helper.group({
                    title: 'Address',
                    children: [
                      helper.simple<'address.street'>({
                        key: 'address.street',
                        title: 'Street',
                        filtering: true,
                      }),
                      helper.simple<'address.city'>({
                        key: 'address.city',
                        title: 'City',
                        filtering: true,
                      }),
                      helper.simple<'address.state'>({
                        key: 'address.state',
                        title: 'State',
                        filtering: true,
                      }),
                      helper.simple<'address.zip'>({
                        key: 'address.zip',
                        title: 'Zip',
                        filtering: true,
                      }),
                    ],
                  }),
                  helper.group({
                    title: 'Bank account',
                    children: [
                      helper.simple<'bankAccount.accountNumber'>({
                        key: 'bankAccount.accountNumber',
                        type: STRING,
                        title: 'Account number',
                        filtering: true,
                      }),
                      helper.simple<'bankAccount.routingNumber'>({
                        key: 'bankAccount.routingNumber',
                        type: STRING,
                        title: 'Routing number',
                        filtering: true,
                      }),
                      helper.simple<'bankAccount.bankName'>({
                        key: 'bankAccount.bankName',
                        type: STRING,
                        title: 'Bank name',
                        filtering: true,
                      }),
                    ],
                  }),
                ]}
                data={dataSource(params)}
                onPaginateData={async (params) => dataSource(params)}
              />
            );
          }}
        </WithParams>
      </UseCase>
      <UseCase title="Row selection">
        <WithParams>
          {(params, onChangeParams) => (
            <Table<TableItem>
              pagination={true}
              tableId="row_selection"
              rowKey="id"
              selection={true}
              selectionActions={[
                (props) => {
                  return (
                    <Button
                      onClick={() => {
                        props.onResetSelection();
                      }}
                      isDisabled={props.isDisabled}
                    >
                      Print
                    </Button>
                  );
                },
              ]}
              params={params}
              onChangeParams={onChangeParams}
              columns={[
                {
                  key: 'firstName',
                  title: 'First name',
                  filtering: true,
                } as SimpleColumn<TableItem, 'firstName'>,
                {
                  key: 'lastName',
                  title: 'Last name',
                  filtering: true,
                  sorting: 'desc',
                } as SimpleColumn<TableItem, 'lastName'>,
                {
                  key: 'bio',
                  type: LONG_TEXT,
                  title: 'Bio',
                  filtering: true,
                  sorting: true,
                } as SimpleColumn<TableItem, 'bio'>,
                {
                  key: 'age',
                  type: NUMBER,
                  title: 'Age',
                  filtering: true,
                  sorting: true,
                } as SimpleColumn<TableItem, 'age'>,
                {
                  title: 'Address',
                  children: [
                    {
                      key: 'address.street',
                      title: 'Street',
                      filtering: true,
                    } as SimpleColumn<TableItem, 'address.street'>,
                    {
                      key: 'address.city',
                      title: 'City',
                      filtering: true,
                    } as SimpleColumn<TableItem, 'address.city'>,
                    {
                      key: 'address.state',
                      title: 'State',
                      filtering: true,
                    } as SimpleColumn<TableItem, 'address.state'>,
                    {
                      key: 'address.zip',
                      title: 'Zip',
                      filtering: true,
                    } as SimpleColumn<TableItem, 'address.zip'>,
                  ],
                },
                {
                  title: 'Bank account',
                  children: [
                    {
                      key: 'bankAccount.accountNumber',
                      type: STRING,
                      title: 'Account number',
                      filtering: true,
                    } as SimpleColumn<TableItem, 'bankAccount.accountNumber'>,
                    {
                      key: 'bankAccount.routingNumber',
                      type: STRING,
                      title: 'Routing number',
                      filtering: true,
                    } as SimpleColumn<TableItem, 'bankAccount.routingNumber'>,
                    {
                      key: 'bankAccount.bankName',
                      type: STRING,
                      title: 'Bank name',
                      filtering: true,
                    } as SimpleColumn<TableItem, 'bankAccount.bankName'>,
                  ],
                },
              ]}
              data={dataSource(params)}
            />
          )}
        </WithParams>
      </UseCase>
      <UseCase title="Row span">
        <WithParams>
          {(params, onChangeParams) => (
            <Table<SimpleTableItem>
              tableId="row_selection"
              rowKey="id"
              selection={true}
              params={params}
              onChangeParams={onChangeParams}
              columns={[
                {
                  key: 'city',
                  title: 'City',
                  filtering: true,
                } as SimpleColumn<SimpleTableItem, 'city'>,
                {
                  key: 'firstName',
                  title: 'First name',
                  filtering: true,
                } as SimpleColumn<SimpleTableItem, 'firstName'>,
                {
                  key: 'lastName',
                  title: 'Last name',
                  filtering: true,
                  sorting: 'desc',
                } as SimpleColumn<SimpleTableItem, 'lastName'>,
              ]}
              renderExpanded={(item) => {
                return (
                  <div>
                    This is an example of expanded row working in row-span mode, it should be only
                    available in last row of group. Item: {JSON.stringify(item)}
                  </div>
                );
              }}
              data={{
                items: Object.entries(groupBy(data, 'address.city')).map(([city, entries]) => ({
                  spanBy: ['city'],
                  rows: entries.map(({ id, firstName, lastName }) => ({
                    id,
                    city,
                    firstName,
                    lastName,
                  })),
                })),
              }}
            />
          )}
        </WithParams>
      </UseCase>
      <UseCase title="Expanding">
        <WithParams>
          {(params, onChangeParams) => (
            <Table<TableItem>
              tableId="expanding_table"
              rowKey="id"
              params={params}
              onChangeParams={onChangeParams}
              columns={[
                {
                  key: 'bio',
                  type: LONG_TEXT,
                  title: 'Bio',
                  filtering: true,
                  sorting: true,
                } as SimpleColumn<TableItem, 'bio'>,
                {
                  title: 'Name',
                  children: [
                    {
                      key: 'firstName',
                      type: STRING,
                      title: 'First name',
                      filtering: true,
                    } as SimpleColumn<TableItem, 'firstName'>,
                    {
                      key: 'lastName',
                      type: STRING,
                      title: 'Last name',
                      filtering: true,
                      sorting: 'desc',
                    } as SimpleColumn<TableItem, 'lastName'>,
                  ],
                },
              ]}
              data={{
                items: data.slice(0, 10),
              }}
              renderExpanded={(item) => {
                return <h1>Bio: {item.bio}</h1>;
              }}
            />
          )}
        </WithParams>
      </UseCase>
      <UseCase title="Partial expanding">
        <WithParams>
          {(params, onChangeParams) => (
            <Table<TableItem>
              tableId="partial_expanding_table"
              rowKey="id"
              params={params}
              onChangeParams={onChangeParams}
              columns={[
                {
                  key: 'bio',
                  type: LONG_TEXT,
                  title: 'Bio',
                  filtering: true,
                  sorting: true,
                } as SimpleColumn<TableItem, 'bio'>,
                {
                  title: 'Name',
                  children: [
                    {
                      key: 'firstName',
                      type: STRING,
                      title: 'First name',
                      filtering: true,
                    } as SimpleColumn<TableItem, 'firstName'>,
                    {
                      key: 'lastName',
                      type: STRING,
                      title: 'Last name',
                      filtering: true,
                      sorting: 'desc',
                    } as SimpleColumn<TableItem, 'lastName'>,
                  ],
                },
              ]}
              data={{
                items: data.slice(0, 10),
              }}
              renderExpanded={(item) => {
                return <h1>Bit: {item.bio}</h1>;
              }}
              isExpandable={(row) => {
                return row.content.age > 45;
              }}
            />
          )}
        </WithParams>
      </UseCase>
      <UseCase title="Sorting">
        <WithParams>
          {(params, onChangeParams) => (
            <Table<TableItem>
              rowKey="id"
              params={params}
              onChangeParams={onChangeParams}
              columns={[
                {
                  key: 'bio',
                  type: LONG_TEXT,
                  title: 'Bio',
                  filtering: true,
                  sorting: true,
                } as SimpleColumn<TableItem, 'bio'>,
                {
                  title: 'Name',
                  children: [
                    {
                      key: 'firstName',
                      type: STRING,
                      title: 'First name',
                      filtering: true,
                    } as SimpleColumn<TableItem, 'firstName'>,
                    {
                      key: 'lastName',
                      type: STRING,
                      title: 'Last name',
                      filtering: true,
                      sorting: 'desc',
                    } as SimpleColumn<TableItem, 'lastName'>,
                  ],
                },
              ]}
              data={{
                items: data.slice(0, 10),
              }}
            />
          )}
        </WithParams>
      </UseCase>
      <UseCase title="Simplest table">
        <Table<TableItem>
          rowKey="id"
          columns={[
            { key: 'firstName', type: STRING, title: 'First name' } as SimpleColumn<
              TableItem,
              'firstName'
            >,
            { key: 'lastName', type: STRING, title: 'Last name' } as SimpleColumn<
              TableItem,
              'lastName'
            >,
            { key: 'bio', type: LONG_TEXT, title: 'Bio' } as SimpleColumn<TableItem, 'bio'>,
          ]}
          data={{
            items: data.slice(0, 10),
          }}
        />
      </UseCase>
      <UseCase title="Group columns">
        <Table<TableItem>
          rowKey="id"
          columns={[
            { key: 'bio', type: LONG_TEXT, title: 'Bio' } as SimpleColumn<TableItem, 'bio'>,
            {
              title: 'Name',
              children: [
                { key: 'firstName', type: STRING, title: 'First name' } as SimpleColumn<
                  TableItem,
                  'firstName'
                >,
                { key: 'lastName', type: STRING, title: 'Last name' } as SimpleColumn<
                  TableItem,
                  'lastName'
                >,
              ],
            },
          ]}
          data={{
            items: data.slice(0, 10),
          }}
        />
      </UseCase>
      <PaginationCase />
      <UseCase title="Auto filters">
        <Table<TableItem>
          rowKey="id"
          columns={[
            { key: 'bio', type: LONG_TEXT, title: 'Bio', filtering: true } as SimpleColumn<
              TableItem,
              'bio'
            >,
            {
              title: 'Name',
              children: [
                {
                  key: 'firstName',
                  type: STRING,
                  title: 'First name',
                  filtering: true,
                } as SimpleColumn<TableItem, 'firstName'>,
                {
                  key: 'lastName',
                  type: STRING,
                  title: 'Last name',
                  filtering: true,
                } as SimpleColumn<TableItem, 'lastName'>,
              ],
            },
          ]}
          data={{
            items: data.slice(0, 10),
          }}
        />
      </UseCase>
      <UseCase title="Skeleton mode">
        <WithParams>
          {(params, onChangeParams) => {
            const helper = new ColumnHelper<TableItem>();
            return (
              <Table<TableItem>
                tableId="header_subtitle"
                rowKey="id"
                params={params}
                onChangeParams={onChangeParams}
                columns={helper.list([
                  helper.simple<'firstName'>({
                    key: 'firstName',
                    title: 'First name',
                    subtitle: 'Simple column subtitle',
                    tooltip: 'Tooltip text',
                    sorting: true,
                  }),
                  helper.derived<string>({
                    title: 'Full name',
                    subtitle: 'Derived column subtitle',
                    tooltip: 'Tooltip text',
                    sorting: true,
                    value: (entity): string => `${entity.firstName} ${entity.lastName}`,
                  }),
                  helper.display({
                    title: 'Actions',
                    subtitle: 'Display column subtitle',
                    tooltip: 'Tooltip text',
                    render: () => <></>,
                  }),
                  helper.group({
                    title: 'Address',
                    subtitle: 'Group column subtitle',
                    tooltip: 'Tooltip text',
                    children: [
                      helper.simple<'address.street'>({
                        key: 'address.street',
                        title: 'Street',
                        sorting: true,
                      }),
                      helper.simple<'address.city'>({
                        key: 'address.city',
                        title: 'City',
                        sorting: true,
                      }),
                    ],
                  }),
                ])}
                data={loading()}
              />
            );
          }}
        </WithParams>
      </UseCase>
    </>
  );
}

function PaginationCase() {
  const [params, setParams] = useState<CommonParams>({
    ...DEFAULT_PARAMS_STATE,
  });

  const { page = 1 } = params;
  return (
    <UseCase title="Pagination">
      <Table<TableItem>
        rowKey="id"
        params={params}
        onChangeParams={setParams}
        columns={[
          { key: 'bio', type: LONG_TEXT, title: 'Bio' } as SimpleColumn<TableItem, 'bio'>,
          {
            title: 'Name',
            children: [
              { key: 'firstName', type: STRING, title: 'First name' } as SimpleColumn<
                TableItem,
                'firstName'
              >,
              { key: 'lastName', type: STRING, title: 'Last name' } as SimpleColumn<
                TableItem,
                'lastName'
              >,
            ],
          },
        ]}
        data={{
          total: data.length,
          items: data.slice((page - 1) * params.pageSize, page * params.pageSize),
        }}
        pagination={true}
      />
    </UseCase>
  );
}

function dataSource(params: { page?: number; pageSize: number }): PaginatedData<TableItem> {
  const { page = 1, pageSize } = params;
  return {
    total: data.length,
    items: data.slice((page - 1) * pageSize, page * pageSize),
  };
}

function WithParams<Params>(props: {
  children: (
    params: AllParams<Params>,
    onChangeParams: (newParams: AllParams<Params>) => void,
  ) => React.ReactNode;
}) {
  const [params, setParams] = useState<AllParams<Params>>(
    DEFAULT_PARAMS_STATE as AllParams<Params>,
  );

  return <>{props.children(params, setParams)}</>;
}

function InternalStateCase() {
  const [dataState, setDataState] = useState<TableItem[]>(data.slice(0, 5));

  // When working with editing need to make sure that columns definition are not changing between renders, it could lead
  // to redrawing input and loosing focus. Use `useMemo` or define columns statically
  const columns = useMemo(() => {
    const helper = new ColumnHelper<TableItem>();
    return helper.list([
      helper.simple<'firstName'>({
        title: 'First name',
        key: 'firstName',
        type: STRING,
        defaultEditState: true,
      }),
      helper.simple<'lastName'>({
        title: 'Last name',
        key: 'lastName',
        type: STRING,
        defaultEditState: true,
      }),
      helper.simple<'age'>({
        title: 'Age',
        key: 'age',
        type: NUMBER,
        defaultEditState: true,
      }),
      helper.simple<'isBlocked'>({
        title: 'Is blocked',
        key: 'isBlocked',
        type: BOOLEAN,
        defaultEditState: true,
      }),
      helper.simple<'bio'>({
        title: 'Biography',
        key: 'bio',
        type: LONG_TEXT,
        defaultEditState: true,
      }),
    ]);
  }, []);

  return (
    <UseCase title="Internal state">
      <Table<TableItem>
        tableId="internal_state"
        rowKey="id"
        onEdit={(rowKey, newItem) => {
          setDataState((data) => data.map((x) => (x.id === rowKey ? newItem : x)));
        }}
        columns={columns}
        data={success({ items: dataState })}
      />
      <h3>The same data in read-only mode:</h3>
      <Table<TableItem>
        tableId="internal_state_display"
        rowKey="id"
        columns={columns}
        externalHeader={true}
        data={success({ items: dataState })}
      />
    </UseCase>
  );
}

function AsyncFetchCase() {
  const [params, setParams] = useState<AllParams<CommonParams>>(
    DEFAULT_PARAMS_STATE as AllParams<CommonParams>,
  );

  const { page = 1, pageSize } = params;

  const [result, setResult] = useState<AsyncResource<PaginatedData<TableItem>>>(init());

  useEffect(() => {
    setResult((prevState) => loading(getOr(prevState, { items: [] })));
    setTimeout(() => {
      setResult(
        success({
          total: data.length,
          items: data.slice((page - 1) * pageSize, page * pageSize),
        }),
      );
    }, 100 + Math.ceil(Math.random() * 900));
  }, [page, pageSize]);

  const helper = new ColumnHelper<TableItem>();
  return (
    <UseCase title="Async data fetching">
      <Table<TableItem>
        pagination={true}
        tableId="downloading"
        rowKey="id"
        params={params}
        onChangeParams={setParams}
        columns={[
          helper.simple<'firstName'>({
            key: 'firstName',
            title: 'First name',
            filtering: true,
          }),
          helper.simple<'lastName'>({
            key: 'lastName',
            title: 'Last name',
            filtering: true,
            sorting: 'desc',
          }),
          helper.simple<'bio'>({
            key: 'bio',
            type: LONG_TEXT,
            title: 'Bio',
            filtering: true,
            sorting: true,
          }),
          helper.simple<'age'>({
            key: 'age',
            type: NUMBER,
            title: 'Age',
            filtering: true,
            sorting: true,
          }),
          helper.group({
            title: 'Address',
            children: [
              helper.simple<'address.street'>({
                key: 'address.street',
                title: 'Street',
                filtering: true,
              }),
              helper.simple<'address.city'>({
                key: 'address.city',
                title: 'City',
                filtering: true,
              }),
              helper.simple<'address.state'>({
                key: 'address.state',
                title: 'State',
                filtering: true,
              }),
              helper.simple<'address.zip'>({
                key: 'address.zip',
                title: 'Zip',
                filtering: true,
              }),
            ],
          }),
          helper.group({
            title: 'Bank account',
            children: helper.list([
              helper.simple<'bankAccount.accountNumber'>({
                key: 'bankAccount.accountNumber',
                type: STRING,
                title: 'Account number',
                filtering: true,
              }),
              helper.simple<'bankAccount.routingNumber'>({
                key: 'bankAccount.routingNumber',
                type: STRING,
                title: 'Routing number',
                filtering: true,
              }),
              helper.simple<'bankAccount.bankName'>({
                key: 'bankAccount.bankName',
                type: STRING,
                title: 'Bank name',
                filtering: true,
              }),
            ]),
          }),
        ]}
        data={result}
        onPaginateData={async (params) => dataSource(params)}
      />
    </UseCase>
  );
}

// Chat GPT: Generate JSON array containing description of 3 fake people, containing following fields: id, firstName, lastName, bio, address, bankAccount. Field 'bio' should contain fake biography of a person, field 'address' should contain a JSON object with fake address details, field id should be a random GUID, field 'bankAccount' should contain fake details about bank account

const data: TableItem[] = [
  {
    id: '11111111-5b01-4b38-9b9e-d64f1ab0c67a',
    isBlocked: false,
    firstName:
      'Pablo Diego José Francisco de Paula Juan Nepomuceno María de los Remedios Cipriano de la Santísima Trinidad Ruiz y',
    lastName: 'Picasso',
    age: 91,
    bio: "Pablo Ruiz Picasso was a Spanish painter, sculptor, printmaker, ceramicist and theatre designer who spent most of his adult life in France. One of the most influential artists of the 20th century, he is known for co-founding the Cubist movement, the invention of constructed sculpture,[8][9] the co-invention of collage, and for the wide variety of styles that he helped develop and explore. Among his most famous works are the proto-Cubist Les Demoiselles d'Avignon (1907), and the anti-war painting Guernica (1937), a dramatic portrayal of the bombing of Guernica by German and Italian air forces during the Spanish Civil War.",
    address: {
      street: 'Unknown',
      city: 'Málaga',
      state: 'Spain',
      zip: '-',
    },
    bankAccount: {
      accountNumber: '1234567890',
      routingNumber: '021000021',
      bankName: 'Pablo Picasso',
    },
  },
  {
    id: '0832d96e-5b01-4b38-9b9e-d64f1ab0c67a',
    isBlocked: false,
    firstName: 'Sophia',
    lastName: 'Miller',
    age: 32,
    bio: 'Sophia is a graphic designer with a passion for creating beautiful and functional designs. She has a degree in graphic design from Parsons School of Design and has worked for several design agencies. In her free time, she enjoys painting and visiting art galleries.',
    address: {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zip: '10001',
    },
    bankAccount: {
      accountNumber: '1234567890',
      routingNumber: '021000021',
      bankName: 'JPMorgan Chase Bank',
    },
  },
  {
    id: 'e542af18-53e8-4c2b-98ed-f0ee9a74a888',
    isBlocked: false,
    firstName: 'Jackson',
    lastName: 'Garcia',
    age: 41,
    bio: 'Jackson is a software engineer with a passion for creating innovative software solutions. He has a degree in computer science from Stanford University and has worked for several tech companies. In his free time, he enjoys playing video games and watching sci-fi movies.',
    address: {
      street: '456 Elm St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94110',
    },
    bankAccount: {
      accountNumber: '2345678901',
      routingNumber: '121000358',
      bankName: 'Bank of America',
    },
  },
  {
    id: 'e98e18c1-7d3a-46e2-b28f-ee08d43ebd9d',
    isBlocked: false,
    firstName: 'Olivia',
    lastName: 'Taylor',
    age: 29,
    bio: 'Olivia is a marketing executive with a passion for building strong brands. She has a degree in marketing from the Wharton School at the University of Pennsylvania and has worked for several Fortune 500 companies. In her free time, she enjoys traveling and trying new foods.',
    address: {
      street: '789 Oak St',
      city: 'Chicago',
      state: 'IL',
      zip: '60611',
    },
    bankAccount: {
      accountNumber: '3456789012',
      routingNumber: '071000013',
      bankName: 'JP Morgan Chase',
    },
  },
  {
    id: 'e6e46f6b-ee6b-48c9-9f94-3c25f5631d39',
    isBlocked: false,
    firstName: 'Emma',
    lastName: 'Smith',
    age: 41,
    bio: 'Emma is a software developer with a passion for building scalable and robust applications. She has a degree in computer science from MIT and has worked for several tech startups. In her free time, she enjoys hiking and photography.',
    address: {
      street: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94110',
    },
    bankAccount: {
      accountNumber: '1234567890',
      routingNumber: '021000021',
      bankName: 'JPMorgan Chase Bank',
    },
  },
  {
    id: '9f7a6a8e-48e7-48aa-95a7-6d5538d25ecf',
    isBlocked: false,
    firstName: 'Ethan',
    lastName: 'Johnson',
    age: 49,
    bio: 'Ethan is a product manager with a passion for creating user-centric products. He has a degree in business from Harvard University and has worked for several tech companies. In his free time, he enjoys playing basketball and cooking.',
    address: {
      street: '456 Elm St',
      city: 'New York',
      state: 'NY',
      zip: '10001',
    },
    bankAccount: {
      accountNumber: '2345678901',
      routingNumber: '121000358',
      bankName: 'Bank of America',
    },
  },
  {
    id: 'd99801c9-7ca6-439e-bbea-53bfb37dc1f2',
    isBlocked: false,
    firstName: 'Ava',
    lastName: 'Brown',
    age: 46,
    bio: 'Ava is a marketing specialist with a passion for creating effective marketing campaigns. She has a degree in marketing from Columbia University and has worked for several marketing agencies. In her free time, she enjoys playing guitar and traveling.',
    address: {
      street: '789 Oak St',
      city: 'Chicago',
      state: 'IL',
      zip: '60611',
    },
    bankAccount: {
      accountNumber: '3456789012',
      routingNumber: '071000013',
      bankName: 'JP Morgan Chase',
    },
  },
  {
    id: 'ab18f0b5-74a5-4c4f-b4d4-d4e9d3a71db8',
    isBlocked: false,
    firstName: 'Noah',
    lastName: 'Davis',
    age: 53,
    bio: 'Noah is a data scientist with a passion for solving complex problems using data. He has a degree in statistics from Stanford University and has worked for several tech companies. In his free time, he enjoys playing chess and reading science fiction.',
    address: {
      street: '234 Pine St',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90001',
    },
    bankAccount: {
      accountNumber: '4567890123',
      routingNumber: '122000661',
      bankName: 'Bank of America',
    },
  },
  {
    id: 'f1e2d3c4-b5a6-4c3b-a2f1-7e6d5c4b3a2f',
    isBlocked: false,
    firstName: 'Sophia',
    lastName: 'Garcia',
    age: 76,
    bio: 'Sophia is a graphic designer with a passion for creating beautiful and functional designs. She has a degree in graphic design from Parsons School of Design and has worked for several design agencies. In her free time, she enjoys painting and hiking.',
    address: {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zip: '10001',
    },
    bankAccount: {
      accountNumber: '1234567890',
      routingNumber: '021000021',
      bankName: 'JPMorgan Chase Bank',
    },
  },
  {
    id: 'e5f4d3c2-b1a0-9z8y-7x6w-4v3u2t1s0r9q',
    isBlocked: false,
    firstName: 'Liam',
    lastName: 'Martinez',
    age: 41,
    bio: 'Liam is a software engineer with a passion for building innovative and scalable products. He has a degree in computer science from MIT and has worked for several tech startups. In his free time, he enjoys playing soccer and traveling.',
    address: {
      street: '456 Elm St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94110',
    },
    bankAccount: {
      accountNumber: '2345678901',
      routingNumber: '121000358',
      bankName: 'Bank of America',
    },
  },
  {
    id: 'd2c3b4a5-e6f7-8g9h-1i2j-3k4l5m6n7o8p',
    isBlocked: false,
    firstName: 'Isabella',
    lastName: 'Lee',
    age: 24,
    bio: 'Isabella is a marketing manager with a passion for creating effective marketing strategies. She has a degree in marketing from Columbia University and has worked for several marketing agencies. In her free time, she enjoys practicing yoga and hiking.',
    address: {
      street: '789 Oak St',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90001',
    },
    bankAccount: {
      accountNumber: '3456789012',
      routingNumber: '071000013',
      bankName: 'JP Morgan Chase',
    },
  },
  {
    id: 'a0b1c2d3-e4f5-6g7h-8i9j-k1l2m3n4o5p6',
    isBlocked: false,
    firstName: 'Emma',
    lastName: 'Johnson',
    age: 64,
    bio: 'Emma is a journalist with a passion for investigative reporting. She has a degree in journalism from Northwestern University and has worked for several news organizations. In her free time, she enjoys reading and hiking.',
    address: {
      street: '1234 Maple St',
      city: 'Chicago',
      state: 'IL',
      zip: '60601',
    },
    bankAccount: {
      accountNumber: '123456789',
      routingNumber: '071000013',
      bankName: 'JP Morgan Chase',
    },
  },
  {
    id: 'b0c1d2e3-f4g5-6h7i-8j9k-l1m2n3o4p5q',
    isBlocked: false,
    firstName: 'William',
    lastName: 'Smith',
    age: 34,
    bio: 'William is a lawyer with a passion for defending the rights of his clients. He has a degree in law from Harvard University and has worked for several law firms. In his free time, he enjoys playing tennis and traveling.',
    address: {
      street: '5678 Oak St',
      city: 'New York',
      state: 'NY',
      zip: '10001',
    },
    bankAccount: {
      accountNumber: '234567890',
      routingNumber: '021000021',
      bankName: 'JPMorgan Chase Bank',
    },
  },
  {
    id: 'c0d1e2f3-g4h5-6i7j-8k9l-m1n2o3p4q5r',
    isBlocked: false,
    firstName: 'Olivia',
    lastName: 'Davis',
    age: 41,
    bio: 'Olivia is a teacher with a passion for helping her students learn and grow. She has a degree in education from Stanford University and has worked for several schools. In her free time, she enjoys reading and hiking.',
    address: {
      street: '9012 Pine St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94110',
    },
    bankAccount: {
      accountNumber: '345678901',
      routingNumber: '121000358',
      bankName: 'Bank of America',
    },
  },
  {
    id: 'a0b1c2d3-1111-6g7h-8i9j-k1l2m3n4o5p6',
    isBlocked: false,
    firstName: 'John',
    lastName: 'Doe',
    age: 81,
    bio: 'John is a software engineer with a passion for building complex systems. He has a degree in computer science from MIT and has worked for several tech companies. In his free time, he enjoys playing video games and listening to music.',
    address: {
      street: '1234 Main St',
      city: 'Seattle',
      state: 'WA',
      zip: '98101',
    },
    bankAccount: {
      accountNumber: '123456789',
      routingNumber: '121000358',
      bankName: 'Bank of America',
    },
  },
  {
    id: 'b0c1d2e3-1234-6h7i-8j9k-l1m2n3o4p5q',
    isBlocked: false,
    firstName: 'Emma',
    lastName: 'Garcia',
    age: 87,
    bio: 'Emma is a marketing executive with a passion for creating engaging campaigns. She has a degree in marketing from the University of Texas and has worked for several advertising agencies. In her free time, she enjoys practicing yoga and traveling.',
    address: {
      street: '5678 Market St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
    },
    bankAccount: {
      accountNumber: '234567890',
      routingNumber: '021000021',
      bankName: 'JPMorgan Chase Bank',
    },
  },
  {
    id: 'c0d1e2f3-g4h5-6i7j-1111-m1n2o3p4q5r',
    isBlocked: false,
    firstName: 'Emily',
    lastName: 'Lee',
    age: 29,
    bio: 'Emily is a graphic designer with a passion for creating beautiful and functional designs. She has a degree in graphic design from the Rhode Island School of Design and has worked for several design agencies. In her free time, she enjoys painting and hiking.',
    address: {
      street: '9012 Pine St',
      city: 'Providence',
      state: 'RI',
      zip: '02903',
    },
    bankAccount: {
      accountNumber: '345678901',
      routingNumber: '071000013',
      bankName: 'JP Morgan Chase',
    },
  },
];
