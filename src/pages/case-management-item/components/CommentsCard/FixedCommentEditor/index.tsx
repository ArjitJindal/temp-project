import { Avatar, Comment as AntComment } from 'antd';
import cn from 'clsx';
import CommentEditor from '../CommentEditor';
import s from './styles.module.less';
import { FlagrightAuth0User } from '@/utils/user-utils';
import { CaseStatus, Comment as TransactionComment } from '@/apis';
import { CasesStatusChangeForm } from '@/pages/case-management/components/CaseStatusChangeForm';

interface Props {
  caseId: string;
  user: FlagrightAuth0User;
  handleCommentAdded: (newComment: TransactionComment) => void;
  caseStatus?: CaseStatus;
  onReload: () => void;
}

const FixedCommentEditor = (props: Props) => {
  const { caseId, user, handleCommentAdded, caseStatus } = props;

  return (
    <div className={cn(s.comment)}>
      <div className={s.header}>
        <div className={s.commentTitleParent}>
          <h3 className={cn(s.commentTitle)}>Add a comment</h3>
        </div>
        <CasesStatusChangeForm
          caseIds={[caseId]}
          onSaved={props.onReload}
          newCaseStatus={caseStatus === 'OPEN' || caseStatus === 'REOPENED' ? 'CLOSED' : 'REOPENED'}
          isBlue={true}
          rounded={true}
        />
      </div>
      <AntComment
        className={s.commentBody}
        avatar={<Avatar src={user?.picture} />}
        content={
          <CommentEditor caseId={caseId} onCommentAdded={handleCommentAdded} showFileList={true} />
        }
      />
    </div>
  );
};

export default FixedCommentEditor;
