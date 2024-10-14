import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import V8ModalDetails from './components/V8ModalDetails';
import V2ModalDetails from './components/V2ModalDetails';
import Modal from '@/components/library/Modal';
import { ValueItem } from '@/components/ui/RiskScoreDisplay/types';
import { RiskFactorScoreDetails, RiskScoreComponent } from '@/apis';

interface Props {
  icon: React.ReactNode;
  isOpen: boolean;
  onCancel: () => void;
  title: string;
  components?: Array<RiskScoreComponent>;
  factorScoreDetails?: Array<RiskFactorScoreDetails>;
  riskScoreName: string;
  showFormulaBackLink?: boolean;
  riskScoreAlgo: (value: ValueItem) => number;
  lastItem: ValueItem;
  sortedItems: ValueItem[];
}

export default function DetailsModal(props: Props) {
  const { title, isOpen, onCancel, components, factorScoreDetails } = props;

  return (
    <Modal title={title} hideFooter={true} isOpen={isOpen} onCancel={onCancel} width="M">
      <div className={cn(s.root)}>
        {factorScoreDetails && factorScoreDetails.length > 0 && (
          <V8ModalDetails {...props} factorScoreDetails={factorScoreDetails} />
        )}
        {components && components.length > 0 && (
          <V2ModalDetails {...props} components={components} />
        )}
      </div>
    </Modal>
  );
}
