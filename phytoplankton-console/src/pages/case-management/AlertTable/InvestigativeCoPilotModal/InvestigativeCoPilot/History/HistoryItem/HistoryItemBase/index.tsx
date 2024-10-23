import React, { useState } from 'react';
import { UseMutationResult } from '@tanstack/react-query';
import { omit, snakeCase } from 'lodash';
import { QuestionResponse, QuestionResponseBase } from '../../../types';
import HistoryItemLayout from '../HistoryItemLayout';
import s from './index.module.less';
import Variables, { VariablesValues } from './Variables';
import MetaInfo from './MetaInfo';
import { formatData } from './exportUtil';
import CommentPopover from './CommentPopover';
import { dayjs } from '@/utils/dayjs';
import { FormValues as CommentEditorFormValues } from '@/components/CommentEditor';
import { DownloadButton } from '@/components/library/Widget';
import { itemId } from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/helpers';

interface Props {
  questionId: string;
  isUnread: boolean;
  commentSubmitMutation: UseMutationResult<unknown, unknown, CommentEditorFormValues>;
  item: QuestionResponse;
  children: React.ReactNode;
  isLoading: boolean;
  onRefresh: (vars: VariablesValues) => void;
}

function HistoryItemBase(props: Props, ref?: React.ForwardedRef<HTMLDivElement | null>) {
  const { commentSubmitMutation, item, children, isLoading, isUnread, onRefresh, questionId } =
    props;
  const { variableOptions, title } = item;

  const [initialVariablesState, setInitialVarsValues] = useState(
    item.variables?.reduce((acc, x) => ({ ...acc, [x.name]: x.value }), {}) ?? {},
  );

  return (
    <HistoryItemLayout
      title={title}
      tools={
        <>
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
          <CommentPopover commentSubmitMutation={commentSubmitMutation} summary={item.summary} />
          {item.questionType !== 'EMBEDDED' && (
            <DownloadButton
              onDownload={async () => {
                return {
                  fileName: `${snakeCase(item.title)}_${dayjs().format('YYYY_MM_DD')}.csv`,
                  data: formatData(
                    omit<QuestionResponseBase>(item, [
                      'questionId',
                      'createdById',
                      'variableOptions',
                    ]),
                  ),
                };
              }}
            />
          )}
        </>
      }
      dataKey={itemId(item)}
      isLoading={isLoading}
      isUnread={isUnread}
      ref={ref}
      count={item.questionType === 'TABLE' ? item.total : undefined}
    >
      {item.explained && <div className={s.explained}>{item.explained}</div>}
      <div>{children}</div>
      <MetaInfo item={item} />
    </HistoryItemLayout>
  );
}

export default React.forwardRef(HistoryItemBase);
