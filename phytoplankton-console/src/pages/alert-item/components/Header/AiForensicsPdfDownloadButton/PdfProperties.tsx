import React from 'react';
import { setUserAlias } from '@flagright/lib/utils/userAlias';
import s from './index.module.less';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import {
  QuestionResponseProperties,
  QuestionResponseRuleLogic,
} from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/types';

interface Props {
  item: QuestionResponseProperties | QuestionResponseRuleLogic;
}

const PdfProperties: React.FC<Props> = ({ item }) => {
  const { userAlias } = useSettings();
  if (!item.properties?.length) {
    return <div className={s.noData}>No data available</div>;
  }

  const totalProperties = item.properties.length;
  let numColumns = 1;

  if (totalProperties > 12) {
    numColumns = 3;
  } else if (totalProperties > 6) {
    numColumns = 2;
  }

  const propertiesPerColumn = Math.ceil(totalProperties / numColumns);
  const columns: typeof item.properties[] = [];

  for (let i = 0; i < numColumns; i++) {
    const startIndex = i * propertiesPerColumn;
    const endIndex = Math.min(startIndex + propertiesPerColumn, totalProperties);
    columns.push(item.properties.slice(startIndex, endIndex));
  }

  const layoutClass =
    numColumns === 1
      ? s.singleColumnLayout
      : numColumns === 2
      ? s.twoColumnLayout
      : s.threeColumnLayout;

  return (
    <div className={s.propertiesContainer}>
      <div className={layoutClass}>
        {columns.map((columnProperties, columnIndex) => (
          <div key={columnIndex} className={s.column}>
            <table className={s.propertiesTable}>
              <tbody>
                {columnProperties.map((property, idx) => (
                  <tr key={`col${columnIndex}-${idx}`}>
                    <td className={s.propertyKey}>{setUserAlias(property.key, userAlias)}:</td>
                    <td className={s.propertyValue}>
                      {typeof property.value === 'string'
                        ? setUserAlias(property.value, userAlias)
                        : property.value || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PdfProperties;
