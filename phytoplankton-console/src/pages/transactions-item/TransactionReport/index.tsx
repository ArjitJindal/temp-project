import { InternalTransaction } from '@/apis';
import {
  FONT_FAMILY_REGULAR,
  FONT_FAMILY_SEMIBOLD,
  TableOptions,
} from '@/components/DownloadAsPdf/DownloadAsPDF';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';
import { humanizeAuto } from '@/utils/humanize';

interface Item {
  title: string;
  value: string;
}

export const getWidgetsProps = (transaction: InternalTransaction): Item[] => {
  const riskScore = transaction.riskScoreDetails?.trsScore ?? transaction.arsScore?.arsScore ?? 0;
  const riskLevel =
    transaction.riskScoreDetails?.trsRiskLevel ?? transaction.arsScore?.riskLevel ?? 'LOW';
  const hitDirections =
    transaction.hitRules.flatMap((rule) => rule.ruleHitMeta?.hitDirections ?? []) ?? [];
  const alertCreatedForUserIds = hitDirections.map((hitDirection) => {
    if (hitDirection == 'ORIGIN') return transaction.originUserId;
    return transaction.destinationUserId;
  });

  return [
    {
      title: 'Transaction ID',
      value: transaction.transactionId,
    },
    {
      title: 'Transaction risk score (TRS)',
      value: `${humanizeAuto(riskLevel)} (${riskScore})`,
    },
    {
      title: 'Created on',
      value: dayjs(transaction.timestamp).format(DATE_TIME_FORMAT_WITHOUT_SECONDS),
    },
    {
      title: 'Last state',
      value: humanizeAuto(transaction.transactionState ?? '-'),
    },
    {
      title: 'Rule action',
      value: humanizeAuto(transaction.status),
    },
    {
      title: 'Type',
      value: humanizeAuto(transaction.type),
    },
    {
      title: 'Product type',
      value: `${transaction.productType ?? '-'}`,
    },
    {
      title: 'Reference',
      value: `${transaction.reference ?? '-'}`,
    },
    {
      title: 'Alert created for User ID',
      value: `${alertCreatedForUserIds.join(', ')}`,
    },
  ];
};

const getTransactionWidgetTable = (data: InternalTransaction): TableOptions => {
  const props = getWidgetsProps(data);
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
        fillColor: [240, 244, 251],
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
          data.cell.styles.textColor = [17, 105, 249];
          data.cell.styles.font = FONT_FAMILY_SEMIBOLD;
        }

        if (data.column.index === 0) {
          data.cell.styles.textColor = [141, 141, 141];
          data.cell.styles.font = FONT_FAMILY_REGULAR;
        }
      },
    },
  };
};

const getRow = (item: Item) => {
  const row = document.createElement('tr');
  const titleCell = getCell(item.title);
  const valueCell = getCell(item.value);
  row.appendChild(titleCell);
  row.appendChild(valueCell);
  return row;
};

const getCell = (value: string) => {
  const cell = document.createElement('td');
  cell.innerHTML = value;
  return cell;
};

const getTransactionSupportTables = (
  transaction: InternalTransaction,
  ruleAlertMap,
): TableOptions => {
  const head = ['Rule ID', 'Rule name', 'Is rule hit?', 'Alert ID', 'Case ID'];
  const rows = transaction.executedRules.map((rule) => {
    const ruleAlert = ruleAlertMap.get(rule.ruleInstanceId);
    return [
      `${rule.ruleId ?? ''} (${rule.ruleInstanceId})`,
      rule.ruleName,
      rule.ruleHit ? 'Yes' : 'No',
      ruleAlert?.alertId ?? '-',
      ruleAlert?.caseId ?? '-',
    ];
  });
  return {
    tableTitle: 'Transaction checks',
    tableOptions: {
      head: [head],
      body: rows,
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [0, 0, 0],
        valign: 'middle',
        font: FONT_FAMILY_SEMIBOLD,
      },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      bodyStyles: { fillColor: [250, 250, 250], textColor: [38, 38, 38] },
      didParseCell: (data) => {
        if (data.column.index > 2 && data.row.section !== 'head' && data.cell.text[0] !== '-') {
          data.cell.styles.textColor = [17, 105, 249];
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

export const getTransactionReportTables = (
  transaction: InternalTransaction,
  ruleAlertMap,
): TableOptions[] => {
  return [
    getTransactionWidgetTable(transaction),
    getTransactionSupportTables(transaction, ruleAlertMap),
  ];
};
