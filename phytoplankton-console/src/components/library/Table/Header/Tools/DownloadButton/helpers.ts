import { get } from 'lodash';
import { DEFAULT_DOWNLOAD_VIEW, DEFAULT_EXPORT_PAGE_SIZE } from '../../../consts';
import { flatDataItems } from '../../../internal/helpers';
import { UNKNOWN } from '../../../standardDataTypes';
import {
  applyFieldAccessor,
  DerivedColumn,
  FieldAccessor,
  isDerivedColumn,
  isGroupColumn,
  isSimpleColumn,
  PaginatedParams,
  SimpleColumn,
  TableColumn,
  TableData,
} from '../../../types';
import { getCurrentDomain } from '@/utils/routing';
import { PaginationParams } from '@/utils/queries/hooks';
import { ExportData, ExportDataRow, exportValue } from '@/utils/data-export';

export function generateTableExportData<T extends object>(
  items: T[],
  columnsToExport: (SimpleColumn<T, FieldAccessor<T>> | DerivedColumn<T>)[],
  params: PaginatedParams<any>,
): ExportData {
  const result: ExportDataRow[] = [];
  const columnTitles: string[] = [];
  const columnsWithLinks: Set<number> = new Set();
  let index = 0;
  columnsToExport.map((column) => {
    columnTitles.push(getColumnTitle(column, params));
    if (column.type?.link) {
      columnsWithLinks.add(index);
      columnTitles.push(`${getColumnTitle(column, params)} Link`);
    }
    index++;
  });

  for (const row of items) {
    const exportRow: ExportDataRow = [];
    let index = 0;
    columnsToExport.map((column) => {
      const columnDataType = { ...UNKNOWN, ...column.type };
      const value = isSimpleColumn(column)
        ? applyFieldAccessor(row, column.key)
        : column.value(row);

      exportRow.push(exportValue(columnDataType.stringify?.(value as any, row)));

      if (columnsWithLinks.has(index)) {
        const link = columnDataType.link?.(value as any, row);
        exportRow.push(exportValue(link ? `${getCurrentDomain()}${link}` : ''));
      }
      index++;
    });
    result.push(exportRow);
  }

  return {
    headers: columnTitles,
    rows: result,
  };
}

export function getColumnTitle<T extends object>(
  column: TableColumn<T>,
  params: PaginatedParams<any>,
) {
  let title = column.headerTitle;

  if (!title) {
    title = typeof column.title === 'string' ? column.title : '-';
  }

  const key = isSimpleColumn(column) ? column.key : column.id;
  const filterValue = key ? get(params, key) : null;
  if (filterValue) {
    let filterValueOptions = '';

    if (typeof filterValue === 'object' && Array.isArray(filterValue)) {
      filterValueOptions = filterValue.join(', ');
    } else if (typeof filterValue === 'string') {
      filterValueOptions = filterValue;
    } else if (typeof filterValue === 'number') {
      filterValueOptions = filterValue.toString();
    }

    title += ` (Filter: ${filterValueOptions})`;
  }
  return title;
}

export async function* iterateItems<Item extends object, Params extends object>(props: {
  pagesMode: 'ALL' | 'CURRENT';
  onPaginateData: (params: PaginationParams) => Promise<TableData<Item>>;
  params: PaginatedParams<Params>;
  setProgress?: (progress: null | { page: number; totalPages?: number }) => void;
}): AsyncGenerator<Item> {
  const {
    pagesMode,
    onPaginateData,
    params: { page: currentPage = 1, pageSize, view = DEFAULT_DOWNLOAD_VIEW },
    setProgress,
  } = props;
  try {
    let totalPages = 1;
    let page = pagesMode === 'ALL' ? 1 : currentPage;

    // Params for cursor pagination.
    let from = '';
    let next = '';
    let cursorPaginated = false;
    do {
      setProgress?.({
        page: page,
        totalPages: from ? undefined : totalPages,
      });
      const {
        total,
        items,
        next: nextCursor,
      } = await onPaginateData({
        from,
        page,
        pageSize: pagesMode === 'CURRENT' ? pageSize : DEFAULT_EXPORT_PAGE_SIZE,
        view,
      });
      // If a cursor is returned, this is cursor paginated.
      cursorPaginated = nextCursor !== undefined;

      if (cursorPaginated && nextCursor) {
        next = nextCursor;
      }
      const totalItemsCount = total ?? items.length;

      const flatData = flatDataItems<Item>(items);
      for (const item of flatData) {
        yield item;
      }
      if (pagesMode === 'CURRENT') {
        break;
      }
      totalPages = Math.ceil(totalItemsCount / DEFAULT_EXPORT_PAGE_SIZE);
      page++;

      if (cursorPaginated) {
        if (!next || next == '') {
          break;
        }
        if (from == next) {
          break;
        }
        from = next;
      }
    } while ((totalPages && page <= totalPages) || cursorPaginated);
  } finally {
    setProgress?.(null);
  }
}

export function prepareColumns<T extends object>(
  columns: TableColumn<T>[],
  prefix = '',
): (SimpleColumn<T, FieldAccessor<T>> | DerivedColumn<T>)[] {
  const result: any[] = [];
  for (const column of columns) {
    const title = typeof column.title === 'string' ? column.title : '-';
    if (isGroupColumn(column)) {
      result.push(...prepareColumns(column.children, `${title} / `));
    } else if (
      (isSimpleColumn(column) || isDerivedColumn(column)) &&
      (column.exporting ?? column.hideInTable !== true)
    ) {
      result.push({
        ...column,
        title: prefix + title,
      });
    }
  }
  return result;
}
