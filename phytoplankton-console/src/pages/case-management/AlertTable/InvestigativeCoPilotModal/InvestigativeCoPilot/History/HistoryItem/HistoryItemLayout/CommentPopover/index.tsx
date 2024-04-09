import React, { useEffect, useRef, useState } from 'react';
import { Popover } from 'antd';
import { UseMutationResult } from '@tanstack/react-query';
import { QuestionResponseBase } from '../../../../types';
import s from './index.module.less';
import CommentEditor, {
  CommentEditorRef,
  FormValues as CommentEditorFormValues,
} from '@/components/CommentEditor';
import BrainIcon from '@/components/ui/icons/brain-icon-colored.react.svg';
import { getMutationAsyncResource } from '@/utils/queries/mutations/helpers';
import { useFinishedSuccessfully } from '@/utils/asyncResource';

interface Props {
  commentSubmitMutation: UseMutationResult<unknown, unknown, CommentEditorFormValues>;
  item: QuestionResponseBase;
}

export default function CommentPopover(props: Props) {
  const { commentSubmitMutation, item } = props;

  const { summary } = item;

  const [commentFormValues, setCommentFormValues] = useState<CommentEditorFormValues>({
    comment: summary ?? '',
    files: [],
  });

  useEffect(() => {
    setCommentFormValues({
      comment: summary ?? '',
      files: [],
    });
  }, [summary]);
  const [isPopoverVisible, setPopoverVisible] = useState(false);

  const commentEditorRef = useRef<CommentEditorRef>(null);

  const commentSubmitRes = getMutationAsyncResource(commentSubmitMutation);
  const isCommentSubmitted = useFinishedSuccessfully(commentSubmitRes);
  useEffect(() => {
    if (isCommentSubmitted) {
      commentEditorRef?.current?.reset();
      setPopoverVisible(false);
    }
  }, [isCommentSubmitted]);

  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      autoAdjustOverflow={false}
      visible={isPopoverVisible}
      onVisibleChange={setPopoverVisible}
      content={
        <div className={s.commentPopover}>
          <CommentEditor
            key={`${isPopoverVisible}`}
            ref={commentEditorRef}
            values={commentFormValues}
            submitRes={commentSubmitRes}
            hideNarrativeTemplateSelect={true}
            submitButtonTitle="Add to narrative"
            onChangeValues={setCommentFormValues}
            onSubmit={(values) => {
              commentSubmitMutation.mutate(values);
            }}
          />
        </div>
      }
    >
      <BrainIcon className={s.brainIcon} />
    </Popover>
  );
}
