import { useState } from 'react';
import CommentsCard, { CommentGroup } from '../CommentsCard';
import ScopeSelector, { ScopeSelectorValue } from './ScopeSelector';
import s from './index.module.less';
import LogCard from './LogCard';
import * as Card from '@/components/ui/Card';
import { Comment, Permission } from '@/apis';
import { Mutation } from '@/utils/queries/types';
import { StatePair } from '@/utils/state';
import { LogItemData } from '@/components/ActivityCard/LogCard/LogContainer/LogItem';
import { AsyncResource, getOr, map } from '@/utils/asyncResource';
import DownloadFilesButton from '@/components/library/DownloadFilesButton';
import { FormValues as CommentEditorFormValues } from '@/components/CommentEditor';
import { CommentType, Resource } from '@/utils/user-utils';

export type Tab = ScopeSelectorValue;

interface Props<FilterParams> {
  defaultActivityLogParams: FilterParams;
  logs: {
    request: (params: FilterParams) => Promise<LogItemData[]>;
    filters?: (params: StatePair<FilterParams>) => React.ReactNode;
  };
  comments: {
    dataRes: AsyncResource<CommentGroup[]>;
    deleteCommentMutation: Mutation<unknown, unknown, { commentId: string; groupId: string }>;
    handleAddComment: (
      commentFormValues: CommentEditorFormValues,
      groupId: string,
    ) => Promise<Comment>;
    onCommentAdded?: (newComment: Comment, commentType: CommentType, groupId: string) => void;
    writePermissions: Permission[];
    writeResources: Resource[];
  };
}

export default function ActivityCard<FilterParams>(props: Props<FilterParams>) {
  const { defaultActivityLogParams, comments, logs } = props;
  const [selectedSection, setSelectedSection] = useState<Tab>('COMMENTS');
  const [params, setParams] = useState<FilterParams>(defaultActivityLogParams);

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
            writeResources={comments.writeResources}
          />
        )}
        {selectedSection === 'LOG' && (
          <LogCard<FilterParams> logQueryRequest={logs.request} params={params} />
        )}
      </Card.Section>
    </Card.Root>
  );
}

const getAllAttachments = (commentsGroup: CommentGroup[]) => {
  const allComments = commentsGroup.flatMap((commentGroup) => commentGroup.comments);
  return allComments.filter((comment) => comment?.files).flatMap((comment) => comment.files);
};

export { getLogData } from '@/components/ActivityCard/helpers';
