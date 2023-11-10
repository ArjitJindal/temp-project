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
export const typeAssigner = (columnType: string | undefined) => {
  let type: ColumnDataType<any> = UNKNOWN;
  switch (columnType) {
    case 'STRING': {
      type = STRING;
      break;
    }
    case 'NUMBER': {
      type = NUMBER;
      break;
    }
    case 'FLOAT': {
      type = FLOAT;
      break;
    }
    case 'LONG_TEXT': {
      type = LONG_TEXT;
      break;
    }
    case 'BOOLEAN': {
      type = BOOLEAN;
      break;
    }
    case 'ID': {
      type = ID;
      break;
    }
    case 'TRANSACTION_TYPE': {
      type = TRANSACTION_TYPE;
      break;
    }
    case 'DATE_TIME': {
      type = DATE_TIME;
      break;
    }
    case 'PAYMENT_METHOD': {
      type = PAYMENT_METHOD;
      break;
    }
    case 'TAG': {
      type = TAG;
      break;
    }
    case 'MONEY_AMOUNT': {
      type = MONEY_AMOUNT;
      break;
    }
    case 'MONEY_CURRENCY': {
      type = MONEY_CURRENCY;
      break;
    }
    case 'COUNTRY': {
      type = COUNTRY;
      break;
    }
  }
  return type;
};
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
        return columnHelper.simple({
          title: header.name as string,
          key: header.name as string,
          type: typeAssigner(header.columnType),
        });
      })}
      data={tableData}
      pagination={'HIDE_FOR_ONE_PAGE'}
    />
  );
}
