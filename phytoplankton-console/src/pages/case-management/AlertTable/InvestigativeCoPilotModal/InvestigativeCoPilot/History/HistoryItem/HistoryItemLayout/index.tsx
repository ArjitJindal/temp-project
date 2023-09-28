import React, { useState } from 'react';
import cn from 'clsx';
import { UseMutationResult } from '@tanstack/react-query';
import { QuestionResponseBase } from '../../../types';
import s from './index.module.less';
import Variables, { VariablesValues } from './Variables';
import MetaInfo from './MetaInfo';
import { FormValues as CommentEditorFormValues } from '@/components/CommentEditor';
import CommentPopover from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/History/HistoryItem/HistoryItemLayout/CommentPopover';

interface Props {
  questionId: string;
  commentSubmitMutation: UseMutationResult<unknown, unknown, CommentEditorFormValues>;
  item: QuestionResponseBase;
  children: React.ReactNode;
  isLoading: boolean;
  onRefresh: (vars: VariablesValues) => void;
}

export default function HistoryItemLayout(props: Props) {
  const { commentSubmitMutation, item, children, isLoading, onRefresh, questionId } = props;
  const { variableOptions, title } = item;

  const [initialVariablesState, setInitialVarsValues] = useState(
    item.variables?.reduce((acc, x) => ({ ...acc, [x.name]: x.value }), {}) ?? {},
  );

  return (
    <div className={cn(s.root, isLoading && s.isLoading)}>
      <div className={s.header}>
        <div className={s.title}>{title}</div>
        <div className={s.tools}>
          {variableOptions && variableOptions.length > 0 && (
            <Variables
              questionId={questionId}
              initialValues={initialVariablesState}
              variables={variableOptions}
              onConfirm={(variablesValues) => {
                setInitialVarsValues(variablesValues);
                onRefresh(variablesValues);
              }}
            />
          )}
          <CommentPopover commentSubmitMutation={commentSubmitMutation} item={item} />
        </div>
      </div>
      {item.explained && <div className={s.explained}>{item.explained}</div>}
      <div>{children}</div>
      <MetaInfo item={item} />
    </div>
  );
}
