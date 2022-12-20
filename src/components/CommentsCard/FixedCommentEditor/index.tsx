import { Avatar, Comment as AntComment } from 'antd';
import cn from 'clsx';
import { useState } from 'react';
import CommentEditor, { FormValues as CommentEditorFormValues } from '../CommentEditor';
import s from './styles.module.less';
import { FlagrightAuth0User } from '@/utils/user-utils';
import { CaseStatus, Comment as TransactionComment } from '@/apis';
import { CasesStatusChangeForm } from '@/pages/case-management/components/CaseStatusChangeForm';

interface Props {
  id: string;
  user: FlagrightAuth0User;
  handleCommentAdded: (newComment: TransactionComment) => void;
  caseStatus?: CaseStatus;
  onReload: () => void;
  commentType: 'CASE' | 'USER';
}

const FixedCommentEditor = (props: Props) => {
  const { user, handleCommentAdded, caseStatus, id, commentType } = props;

  const [commentFormValues, setCommentFormValues] = useState<CommentEditorFormValues>({
    comment: '',
    files: [],
  });

  return (
    <div className={s.comment}>
      <div className={s.header}>
        <div className={s.commentTitleParent}>
          <h3 className={cn(s.commentTitle)}>Add a comment</h3>
        </div>
        {commentType === 'CASE' && (
          <CasesStatusChangeForm
            caseIds={[id]}
            onSaved={props.onReload}
            newCaseStatus={
              caseStatus === 'OPEN' || caseStatus === 'REOPENED' ? 'CLOSED' : 'REOPENED'
            }
            initialValues={{
              reasons: [],
              reasonOther: null,
              comment: commentFormValues.comment,
              files: commentFormValues.files,
            }}
            buttonProps={{
              isBlue: true,
              rounded: true,
              size: 'small',
            }}
          />
        )}
      </div>
      <AntComment
        className={s.commentBody}
        avatar={<Avatar src={user?.picture} />}
        content={
          <CommentEditor
            id={id}
            onCommentAdded={handleCommentAdded}
            showFileList={true}
            commentType={commentType}
            values={commentFormValues}
            onChangeValues={setCommentFormValues}
          />
        }
      />
    </div>
  );
};

export default FixedCommentEditor;
