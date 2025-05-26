import { UNKNOWN } from '../../../../standardDataTypes';
import {
  DerivedColumn,
  FieldAccessor,
  PaginatedParams,
  SimpleColumn,
  applyFieldAccessor,
  isSimpleColumn,
  TableColumn,
  getColumnId,
  isDerivedColumn,
  isGroupColumn,
  GroupColumn,
} from '../../../../types';

import { getColumnTitle } from '../../DownloadButton/helpers';
import {
  ExportDataStructure,
  ExportDataStructureFieldGroup,
  ExportKey,
  isEqual,
  isPrefix,
  removePrefix,
  ExportDataStructureField,
} from '../../../../export';
import { getCurrentDomain } from '@/utils/routing';
import { ExportData, ExportDataRow, exportValue } from '@/utils/data-export';

function traverseColumns<T extends object>(
  columns: TableColumn<T>[],
  keysToExport: ExportKey[],
  onLeafColumn: (
    column: SimpleColumn<T, FieldAccessor<T>> | DerivedColumn<T>,
    details: {
      fullKey: ExportKey;
      parentColumns: GroupColumn<T>[];
    },
  ) => void,
  parentKey: ExportKey = [],
  parentColumns: GroupColumn<T>[] = [],
) {
  for (const column of columns) {
    const keyOrId: string = getColumnId(column);
    const fullKey = [...parentKey, keyOrId];
    if (isGroupColumn(column)) {
      traverseColumns(column.children, keysToExport, onLeafColumn, fullKey, [
        ...parentColumns,
        column,
      ]);
    } else {
      const isColumnMarkedForExport = keysToExport.some((nextKey) => isPrefix(nextKey, fullKey));
      if ((isSimpleColumn(column) || isDerivedColumn(column)) && isColumnMarkedForExport) {
        onLeafColumn(column, {
          fullKey,
          parentColumns,
        });
      }
    }
  }
}

function traverseDataStructure(
  dataStructure: ExportDataStructure,
  keysToExport: ExportKey[],
  onField: (
    field: ExportDataStructureField,
    details: {
      fullKey: ExportKey;
      parentFields: ExportDataStructureFieldGroup[];
    },
  ) => void,
  parentKey: ExportKey = [],
  parentFields: ExportDataStructureFieldGroup[] = [],
) {
  if (dataStructure.fields) {
    for (const field of dataStructure.fields) {
      const fullKey = [...parentKey, field.id];
      if ('children' in field) {
        traverseDataStructure(field.children, keysToExport, onField, fullKey, [
          ...parentFields,
          field,
        ]);
      } else {
        const isFieldMarkedForExport = keysToExport.some((nextKey) => isPrefix(nextKey, fullKey));
        if (isFieldMarkedForExport) {
          onField(field, {
            fullKey: fullKey,
            parentFields: parentFields,
          });
        }
      }
    }
  }
}

export function buildDataStructure<T extends object>(
  columns: TableColumn<T>[],
): ExportDataStructure {
  const fields: ExportDataStructure['fields'] = [];
  for (const column of columns) {
    const keyOrId: string = getColumnId(column);
    if (isSimpleColumn(column) || isDerivedColumn(column)) {
      if (column.type?.export?.dataStructure) {
        fields.push({
          label: column.type?.export?.dataStructure.label ?? column.title,
          id: keyOrId,
          children: column.type.export.dataStructure,
        });
      } else if (!(column.exporting === false)) {
        fields.push({
          label: column.title,
          id: keyOrId,
          type: 'string',
        });
      }
    } else if (isGroupColumn(column)) {
      fields.push({
        label: column.title,
        id: keyOrId,
        children: buildDataStructure(column.children),
      });
    }
  }
  return {
    fields,
  };
}

export function generateTableExportData<T extends object>(
  items: T[],
  columns: TableColumn<T>[],
  keysToExport: ExportKey[],
  params: PaginatedParams<any>,
): ExportData {
  const result: ExportDataRow[] = [];
  const columnTitles: string[] = [];

  // Column titles export
  traverseColumns(columns, keysToExport, (column, { parentColumns }) => {
    const fullKey = [...parentColumns, column].map((column) => getColumnId(column));
    const fullTitle = [...parentColumns, column]
      .map((column) => getColumnTitle(column, params))
      .join(' / ');
    const dataStructure = column.type?.export?.dataStructure;
    if (dataStructure) {
      traverseDataStructure(
        dataStructure,
        keysToExport,
        (field, { parentFields }) => {
          const fullFieldTitle = [...parentFields, field].map((field) => field.label).join(' / ');
          columnTitles.push([fullTitle, fullFieldTitle].join(' / '));
        },
        fullKey,
      );
    } else {
      columnTitles.push(fullTitle);
      if (column.type?.link) {
        columnTitles.push(`${fullTitle} Link`);
      }
    }
  });

  // Data export
  for (const item of items) {
    const row: ExportDataRow = [];

    traverseColumns<T>(columns, keysToExport, (column, { parentColumns }) => {
      const fullKey: ExportKey = [...parentColumns, column].map((column) => getColumnId(column));
      const columnDataType = { ...UNKNOWN, ...column.type } as typeof column.type;
      if (columnDataType?.export?.dataStructure) {
        const allKeys: ExportKey[] = [];
        traverseDataStructure(
          columnDataType.export.dataStructure,
          keysToExport,
          (field, { parentFields }) => {
            allKeys.push([...parentFields, field].map((field) => field.id));
          },
          fullKey,
        );
        const relatedKeys = keysToExport
          .filter((key) => isPrefix(key, fullKey))
          .map((key) => removePrefix(key, fullKey));
        relatedKeys.sort((a, b) => {
          const aIndex = allKeys.findIndex((key) => isEqual(key, a));
          const bIndex = allKeys.findIndex((key) => isEqual(key, b));
          return aIndex - bIndex;
        });
        const value = isSimpleColumn(column)
          ? applyFieldAccessor(item, column.key)
          : column.value(item);
        const data = columnDataType.export.execute(relatedKeys, value as any, item);
        row.push(...data);
      } else {
        const value = isSimpleColumn(column)
          ? applyFieldAccessor(item, column.key)
          : column.value(item);
        if (columnDataType?.stringify) {
          row.push(exportValue(columnDataType?.stringify?.(value as any, item)));
        } else {
          row.push(exportValue(JSON.stringify(value)));
        }
        if (column.type?.link) {
          const link = column.type?.link?.(value as any, item);
          row.push(exportValue(link ? `${getCurrentDomain()}${link}` : ''));
        }
      }
    });

    result.push(row);
  }

  return {
    headers: columnTitles,
    rows: result,
  };
}
