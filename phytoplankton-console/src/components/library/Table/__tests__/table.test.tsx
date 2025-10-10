import { describe, test, expect } from '@jest/globals';
import '@testing-library/jest-dom';
import '@testing-library/jest-dom/extend-expect';

import { getNotNull } from 'jest-utils';
import { act, render, screen, userEvent, within } from 'testing-library-wrapper';
import { useState } from 'react';
import Table from '..';
import { ColumnHelper } from '../columnHelper';
import {
  findTableBody,
  findCell,
  findPagination,
  expectRowCount,
  expectColumnVisible,
  expectEmptyTable,
  toggleColumnVisibility,
} from './table.jest-helpers';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { AllParams } from '@/components/library/Table/types';

type Person = {
  id: string;
  firstName: string;
  lastName: string;
};

const helper = new ColumnHelper<Person>();

describe('Basic data rendering', () => {
  test('Empty table should not contain any data rows', async () => {
    render(
      <Table<Person>
        rowKey={'id'}
        data={{ items: [] }}
        columns={[
          helper.simple({
            key: 'id',
            title: 'ID',
          }),
        ]}
      />,
    );

    await expectEmptyTable();
  });
  test('One row data should be rendered to a single row', async () => {
    render(
      <Table<Person>
        rowKey={'id'}
        data={{ items: [{ id: '111', firstName: 'Jack', lastName: 'Dow' }] }}
        columns={[
          helper.simple({
            key: 'id',
            title: 'ID',
          }),
        ]}
      />,
    );

    const tbody = getNotNull((await screen.findByRole('table')).querySelector('tbody'));
    const withinTbody = within(tbody);
    const findAllByRole = await withinTbody.findAllByRole('row');
    expect(findAllByRole).toHaveLength(1);
  });
});

describe('Settings', () => {
  test('Check that settings button opens popup', async () => {
    render(
      <Table<Person>
        rowKey={'id'}
        data={{ items: [{ id: '111', firstName: 'Jack', lastName: 'Dow' }] }}
        columns={[
          helper.simple({
            key: 'id',
            title: 'ID',
          }),
        ]}
      />,
    );

    // ACT
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Settings button' }));
    });

    // ASSERT
    expect(await screen.getByTestId('popup-content')).toBeInTheDocument();
  });

  test('Check that disabled column hiding and showing', async () => {
    render(
      <Table<Person>
        rowKey={'id'}
        data={{ items: [{ id: '111', firstName: 'Jack', lastName: 'Dow' }] }}
        columns={[
          helper.simple({
            key: 'id',
            title: 'ID',
          }),
          helper.simple({
            key: 'firstName',
            title: 'First name',
          }),
          helper.simple({
            key: 'lastName',
            title: 'Last name',
          }),
        ]}
      />,
    );

    // ASSERT
    await expectColumnVisible('ID', true);
    await expectColumnVisible('First name', true);

    // ACT
    await toggleColumnVisibility('firstName');
    await toggleColumnVisibility('lastName');

    // ASSERT
    await expectColumnVisible('ID', true);
    await expectColumnVisible('First name', false);
    await expectColumnVisible('Last name', false);

    // ACT
    await toggleColumnVisibility('lastName');
    await toggleColumnVisibility('firstName');

    // ASSERT
    await expectColumnVisible('ID', true);
    await expectColumnVisible('First name', true);
    await expectColumnVisible('Last name', true);
  });
});

const TOTAL_ITEMS = 95;
const PAGE_SIZE = 20;
const dataSource = (pageSize: number, page: number) => {
  const result = [...new Array(TOTAL_ITEMS)].map((_, i) => {
    return { id: `person_${i}`, firstName: `Jack #${i}`, lastName: `Dow #${i}` };
  });
  return result.slice((page - 1) * pageSize, page * pageSize);
};

