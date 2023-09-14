import React, { useMemo, useState } from 'react';
import { QuestionResponseTable } from '../../types';
import HistoryItemBase from '../HistoryItemBase';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE_TIME, STRING, UNKNOWN } from '@/components/library/Table/standardDataTypes';
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
            [header.name ?? `header#${i}`]: row[i] ?? null,
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
    <HistoryItemBase item={item}>
      <Table<any>
        params={params}
        onChangeParams={setParams}
        rowHeightMode={'AUTO'}
        toolsOptions={false}
        rowKey="index"
        columns={(item.headers ?? []).map((header) => {
          let type: ColumnDataType<any> = UNKNOWN;
          if (header.columnType === 'DATETIME') {
            type = DATE_TIME;
          } else if (header.columnType === 'STRING') {
            type = STRING;
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
    </HistoryItemBase>
  );
}
