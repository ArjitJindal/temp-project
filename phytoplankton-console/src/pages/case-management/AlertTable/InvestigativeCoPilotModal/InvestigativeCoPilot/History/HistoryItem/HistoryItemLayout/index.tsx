import React, { useState } from 'react';
import cn from 'clsx';
import { QuestionResponseBase } from '../../../types';
import { variablesFromApi } from '../../../api';
import s from './index.module.less';
import AISummary from './AISummary';
import BrainIcon from '@/components/ui/icons/brain-icon-colored.react.svg';
import Button from '@/components/library/Button';
import VariablesPopover, {
  VariablesValues,
} from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/History/HistoryItem/HistoryItemLayout/VariablesPopover';
import MetaInfo from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/History/HistoryItem/HistoryItemLayout/MetaInfo';

interface Props {
  item: QuestionResponseBase;
  children: React.ReactNode;
  isLoading: boolean;
  onRefresh: (vars: VariablesValues) => void;
}

export default function HistoryItemBase(props: Props) {
  const { item, children, isLoading, onRefresh } = props;
  const [initialVariablesState, setInitialVarsValues] = useState(
    variablesFromApi(item.variables, item.variableOptions),
  );
  const [showAiSummary, setShowAiSummary] = useState(false);
  const [addToNarrative, setAddToNarrative] = useState<boolean | undefined>(true);

  const { variableOptions, title } = item;

  return (
    <div className={cn(s.root, isLoading && s.isLoading)}>
      <div className={s.header}>
        <div className={s.title}>{title}</div>
        <div className={s.tools}>
          {variableOptions && variableOptions.length > 0 && (
            <VariablesPopover
              initialValues={initialVariablesState}
              variables={variableOptions}
              onConfirm={(variablesValues) => {
                setInitialVarsValues(variablesValues);
                onRefresh(variablesValues);
              }}
            >
              <Button size="SMALL" type="TETRIARY">
                Parameters
              </Button>
            </VariablesPopover>
          )}
          <BrainIcon
            className={s.brainIcon}
            onClick={() => {
              setShowAiSummary((prevState) => !prevState);
            }}
          />
        </div>
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
      <MetaInfo item={item} />
    </div>
  );
}
