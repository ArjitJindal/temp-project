import React, { useMemo, useState } from 'react';
import { QuestionResponseTable } from '../../../types';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import {
  STRING,
  NUMBER,
  FLOAT,
  LONG_TEXT,
  BOOLEAN,
  ID,
  TRANSACTION_TYPE,
  DATE_TIME,
  PAYMENT_METHOD,
  UNKNOWN,
  TAG,
  MONEY_AMOUNT,
  MONEY_CURRENCY,
  COUNTRY,
} from '@/components/library/Table/standardDataTypes';
import { PaginatedData } from '@/utils/queries/hooks';
import { ColumnDataType } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';

const PAGE_SIZE = 5;

interface Props {
  item: QuestionResponseTable;
}

export default function HistoryItemTable(props: Props) {
  const { item } = props;

  const columnHelper = new ColumnHelper();
  const [params, setParams] = useState({
    ...DEFAULT_PARAMS_STATE,
    pageSize: PAGE_SIZE,
  });

  const page = params.page ?? 1;

  const tableData: PaginatedData<unknown> = useMemo(() => {
    const dataItems = (item.rows ?? []).map((row, i) => {
      return (item.headers ?? []).reduce(
        (acc, header, i) => {
          return {
            ...acc,
            [header.name ?? `header#${i}`]: row[i] ?? '-',
          };
        },
        { index: i },
      );
    });

    return {
      success: true,
      items: dataItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      total: dataItems.length,
    };
  }, [page, item]);

  return (
    <Table<any>
      params={params}
      onChangeParams={setParams}
      rowHeightMode={'AUTO'}
      toolsOptions={false}
      rowKey="index"
      columns={(item.headers ?? []).map((header) => {
        let type: ColumnDataType<any> = UNKNOWN;
        if (header.columnType === 'STRING') {
          type = STRING;
        } else if (header.columnType === 'NUMBER') {
          type = NUMBER;
        } else if (header.columnType === 'FLOAT') {
          type = FLOAT;
        } else if (header.columnType === 'LONG_TEXT') {
          type = LONG_TEXT;
        } else if (header.columnType === 'BOOLEAN') {
          type = BOOLEAN;
        } else if (header.columnType === 'ID') {
          type = ID;
        } else if (header.columnType === 'TRANSACTION_TYPE') {
          type = TRANSACTION_TYPE;
        } else if (header.columnType === 'DATE_TIME') {
          type = DATE_TIME;
        } else if (header.columnType === 'PAYMENT_METHOD') {
          type = PAYMENT_METHOD;
        } else if (header.columnType === 'TAG') {
          type = TAG;
        } else if (header.columnType === 'MONEY_AMOUNT') {
          type = MONEY_AMOUNT;
        } else if (header.columnType === 'MONEY_CURRENCY') {
          type = MONEY_CURRENCY;
        } else if (header.columnType === 'COUNTRY') {
          type = COUNTRY;
        }
        return columnHelper.simple({
          title: header.name as string,
          key: header.name as string,
          type: type,
        });
      })}
      data={tableData}
      pagination={'HIDE_FOR_ONE_PAGE'}
    />
  );
}
