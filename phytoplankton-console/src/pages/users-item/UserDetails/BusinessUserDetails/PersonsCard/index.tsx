import React from 'react';
import PersonDetails from './PersonDetails';
import s from './index.module.less';
import { AttachmentUserType, Comment, Person } from '@/apis';
import { CommentType } from '@/utils/user-utils';

interface Props {
  userId: string;
  persons?: Person[];
  personType: AttachmentUserType;
  currentUserId: string;
  onNewComment?: (newComment: Comment, commentType: CommentType, personId?: string) => void;
}

export default function Persons(props: Props) {
  const { persons, userId, personType, currentUserId, onNewComment } = props;

  return (
    <div className={s.root}>
      {persons?.map((person, i) => (
        <PersonDetails
          key={i}
          person={person}
          userId={userId}
          personType={personType}
          currentUserId={currentUserId}
          onNewComment={onNewComment}
        />
      ))}
    </div>
  );
}
