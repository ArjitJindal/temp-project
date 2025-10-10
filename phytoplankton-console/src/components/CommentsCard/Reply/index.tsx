import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import s from './index.module.less';
import CommentEditor, {
  CommentEditorRef,
  FormValues as CommentEditorFormValues,
} from '@/components/CommentEditor';
import { message } from '@/components/library/Message';
import { sanitizeComment } from '@/components/markdown/MarkdownEditor/mention-utlis';
import { getErrorMessage } from '@/utils/lang';
import { getMutationAsyncResource } from '@/utils/queries/mutations/helpers';
import { Comment as ApiComment } from '@/apis';

interface Props {
  submitRequest: (values: CommentEditorFormValues) => Promise<ApiComment>;
  onSuccess: (createdComment: ApiComment) => void;
  parentCommentId?: string;
}

export const Reply = (props: Props) => {
  const { submitRequest, onSuccess, parentCommentId } = props;
  const [commentFormValues, setCommentFormValues] = useState<CommentEditorFormValues>({
    comment: '',
    files: [],
    parentCommentId: parentCommentId,
  });
  const commentEditorRef = useRef<CommentEditorRef>(null);
  const commentSubmitMutation = useMutation<ApiComment, unknown, CommentEditorFormValues>(
    submitRequest,
    {
      onSuccess: (data) => {
        message.success('Comment added successfully');
        onSuccess(data);
        commentEditorRef.current?.reset();
        setCommentFormValues((prev) => {
          return { ...prev, files: [], parentCommentId: parentCommentId };
        });
      },
      onError: (error) => {
        message.fatal(`Unable to add comment! ${getErrorMessage(error)}`, error);
      },
    },
  );
  return (
    <div className={s.root}>
      <CommentEditor
        ref={commentEditorRef}
        values={commentFormValues}
        submitRes={getMutationAsyncResource(commentSubmitMutation)}
        onChangeValues={setCommentFormValues}
        onSubmit={() => {
          commentSubmitMutation.mutate({
            ...commentFormValues,
            comment: sanitizeComment(commentFormValues.comment),
            parentCommentId: parentCommentId,
          });
        }}
        editorHeight={150}
      />
    </div>
  );
};
