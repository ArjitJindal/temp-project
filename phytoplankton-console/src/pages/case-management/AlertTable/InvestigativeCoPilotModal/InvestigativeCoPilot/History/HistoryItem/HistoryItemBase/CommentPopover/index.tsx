import { useEffect, useRef, useState } from 'react';
import { UseMutationResult } from '@tanstack/react-query';
import s from './index.module.less';
import PopoverV2 from '@/components/ui/PopoverV2';
import CommentEditor, {
  CommentEditorRef,
  FormValues as CommentEditorFormValues,
} from '@/components/CommentEditor';
import AiForensicsLogo from '@/components/ui/AiForensicsLogo';
import { getMutationAsyncResource } from '@/utils/queries/mutations/helpers';
import { useFinishedSuccessfully } from '@/utils/asyncResource';

interface Props {
  commentSubmitMutation: UseMutationResult<unknown, unknown, CommentEditorFormValues>;
  summary?: string;
}

export default function CommentPopover(props: Props) {
  const { commentSubmitMutation, summary } = props;

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
    <PopoverV2
      trigger="click"
      placement="bottom-end"
      portal={true}
      triggerEscapedDetectPaddings={{ bottom: 100 }}
      content={
        <div className={s.commentPopover}>
          <CommentEditor
            key={`${isPopoverVisible}`}
            ref={commentEditorRef}
            values={commentFormValues}
            submitRes={commentSubmitRes}
            hideNarrativeTemplateSelect
            submitButtonTitle="Add to narrative"
            onChangeValues={setCommentFormValues}
            onSubmit={(values) => {
              commentSubmitMutation.mutate(values);
            }}
          />
        </div>
      }
    >
      <div className={s.trigger}>
        <AiForensicsLogo />
      </div>
    </PopoverV2>
  );
}
