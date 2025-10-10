import { expect } from '@jest/globals';
import { formatData } from '../HistoryItemBase/exportUtil';
import { QuestionResponse } from '../../../types';
import { CsvRow, csvValue, serialize } from '@/utils/csv';

describe('formatData function', () => {
  test('should format TABLE data correctly', () => {
    const questionData: Partial<QuestionResponse> = {
      questionType: 'TABLE',
      headers: [
        { name: 'Header1', columnType: 'STRING' },
        { name: 'Header2', columnType: 'NUMBER' },
      ],
      rows: [
        ['Row1Value1', 123],
        ['Row2Value1', 456],
        ['Row3Value1', 789],
      ],
    };
    const result = formatData(questionData);
    const expected: CsvRow[] = [
      [csvValue('Header1'), csvValue('Header2')],
      [csvValue('Row1Value1'), csvValue('123')],
      [csvValue('Row2Value1'), csvValue('456')],
      [csvValue('Row3Value1'), csvValue('789')],
    ];
    expect(result).toBe(serialize(expected));
  });

  test('should format BARCHART data correctly', () => {
    const questionData: Partial<QuestionResponse> = {
      questionType: 'BARCHART',
      values: [
        { x: 'Category1', y: 10 },
        { x: 'Category2', y: 20 },
        { x: 'Category3', y: 30 },
      ],
    };
    const result = formatData(questionData);
    const expected: CsvRow[] = [
      [csvValue('Category1'), csvValue('10')],
      [csvValue('Category2'), csvValue('20')],
      [csvValue('Category3'), csvValue('30')],
    ];
    expect(result).toBe(serialize(expected));
  });

  test('should format TIME_SERIES data correctly', () => {
    const questionData: Partial<QuestionResponse> = {
      questionType: 'TIME_SERIES',
      timeseries: [
        {
          values: [
            { time: 1698710400000, value: 10 },
            { time: 1698710400000, value: 20 },
            { time: 1698710400000, value: 30 },
          ],
        },
        {
          values: [
            { time: 1698710400000, value: 40 },
            { time: 1698710400000, value: 50 },
          ],
        },
      ],
    };
    const result = formatData(questionData);
    const expected: CsvRow[] = [
      [csvValue('Oct 31, 2023'), csvValue('10')],
      [csvValue('Oct 31, 2023'), csvValue('20')],
      [csvValue('Oct 31, 2023'), csvValue('30')],
      [csvValue('Oct 31, 2023'), csvValue('40')],
      [csvValue('Oct 31, 2023'), csvValue('50')],
    ];
    expect(result).toBe(serialize(expected));
  });

  test('should format PROPERTIES data correctly', () => {
    const questionData: Partial<QuestionResponse> = {
      questionType: 'PROPERTIES',
      properties: [
        { key: 'Key1', value: 'Value1' },
        { key: 'Key2', value: 'Value2' },
        { key: 'Key3', value: 'Value3' },
      ],
    };
    const result = formatData(questionData);
    const expected: CsvRow[] = [
      [csvValue('Key1'), csvValue('Value1')],
      [csvValue('Key2'), csvValue('Value2')],
      [csvValue('Key3'), csvValue('Value3')],
    ];
    expect(result).toBe(serialize(expected));
  });

  test('should format STACKED_BARCHART data correctly', () => {
    const questionData: Partial<QuestionResponse> = {
      questionType: 'STACKED_BARCHART',
      series: [
        {
          label: 'Series1',
          values: [
            { x: 'Category1', y: 10 },
            { x: 'Category2', y: 20 },
            { x: 'Category3', y: 30 },
          ],
        },
        {
          label: 'Series2',
          values: [
            { x: 'Category1', y: 40 },
            { x: 'Category2', y: 50 },
            { x: 'Category3', y: 10 },
          ],
        },
      ],
    };
    const result = formatData(questionData);
    const expected: CsvRow[] = [
      [csvValue(''), csvValue('Series1'), csvValue('Series2')],
      [csvValue('Category1'), csvValue('10'), csvValue('40')],
      [csvValue('Category2'), csvValue('20'), csvValue('50')],
      [csvValue('Category3'), csvValue('30'), csvValue('10')],
    ];
    expect(result).toBe(serialize(expected));
  });
});
