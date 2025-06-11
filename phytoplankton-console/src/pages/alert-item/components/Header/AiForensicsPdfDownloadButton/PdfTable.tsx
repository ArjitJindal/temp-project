import React from 'react';
import s from './index.module.less';
import { QuestionResponseTable } from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/types';

interface Props {
  item: QuestionResponseTable;
}

const PdfTable: React.FC<Props> = ({ item }) => {
  if (!item.headers?.length || !item.rows?.length) {
    return <div className={s.noData}>No table data available</div>;
  }

  const tableData = {
    headers: item.headers.map((header) => header.name),
    rows: item.rows.slice(0, 20),
    title: item.title || '',
  };

  return (
    <div
      className={s.tableContainer}
      data-native-table="true"
      data-table-data={JSON.stringify(tableData)}
    >
      <table className={s.table}>
        <thead>
          <tr>
            {item.headers.map((header, index) => (
              <th key={index} className={s.tableHeader}>
                {header.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {item.rows.slice(0, 20).map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className={s.tableCell}>
                  {cell || '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PdfTable;
