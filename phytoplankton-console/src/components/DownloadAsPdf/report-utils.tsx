import type { RowInput, Styles } from 'jspdf-autotable';
import { FONT_FAMILY_REGULAR, FONT_FAMILY_SEMIBOLD, TableOptions } from './DownloadAsPDF';

export type ReportTableId = 'link' | 'bold' | 'header' | 'item';

export interface ReportItem {
  title: string;
  value: string;
  id?: {
    rowId?: ReportTableId;
    cellId?: ReportTableId;
  };
}

const COLORS: {
  [key: string]: {
    [key: string]: [number, number, number];
  };
} = {
  TABLE: {
    HEAD: [245, 245, 245],
    BODY: [250, 250, 250],
    ALTERNATE: [255, 255, 255],
  },
  TEXT: {
    LINK: [17, 105, 249],
    HEADER: [38, 38, 38],
  },
  WIDGET: {
    LABEL: [141, 141, 141],
    BODY: [240, 244, 251],
  },
};

export const getWidgetTable = (props: ReportItem[]): TableOptions => {
  const table: HTMLTableElement = document.createElement('table');
  const tbody = document.createElement('tbody');
  props.map((item) => {
    const row = getRow(item);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  return {
    tableOptions: {
      html: table,
      bodyStyles: {
        fillColor: COLORS.WIDGET.BODY,
        cellPadding: {
          horizontal: 5,
          vertical: 2,
        },
      },
      theme: 'plain',
      didParseCell: (data) => {
        const totalRows = data.table.body.length;

        if (data.row.index == 0 || data.row.index == totalRows - 1) {
          data.cell.styles.cellPadding = {
            horizontal: 5,
            bottom: data.row.index === 0 ? 2 : 5,
            top: data.row.index === 0 ? 5 : 2,
          };
        }
        if (data.column.index === 0) {
          data.cell.styles.textColor = COLORS.WIDGET.LABEL;
          data.cell.styles.font = FONT_FAMILY_REGULAR;
        }
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const rowId = data.row?.raw._element.id;
        if (rowId) {
          if (rowId === 'header' || rowId === 'item') {
            data.cell.styles.font = FONT_FAMILY_SEMIBOLD;
            data.cell.styles.textColor = COLORS.TEXT.HEADER;
            if (rowId === 'header') {
              data.cell.styles.fontSize = 12;
              data.cell.styles.cellPadding = {
                horizontal: 5,
                bottom: 3,
                top: 5,
              };
            }
          }
        }

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const cellId = data.cell.raw.id;
        if (cellId) {
          if (cellId === 'link' || cellId === 'bold') {
            data.cell.styles.font = FONT_FAMILY_SEMIBOLD;
            if (cellId === 'link') {
              data.cell.styles.textColor = COLORS.TEXT.LINK;
            }
          }
        }
      },
    },
  };
};

const getRow = (item: ReportItem) => {
  const row = document.createElement('tr');
  const rowId = item.id?.rowId ?? '';
  row.id = rowId;
  const cellId = item.id?.cellId ?? '';
  const titleCell = getCell(item.title);
  const valueCell = getCell(item.value);
  valueCell.id = cellId;
  row.appendChild(titleCell);
  row.appendChild(valueCell);
  return row;
};

const getCell = (value: string) => {
  const cell = document.createElement('td');
  cell.innerHTML = value;
  return cell;
};

export const getTable = (
  head,
  rows: RowInput[],
  title?: string,
  columnStyles?: { [key: string]: Partial<Styles> },
): TableOptions => {
  const idFields = head
    .map((h, i) => {
      if (h.endsWith('ID')) {
        return i;
      }
    })
    .filter((x) => x !== undefined);
  return {
    tableTitle: title,
    tableOptions: {
      head: [head],
      body: rows,
      headStyles: {
        fillColor: COLORS.TABLE.HEAD,
        textColor: [0, 0, 0],
        valign: 'middle',
        font: FONT_FAMILY_SEMIBOLD,
      },
      alternateRowStyles: { fillColor: COLORS.TABLE.ALTERNATE },
      bodyStyles: { fillColor: COLORS.TABLE.BODY, textColor: COLORS.TEXT.HEADER },
      columnStyles: columnStyles,
      didParseCell: (data) => {
        if (
          idFields.includes(data.column.index) &&
          data.row.section !== 'head' &&
          data.cell.text[0] !== '-'
        ) {
          data.cell.styles.textColor = COLORS.TEXT.LINK;
          data.cell.styles.font = FONT_FAMILY_SEMIBOLD;
        }
        data.cell.styles.cellPadding = {
          horizontal: 2,
          vertical: 2.5,
        };
      },
    },
  };
};
