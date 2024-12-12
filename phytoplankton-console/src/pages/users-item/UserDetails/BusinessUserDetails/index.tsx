import React, { useState } from 'react';
import { CommentType } from '../../../../utils/user-utils';
import LegalEntityDetails from './LegalEntityDetails';
import Persons from './PersonsCard';
import { Comment, InternalBusinessUser } from '@/apis';
import SegmentedControl from '@/components/library/SegmentedControl';
import { useAuth0User } from '@/utils/user-utils';

type Tabs = 'LEGAL_ENTITY' | 'SHAREHOLDERS' | 'DIRECTORS';

interface Props {
  user: InternalBusinessUser;
  onNewComment?: (newComment: Comment, commentType: CommentType, personId?: string) => void;
}

export default function BusinessUserDetails(props: Props) {
  const currentUser = useAuth0User();
  const { user, onNewComment } = props;

  const [activeTab, setActiveTab] = useState<Tabs>('LEGAL_ENTITY');

  return (
    <>
      <SegmentedControl<Tabs>
        active={activeTab}
        onChange={setActiveTab}
        items={[
          { label: 'Legal entity', value: 'LEGAL_ENTITY' },
          { label: `Shareholders (${user.shareHolders?.length ?? 0})`, value: 'SHAREHOLDERS' },
          { label: `Directors (${user.directors?.length ?? 0})`, value: 'DIRECTORS' },
        ]}
      />
      {activeTab === 'LEGAL_ENTITY' && (
        <LegalEntityDetails
          user={user}
          currentUserId={currentUser.userId}
          onNewComment={onNewComment}
        />
      )}
      {activeTab === 'SHAREHOLDERS' && (
        <Persons
          persons={user.shareHolders}
          userId={user.userId}
          personType="SHAREHOLDER"
          currentUserId={currentUser.userId}
          onNewComment={onNewComment}
        />
      )}
      {activeTab === 'DIRECTORS' && (
        <Persons
          persons={user.directors}
          userId={user.userId}
          personType="DIRECTOR"
          currentUserId={currentUser.userId}
          onNewComment={onNewComment}
        />
      )}
    </>
  );
}
