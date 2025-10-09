import React from 'react';
import { setUserAlias } from '@flagright/lib/utils/userAlias';
import s from './index.module.less';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { QuestionResponseTable } from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/types';

interface Props {
  item: QuestionResponseTable;
}

const PdfTable: React.FC<Props> = ({ item }) => {
  const { userAlias } = useSettings();
  if (!item.headers?.length || !item.rows?.length) {
    return <div className={s.noData}>No table data available</div>;
  }

  const tableData = {
    headers: item.headers.map((header) => setUserAlias(header.name, userAlias)),
    rows: item.rows.slice(0, 20),
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
                {setUserAlias(header.name, userAlias)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {item.rows.slice(0, 20).map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className={s.tableCell}>
                  {typeof cell === 'string' ? setUserAlias(cell, userAlias) : cell || '-'}
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