describe('Pagination', () => {
  test('Pagination should appear when there is only one page', async () => {
    const items = dataSource(PAGE_SIZE, 1);
    render(
      <Table<Person>
        rowKey={'id'}
        data={{ items: [items[0]], total: 1 }}
        columns={[
          helper.simple({
            key: 'id',
            title: 'ID',
          }),
        ]}
      />,
    );

    // ASSERT
    expect(await findPagination()).toBeInTheDocument();
  });

  test('Pagination should appear when there are more than one page', async () => {
    const items = dataSource(PAGE_SIZE, 1);
    render(
      <Table<Person>
        rowKey={'id'}
        data={{ items, total: TOTAL_ITEMS }}
        columns={[
          helper.simple({
            key: 'id',
            title: 'ID',
          }),
        ]}
      />,
    );

    // ASSERT
    expect(await findPagination()).toBeInTheDocument();
  });

  test('Check if pages are switching properly and pages contain right elements', async () => {
    function TestComponent() {
      const [params, setParams] = useState<AllParams<unknown>>(DEFAULT_PARAMS_STATE);

      const items = dataSource(params.pageSize ?? PAGE_SIZE, params.page ?? 1);
      return (
        <Table<Person>
          rowKey={'id'}
          data={{ items, total: TOTAL_ITEMS }}
          columns={[
            helper.simple({
              key: 'id',
              title: 'ID',
            }),
            helper.simple({
              key: 'firstName',
              title: 'First name',
            }),
            helper.simple({
              key: 'lastName',
              title: 'Last name',
            }),
          ]}
          params={params}
          onChangeParams={(newParams) => setParams(newParams)}
        />
      );
    }

    render(<TestComponent />);

    const pagination = getNotNull(await findPagination());
    const withinPagination = within(pagination);
    const listItems = await withinPagination.findAllByTestId('pagination-page-number-button');
    const pagesCount = Math.ceil(TOTAL_ITEMS / PAGE_SIZE);
    expect(listItems).toHaveLength(pagesCount);
    const tbody = getNotNull(await findTableBody());
    for (let page = 1; page <= pagesCount; page += 1) {
      const pageItems = dataSource(PAGE_SIZE, page);
      // Click on the page and make sure it's active
      const buttonByNumber = listItems.find((x) => x.textContent === `${page}`);
      expect(buttonByNumber).not.toBeNull();
      await userEvent.click(buttonByNumber as HTMLElement);
      const pageLink = await withinPagination.findByRole('button', { current: true });
      expect(pageLink).toHaveTextContent(`${page}`);
      // Check if page contain proper items
      const rows = await within(tbody).findAllByRole('row');
      expect(rows).toHaveLength(pageItems.length);
      for (let i = 0; i < pageItems.length; ++i) {
        const row = rows[i];
        const item = pageItems[i];
        expect(getNotNull(await findCell(row, 'id'))).toHaveTextContent(item.id);
        expect(getNotNull(await findCell(row, 'firstName'))).toHaveTextContent(item.firstName);
        expect(getNotNull(await findCell(row, 'lastName'))).toHaveTextContent(item.lastName);
      }
    }
  });

  test('Multi-rows renders into multiple row', async () => {
    function TestComponent() {
      const [params, setParams] = useState<AllParams<unknown>>(DEFAULT_PARAMS_STATE);
      return (
        <Table<Person>
          rowKey={'id'}
          data={{
            items: [
              {
                spanBy: ['id'],
                rows: [
                  {
                    id: 'test1',
                    firstName: 'John',
                    lastName: 'Dow',
                  },
                  {
                    id: 'test1',
                    firstName: 'Mike',
                    lastName: 'Smith',
                  },
                ],
              },
            ],
            total: 1,
          }}
          columns={[
            helper.simple({
              key: 'id',
              title: 'ID',
            }),
            helper.simple({
              key: 'firstName',
              title: 'First name',
            }),
            helper.simple({
              key: 'lastName',
              title: 'Last name',
            }),
          ]}
          params={params}
          onChangeParams={(newParams) => setParams(newParams)}
        />
      );
    }
    render(<TestComponent />);
    await expectRowCount(2);
  });

  test('Multi-rows collapse into single row if all visible columns are marked as spanned', async () => {
    function TestComponent() {
      const [params, setParams] = useState<AllParams<unknown>>(DEFAULT_PARAMS_STATE);
      return (
        <Table<Person>
          rowKey={'id'}
          data={{
            items: [
              {
                spanBy: ['id'],
                rows: [
                  {
                    id: 'test1',
                    firstName: 'John',
                    lastName: 'Dow',
                  },
                  {
                    id: 'test1',
                    firstName: 'Mike',
                    lastName: 'Smith',
                  },
                ],
              },
            ],
            total: 1,
          }}
          columns={[
            helper.simple({
              key: 'id',
              title: 'ID',
            }),
            helper.simple({
              key: 'firstName',
              title: 'First name',
              hideInTable: true,
            }),
            helper.simple({
              key: 'lastName',
              title: 'Last name',
              hideInTable: true,
            }),
          ]}
          params={params}
          onChangeParams={(newParams) => setParams(newParams)}
        />
      );
    }
    render(<TestComponent />);
    await expectRowCount(1);
  });
});
