import React, { useState } from 'react';
import MainPanel, { MainPanelCustomStyles } from '../RiskScoreDisplay/MainPanel';
import { ValueItem } from '../RiskScoreDisplay/types';
import DynamicRiskHistoryModal from './DynamicRiskHistoryModal';

interface Props {
  icon: React.ReactNode;
  title: string;
  value: ValueItem;
  mainPanelCustomStyling?: MainPanelCustomStyles;
  showFormulaBackLink?: boolean;
  riskScoreAlgo: (value: ValueItem) => number;
  hideInfo?: boolean;
  isExternalSource?: boolean;
  isLocked?: boolean;
  userId: string;
}

function DynamicRiskHistoryDisplay(props: Props) {
  const {
    icon,
    title,
    value,
    mainPanelCustomStyling,
    riskScoreAlgo,
    isExternalSource,
    isLocked,
    userId,
  } = props;
  const [isModalOpen, setModalOpen] = useState(false);
  return (
    <>
      <MainPanel
        icon={icon}
        title={title}
        onClickInfo={() => setModalOpen(true)}
        customStyling={mainPanelCustomStyling}
        sortedItems={[value]}
        lastItem={value}
        riskScoreAlgo={riskScoreAlgo}
        defaultText={undefined}
        isLocked={isLocked}
        {...(isExternalSource && { isExternalSource: true })}
      />
      <DynamicRiskHistoryModal
        isOpen={isModalOpen}
        onCancel={() => {
          setModalOpen(false);
        }}
        value={value}
        riskScoreAlgo={riskScoreAlgo}
        isExternalSource={isExternalSource}
        userId={userId}
        icon={icon}
        title={title}
      />
    </>
  );
}

export default DynamicRiskHistoryDisplay;
