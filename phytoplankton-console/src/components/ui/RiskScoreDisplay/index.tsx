import React, { useMemo, useState } from 'react';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import DetailsModal from './DetailsModal';
import MainPanel, { MainPanelCustomStyles } from './MainPanel';
import { ValueItem } from './types';

interface Props {
  icon: React.ReactNode;
  title: string;
  values: ValueItem[];
  riskScoreName: string;
  mainPanelCustomStyling?: MainPanelCustomStyles;
  showFormulaBackLink?: boolean;
  riskScoreAlgo: (value: ValueItem) => number;
  hideInfo?: boolean;
}

export function sortByDate<T extends { createdAt: number }>(items: T[]): T[] {
  const result = [...items];
  result.sort((x, y) => x.createdAt - y.createdAt);
  return result;
}

export default function RiskScoreDisplay(props: Props) {
  const {
    icon,
    title,
    values,
    riskScoreName,
    mainPanelCustomStyling,
    showFormulaBackLink,
    riskScoreAlgo,
    hideInfo,
  } = props;

  const [isModalOpen, setModalOpen] = useState(false);
  const sortedItems = useMemo(() => sortByDate(values), [values]);
  const lastItem = sortedItems[values.length - 1];
  const components = lastItem?.components;
  const factorScoreDetails = lastItem?.factorScoreDetails;
  const isManualUpdate = lastItem?.transactionId === 'MANUAL_UPDATE' && lastItem?.manualRiskLevel;

  return (
    <>
      <MainPanel
        icon={icon}
        title={title}
        onClickInfo={
          (components && components.length > 0) ||
          (factorScoreDetails && factorScoreDetails.length > 0)
            ? () => setModalOpen(true)
            : undefined
        }
        customStyling={mainPanelCustomStyling}
        sortedItems={sortedItems}
        lastItem={lastItem}
        riskScoreAlgo={riskScoreAlgo}
        defaultText={
          hideInfo
            ? undefined
            : !isManualUpdate
            ? `This is default risk score value when all the risk factors are disabled.`
            : `The CRA of this user has been manually set to ${humanizeConstant(
                lastItem?.manualRiskLevel ?? '',
              )}.`
        }
      />
      <DetailsModal
        icon={icon}
        title={title}
        isOpen={isModalOpen}
        components={components}
        factorScoreDetails={factorScoreDetails}
        riskScoreName={riskScoreName}
        onCancel={() => {
          setModalOpen(false);
        }}
        showFormulaBackLink={showFormulaBackLink}
        riskScoreAlgo={riskScoreAlgo}
        lastItem={lastItem}
        sortedItems={sortedItems}
      />
    </>
  );
}
