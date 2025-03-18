import { describe, expect, test } from '@jest/globals';
import { act, render, screen, userEvent, within } from 'testing-library-wrapper';
import '@testing-library/jest-dom';
import { useState } from 'react';
import { findByClass, findCheckbox, getByClass, getNotNull } from 'jest-utils';
import Table from '..';
import { ColumnHelper } from '../columnHelper';
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

    const rows = await within(getNotNull(await findTableBody())).findAllByRole('row');
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row).toHaveTextContent('No data to display');
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
    expect(await findColumn('ID')).toBeInTheDocument();
    expect(await findColumn('First name')).toBeInTheDocument();

    // ACT
    await toggleColumnVisibility('firstName');
    await toggleColumnVisibility('lastName');

    // ASSERT
    expect(await findColumn('ID')).toBeInTheDocument();
    expect(await findColumn('First name')).not.toBeInTheDocument();
    expect(await findColumn('Last name')).not.toBeInTheDocument();

    // ACT
    await toggleColumnVisibility('lastName');
    await toggleColumnVisibility('firstName');

    // ASSERT
    expect(await findColumn('ID')).toBeInTheDocument();
    expect(await findColumn('First name')).toBeInTheDocument();
    expect(await findColumn('Last name')).toBeInTheDocument();
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
  test('Pagination should not appear when there is only one page', async () => {
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
    expect(await findPagination()).not.toBeInTheDocument();
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
    const listItems = await findByClass(pagination, 'ant-pagination-item');
    const pagesCount = Math.ceil(TOTAL_ITEMS / PAGE_SIZE);
    expect(listItems).toHaveLength(pagesCount);
    const withinPagination = within(pagination);
    const tbody = getNotNull(await findTableBody());
    for (let page = 1; page <= pagesCount; page += 1) {
      const pageItems = dataSource(PAGE_SIZE, page);
      // Click on the page and make sure it's active
      await userEvent.click(await withinPagination.findByText(page));
      const pageLink = await getByClass(pagination, 'ant-pagination-item-active');
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
    const rows = await findTableBodyRows();
    expect(rows).toHaveLength(2);
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
    const rows = await findTableBodyRows();
    expect(rows).toHaveLength(1);
  });
});

/*
  Helpers
 */

/*
  Specific helpers
 */

async function findTableBody() {
  return (await screen.findByRole('table')).querySelector('tbody');
}

async function findTableBodyRows() {
  const tableBodyEl = await findTableBody();
  if (tableBodyEl == null) {
    throw new Error(`Unable to find table body`);
  }
  return Array.from(tableBodyEl.querySelectorAll('tr'));
}

async function findColumn(title: string) {
  return await screen.queryByRole('columnheader', { name: `"${title}" column header` });
}
async function findCell(row: HTMLElement, columnId: string) {
  return await within(row).queryByTestId(columnId);
}

async function findPagination() {
  const pagination = await screen.queryByTestId('pagination');
  return pagination;
}

async function clickSettingsButton() {
  await userEvent.click(screen.getByRole('button', { name: 'Settings button' }));
}

async function openSettings() {
  await clickSettingsButton();
}

async function closeSettings() {
  await clickSettingsButton();
}

async function toggleColumnVisibility(columnId: string) {
  await openSettings();
  const popup = await screen.getByTestId('popup-content');
  const checkbox = await findCheckbox(columnId, popup);
  await userEvent.click(checkbox);
  await closeSettings();
}
