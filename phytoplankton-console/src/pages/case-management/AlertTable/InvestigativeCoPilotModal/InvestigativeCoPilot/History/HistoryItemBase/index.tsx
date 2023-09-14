import React, { useState } from 'react';
import { QuestionResponseBase } from '../../types';
import s from './index.module.less';
import AISummary from './AISummary';
import BrainIcon from '@/components/ui/icons/brain-icon-colored.react.svg';

interface Props {
  item: QuestionResponseBase;
  children: React.ReactNode;
}

export default function HistoryItemBase(props: Props) {
  const { item, children } = props;
  const [showAiSummary, setShowAiSummary] = useState(false);
  const [addToNarrative, setAddToNarrative] = useState<boolean | undefined>(true);
  return (
    <div className={s.root}>
      <div className={s.header}>
        <div className={s.title}>{item.questionId}</div>
        <BrainIcon
          className={s.brainIcon}
          onClick={() => {
            setShowAiSummary((prevState) => !prevState);
          }}
        />
      </div>
      <div>{children}</div>
      {showAiSummary && (
        <AISummary
          addToNarrative={addToNarrative}
          onChangeAddToNarrative={setAddToNarrative}
          text={
            'Rerum Finance s.r.o operates as a payday lender, providing high-interest loans to individuals with low credit scores. Their website facilitates loan applications and disbursement through manual bank transfers. Client repayments are processed via kevin. services using payment links or self-service options.'
          }
        />
      )}
    </div>
  );
}
