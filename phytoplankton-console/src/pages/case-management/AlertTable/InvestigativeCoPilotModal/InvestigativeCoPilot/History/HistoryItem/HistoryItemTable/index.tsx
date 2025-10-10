import { useMemo } from 'react';
import { setUserAlias } from '@flagright/lib/utils/userAlias';
import { QuestionResponseTable } from '../../../types';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import {
  NUMBER,
  FLOAT,
  LONG_TEXT,
  BOOLEAN,
  TRANSACTION_TYPE,
  DATE_TIME,
  PAYMENT_METHOD,
  UNKNOWN,
  TAG_LIST,
  MONEY_AMOUNT,
  MONEY_CURRENCY,
  COUNTRIES_MULTIPLE,
  STRING_MULTIPLE,
  getForneticsEntityId,
} from '@/components/library/Table/standardDataTypes';
import { ColumnDataType, CommonParams } from '@/components/library/Table/types';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { TenantSettings } from '@/apis';
interface Props {
  item: QuestionResponseTable;
  pageParams: CommonParams;
  onPageParams: (params: CommonParams) => void;
}

export const typeAssigner = (
  columnType: string | undefined,
  tenantSettings?: TenantSettings,
  currency?: string,
) => {
  let type: ColumnDataType<any> = UNKNOWN;
  if (!columnType) {
    return type;
  }

  switch (columnType) {
    case 'STRING': {
      type = STRING_MULTIPLE;
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
      type = getForneticsEntityId(tenantSettings);
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
      type = TAG_LIST;
      break;
    }
    case 'MONEY_AMOUNT': {
      type = MONEY_AMOUNT(currency);
      break;
    }
    case 'MONEY_CURRENCY': {
      type = MONEY_CURRENCY;
      break;
    }
    case 'COUNTRY': {
      type = COUNTRIES_MULTIPLE;
      break;
    }
  }
  return type;
};

export default function HistoryItemTable(props: Props) {
  const { item, pageParams, onPageParams } = props;
  const settings = useSettings();
  const columnHelper = new ColumnHelper();

  // Extract currency from item variables
  const currency = item.variables?.find((variable) => variable.name === 'currency')?.value;

  const paginate = item.rows?.length != item.total;
  const tableData = useMemo(() => {
    const items = (item.rows ?? []).map((row, i) => {
      return (item.headers ?? []).reduce(
        (acc, header, i) => {
          return {
            ...acc,
            [header.columnId ?? header.name]: row[i] ?? '-',
          };
        },
        { index: i },
      );
    });
    if (paginate) {
      return {
        success: true,
        items: items,
        total: item.total,
      };
    }
    const page = pageParams?.page || 1;
    return {
      success: true,
      items: items?.slice((page - 1) * pageParams.pageSize, page * pageParams.pageSize),
      total: items?.length,
    };
  }, [item.rows, item.headers, item.total, paginate, pageParams?.page, pageParams.pageSize]);

  return (
    <Table<any>
      params={pageParams}
      onChangeParams={onPageParams}
      rowHeightMode={'AUTO'}
      toolsOptions={false}
      rowKey="index"
      columns={(item.headers ?? []).map((header) => {
        const columnType = typeAssigner(header.columnType, settings, currency);

        return columnHelper.simple({
          title: setUserAlias(header.name, settings.userAlias),
          key: header.columnId ?? header.name,
          sorting: header.sortable,
          type: columnType,
          ...(header.columnWidth ? { defaultWidth: header.columnWidth } : {}),
        });
      })}
      data={tableData}
      pagination={paginate || 'HIDE_FOR_ONE_PAGE'}
      sizingMode="FULL_WIDTH"
    />
  );
}
