import { describe, expect, test } from '@jest/globals';
import { transformCSVTableRows, transformXLSXTableRows } from '../Header/Tools/DownloadButton';

interface Row {
  id: number;
  name: string;
  age: number;
}

const COLUMNS_BASIC = [
  { key: 'id', title: 'ID', value: (row: Row) => row.id },
  { key: 'name', title: 'Name', value: (row: Row) => row.name },
  { key: 'age', title: 'Age', value: (row: Row) => row.age },
];

const COLUMNS_ADVANCED = [
  {
    key: 'id',
    title: 'ID',
    value: (row: Row) => row.id,
    type: {
      stringify: (value) => `#${value}`,
      link: (value) => `/example/${value}`,
    },
  },
  {
    key: 'name',
    title: 'Name',
    value: (row: Row) => row.name,
    type: {
      stringify: (value) => `Name: ${value}`,
      link: (value) => `/example/${value}`,
    },
  },
  {
    key: 'age',
    title: 'Age',
    value: (row: Row) => row.age,
    type: {
      stringify: (value) => `Age: ${value}`,
      link: (value) => `/example/${value}`,
    },
  },
];

describe('test download csv', () => {
  test('Simple case', () => {
    const data = transformCSVTableRows<Row>([{ age: 10, id: 1, name: 'John' }], COLUMNS_BASIC, {
      onPaginateData: async () => ({ items: [] }),
      columns: [],
      params: {},
    });

    expect(data).toEqual([
      [{ escaped: '"ID"' }, { escaped: '"Name"' }, { escaped: '"Age"' }],
      [{ escaped: '"1"' }, { escaped: '"John"' }, { escaped: '"10"' }],
    ]);
  });

  test('Advanced case', () => {
    const data = transformCSVTableRows<Row>([{ age: 10, id: 1, name: 'John' }], COLUMNS_ADVANCED, {
      onPaginateData: async () => ({ items: [] }),
      columns: [],
      params: {},
    });

    expect(data).toEqual([
      [
        { escaped: '"ID"' },
        { escaped: '"ID Link"' },
        { escaped: '"Name"' },
        { escaped: '"Name Link"' },
        { escaped: '"Age"' },
        { escaped: '"Age Link"' },
      ],
      [
        { escaped: '"#1"' },
        { escaped: '"http://localhost/example/1"' },
        { escaped: '"Name: John"' },
        { escaped: '"http://localhost/example/John"' },
        { escaped: '"Age: 10"' },
        { escaped: '"http://localhost/example/10"' },
      ],
    ]);
  });

  describe('test download xlsx', () => {
    test('Simple case', () => {
      const data = transformXLSXTableRows<Row>([{ age: 10, id: 1, name: 'John' }], COLUMNS_BASIC, {
        onPaginateData: async () => ({ items: [] }),
        columns: [],
        params: {},
      });

      expect(data).toEqual([
        [
          { t: 's', v: 'ID', s: { font: { bold: true } } },
          { t: 's', v: 'Name', s: { font: { bold: true } } },
          { t: 's', v: 'Age', s: { font: { bold: true } } },
        ],
        [
          { t: 's', v: '1' },
          { t: 's', v: 'John' },
          { t: 's', v: '10' },
        ],
      ]);
    });

    test('Advanced case', () => {
      const data = transformXLSXTableRows<Row>(
        [{ age: 10, id: 1, name: 'John' }],
        COLUMNS_ADVANCED,
        {
          onPaginateData: async () => ({ items: [] }),
          columns: [],
          params: {},
        },
      );

      expect(data).toEqual([
        [
          { t: 's', v: 'ID', s: { font: { bold: true } } },
          { t: 's', v: 'ID Link', s: { font: { bold: true } } },
          { t: 's', v: 'Name', s: { font: { bold: true } } },
          { t: 's', v: 'Name Link', s: { font: { bold: true } } },
          { t: 's', v: 'Age', s: { font: { bold: true } } },
          { t: 's', v: 'Age Link', s: { font: { bold: true } } },
        ],
        [
          { t: 's', v: '#1' },
          { t: 's', v: 'http://localhost/example/1' },
          { t: 's', v: 'Name: John' },
          { t: 's', v: 'http://localhost/example/John' },
          { t: 's', v: 'Age: 10' },
          { t: 's', v: 'http://localhost/example/10' },
        ],
      ]);
    });
  });
});
