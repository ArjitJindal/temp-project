import { useState } from 'react';
import CommentsCard, { CommentGroup } from '../CommentsCard';
import ScopeSelector, { ScopeSelectorValue } from './ScopeSelector';
import s from './index.module.less';
import LogCard from './LogCard';
import * as Card from '@/components/ui/Card';
import {
  AlertStatus,
  Case,
  CaseStatus,
  Comment,
  InternalBusinessUser,
  InternalConsumerUser,
  Permission,
} from '@/apis';
import { Mutation } from '@/utils/queries/types';
import { StatePair } from '@/utils/state';
import { LogItemData } from '@/components/ActivityCard/LogCard/LogContainer/LogItem';
import { map, getOr, AsyncResource } from '@/utils/asyncResource';
import DownloadFilesButton from '@/components/library/DownloadFilesButton';
import { FormValues as CommentEditorFormValues } from '@/components/CommentEditor';

export type Tab = ScopeSelectorValue;

interface Props {
  logs: {
    request: (params: ActivityLogFilterParams) => Promise<LogItemData[]>;
    filters?: (params: StatePair<ActivityLogFilterParams>) => React.ReactNode;
  };
  comments: {
    dataRes: AsyncResource<CommentGroup[]>;
    deleteCommentMutation: Mutation<unknown, unknown, { commentId: string; groupId: string }>;
    handleAddComment: (
      commentFormValues: CommentEditorFormValues,
      groupId: string,
    ) => Promise<Comment>;
    onCommentAdded: (newComment: Comment, groupId: string) => void;
    writePermissions: Permission[];
  };
}

export interface ActivityLogFilterParams {
  filterActivityBy?: string[];
  filterCaseStatus?: CaseStatus[];
  filterAlertStatus?: AlertStatus[];
  alertId?: string;
  case?: Case;
  user?: InternalConsumerUser | InternalBusinessUser;
}

const DEFAULT_ACTIVITY_LOG_PARAMS: ActivityLogFilterParams = {
  filterActivityBy: undefined,
  filterCaseStatus: undefined,
  filterAlertStatus: undefined,
  alertId: undefined,
  case: undefined,
  user: undefined,
};

export default function ActivityCard(props: Props) {
  const { comments, logs } = props;
  const [selectedSection, setSelectedSection] = useState<Tab>('COMMENTS');
  const [params, setParams] = useState<ActivityLogFilterParams>(DEFAULT_ACTIVITY_LOG_PARAMS);

  const totalCommentsLengthRes = map(comments.dataRes, (comments) =>
    comments.reduce((acc, group) => acc + group.comments.length, 0),
  );
  return (
    <Card.Root>
      <Card.Section>
        <div className={s.header}>
          <ScopeSelector
            selectedSection={selectedSection}
            setSelectedSection={setSelectedSection}
            count={{
              comments: getOr(totalCommentsLengthRes, 0),
            }}
          />
          <div className={s.subHeader}>
            {selectedSection === 'LOG' ? (
              props.logs.filters?.([params, setParams])
            ) : (
              <DownloadFilesButton files={getAllAttachments(getOr(comments.dataRes, []))} />
            )}
          </div>
        </div>
        {selectedSection === 'COMMENTS' && (
          <CommentsCard
            commentsQuery={comments.dataRes}
            deleteCommentMutation={comments.deleteCommentMutation}
            handleAddComment={comments.handleAddComment}
            onCommentAdded={comments.onCommentAdded}
            writePermissions={comments.writePermissions}
          />
        )}
        {selectedSection === 'LOG' && <LogCard logQueryRequest={logs.request} params={params} />}
      </Card.Section>
    </Card.Root>
  );
}

const getAllAttachments = (commentsGroup: CommentGroup[]) => {
  const allComments = commentsGroup.flatMap((commentGroup) => commentGroup.comments);
  return allComments.filter((comment) => comment.files != null).flatMap((comment) => comment.files);
};
