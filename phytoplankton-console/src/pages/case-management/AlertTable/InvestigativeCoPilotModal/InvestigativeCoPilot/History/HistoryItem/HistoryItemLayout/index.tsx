import React, { useState } from 'react';
import cn from 'clsx';
import { UseMutationResult } from '@tanstack/react-query';
import { omit, snakeCase } from 'lodash';
import { QuestionResponseBase } from '../../../types';
import s from './index.module.less';
import Variables, { VariablesValues } from './Variables';
import MetaInfo from './MetaInfo';
import { formatData } from './exportUtil';
import CommentPopover from './CommentPopover';
import { dayjs } from '@/utils/dayjs';
import { FormValues as CommentEditorFormValues } from '@/components/CommentEditor';
import { DownloadButton } from '@/components/library/Widget';
import { QuestionResponse } from '@/apis';

interface Props {
  questionId: string;
  isVisible: boolean;
  commentSubmitMutation: UseMutationResult<unknown, unknown, CommentEditorFormValues>;
  item: QuestionResponse;
  children: React.ReactNode;
  isLoading: boolean;
  onRefresh: (vars: VariablesValues) => void;
}

function HistoryItemLayout(props: Props, ref?: React.ForwardedRef<HTMLDivElement | null>) {
  const { commentSubmitMutation, item, children, isLoading, isVisible, onRefresh, questionId } =
    props;
  const { variableOptions, title } = item;

  const [initialVariablesState, setInitialVarsValues] = useState(
    item.variables?.reduce((acc, x) => ({ ...acc, [x.name]: x.value }), {}) ?? {},
  );

  return (
    <div
      data-key={item.createdAt.toString()}
      className={cn(s.root, isLoading && s.isLoading, !isVisible && s.isHidden)}
      ref={ref}
    >
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
        </div>
      </div>
      {item.explained && <div className={s.explained}>{item.explained}</div>}
      <div>{children}</div>
      <MetaInfo item={item} />
    </div>
  );
}

export default React.forwardRef(HistoryItemLayout);
