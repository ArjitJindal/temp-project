import { message, Popover } from 'antd';
import React, { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import s from './styles.module.less';
import Button from '@/components/ui/Button';
import CommentEditor, {
  CommentEditorRef,
  FormValues as CommentEditorFormValues,
} from '@/components/CommentEditor';
import WechatLineIcon from '@/components/ui/icons/Remix/logos/wechat-line.react.svg';
import { getErrorMessage } from '@/utils/lang';
import { getMutationAsyncResource } from '@/utils/queries/hooks';
import { Comment } from '@/apis';

interface Props {
  submitRequest: (values: CommentEditorFormValues) => Promise<Comment>;
  onSuccess: (createdComment: Comment) => void;
}

export default function CommentButton(props: Props) {
  const { submitRequest, onSuccess } = props;
  const [commentFormValues, setCommentFormValues] = useState<CommentEditorFormValues>({
    comment: '',
    files: [],
  });
  const [isTooltipVisible, setTooltipVisible] = useState(false);
  const commentEditorRef = useRef<CommentEditorRef>(null);

  const commentSubmitMutation = useMutation<Comment, unknown, CommentEditorFormValues>(
    submitRequest,
    {
      onSuccess: (data) => {
        message.success('Comment successfully added!');
        onSuccess(data);
        commentEditorRef.current?.reset();
      },
      onError: (error) => {
        console.log(error);
        message.error(`Unable to add comment! ${getErrorMessage(error)}`);
      },
    },
  );

  const popoverTargetRef = useRef(null);

  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      visible={isTooltipVisible}
      onVisibleChange={setTooltipVisible}
      getPopupContainer={() => {
        if (popoverTargetRef.current) {
          return popoverTargetRef.current;
        }
        return document.body;
      }}
      content={
        <div className={s.popoverContent}>
          <CommentEditor
            ref={commentEditorRef}
            values={commentFormValues}
            submitRes={getMutationAsyncResource(commentSubmitMutation)}
            onChangeValues={setCommentFormValues}
            onSubmit={() => {
              commentSubmitMutation.mutate(commentFormValues);
            }}
          />
        </div>
      }
    >
      <div ref={popoverTargetRef}>
        <Button icon={<WechatLineIcon />}>Comment</Button>
      </div>
    </Popover>
  );
}
