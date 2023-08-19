import { useState } from 'react';
import CommentsCard from '../CommentsCard';
import LogCard from './LogCard';
import ScopeSelector from './ScopeSelector';
import s from './index.module.less';
import ActivityByFilterButton from './Filters/ActivityByFilterButton';
import StatusFilterButton from './Filters/StatusFilterButton';
import AlertIdSearchFilter from './Filters/AlertIdSearchFIlter';
import * as Card from '@/components/ui/Card';
import {
  AlertStatus,
  Case,
  CaseStatus,
  Comment,
  InternalBusinessUser,
  InternalConsumerUser,
} from '@/apis';
import CommentsCardForCase, {
  CommentGroup,
} from '@/pages/case-management-item/CaseDetails/CommentsCard';

interface Props {
  user: InternalConsumerUser | InternalBusinessUser;
  handleUserUpdate?: (userItem: InternalConsumerUser | InternalBusinessUser) => void;
  type: 'USER' | 'CASE';
  caseItems: Case[];
  comments: Array<Comment> | CommentGroup[];
}

export interface ActivityLogFilterParams {
  filterActivityBy?: string[];
  filterCaseStatus?: CaseStatus[];
  filterAlertStatus?: AlertStatus[];
  alertId?: string;
  case?: Case;
}

const DEFAULT_ACTIVITY_LOG_PARAMS: ActivityLogFilterParams = {
  filterActivityBy: undefined,
  filterCaseStatus: undefined,
  filterAlertStatus: undefined,
  alertId: undefined,
  case: undefined,
};

export default function ActivityCard(props: Props) {
  const { user, handleUserUpdate, type, caseItems, comments } = props;
  const [selectedSection, setSelectedSection] = useState('COMMENTS');
  const entityIds = useGetEntityIds(caseItems);
  const totalCommentsLength =
    type === 'CASE'
      ? (comments as CommentGroup[]).reduce((acc, group) => acc + group.comments.length, 0)
      : 0;
  DEFAULT_ACTIVITY_LOG_PARAMS.case = type === 'CASE' ? caseItems[0] : undefined;
  const [params, setParams] = useState<ActivityLogFilterParams>(DEFAULT_ACTIVITY_LOG_PARAMS);
  return (
    <Card.Root>
      <Card.Section>
        <div className={s.header}>
          <ScopeSelector
            selectedSection={selectedSection}
            setSelectedSection={setSelectedSection}
            count={{
              comments: type === 'USER' ? (comments ?? []).length : totalCommentsLength,
            }}
          />
          {selectedSection === 'LOG' && (
            <div className={s.subHeader}>
              <StatusFilterButton
                initialState={params?.filterCaseStatus ?? []}
                onConfirm={(value) => {
                  setParams((prevState) => ({
                    ...prevState,
                    filterCaseStatus: value,
                  }));
                }}
                title={'Case status'}
              />
              <AlertIdSearchFilter
                initialState={params?.alertId}
                onConfirm={(value) => {
                  setParams((prevState) => ({
                    ...prevState,
                    alertId: value,
                  }));
                }}
              />
              <StatusFilterButton
                initialState={params?.filterAlertStatus ?? []}
                onConfirm={(value) => {
                  setParams((prevState) => ({
                    ...prevState,
                    filterAlertStatus: value,
                  }));
                }}
                title={'Alert status'}
              />
              <ActivityByFilterButton
                initialState={params?.filterActivityBy ?? []}
                onConfirm={(value) => {
                  setParams((prevState) => ({
                    ...prevState,
                    filterActivityBy: value,
                  }));
                }}
              />
            </div>
          )}
        </div>
        {selectedSection === 'COMMENTS' &&
          (type === 'USER' && handleUserUpdate ? (
            <CommentsCard
              id={user.userId}
              comments={(comments ?? []) as Comment[]}
              onCommentsUpdate={(newComments) => {
                handleUserUpdate({ ...user, comments: newComments });
              }}
              commentType={type}
            />
          ) : (
            <CommentsCardForCase
              id={caseItems[0].caseId}
              comments={(comments ?? []) as CommentGroup[]}
            />
          ))}
        {selectedSection === 'LOG' && (
          <LogCard entityIds={entityIds as string[]} params={params} type={type} />
        )}
      </Card.Section>
    </Card.Root>
  );
}

export const useGetEntityIds = (entities: Case[]) => {
  const ids = new Set();
  entities.forEach((entity) => {
    ids.add(entity.caseId);
    entity.alerts?.forEach((alert) => {
      ids.add(alert.alertId);
    });
  });
  return [...ids];
};
