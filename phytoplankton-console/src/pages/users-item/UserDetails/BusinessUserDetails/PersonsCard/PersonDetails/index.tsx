import React from 'react';
import EntityInfoGrid from 'src/components/ui/EntityInfoGrid';
import ContactDetails from 'src/pages/users-item/UserDetails/shared/ContactDetailsCard';
import Attachments from '../../../Attachments';
import LegalDocuments from '../../LegalDocuments';
import GeneralDetails from './GeneralDetails';
import { AttachmentUserType, Comment, Person } from '@/apis';
import { CommentType } from '@/utils/user-utils';

interface Props {
  userId: string;
  person: Person;
  personType: AttachmentUserType;
  currentUserId: string;
  onNewComment?: (newComment: Comment, commentType: CommentType, personId?: string) => void;
}

export default function PersonDetails(props: Props) {
  const { userId, person, personType, currentUserId, onNewComment } = props;

  return (
    <EntityInfoGrid.Root columns={3}>
      <EntityInfoGrid.Cell maxHeight={400}>
        <GeneralDetails person={person} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell maxHeight={400}>
        <ContactDetails contactDetails={person.contactDetails} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell maxHeight={400}>
        <Attachments
          attachments={person.attachments || []}
          userId={userId}
          personId={person.userId ?? ''}
          currentUserId={currentUserId}
          personType={personType}
          onNewComment={onNewComment}
        />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell columnSpan={3}>
        <LegalDocuments legalDocuments={person.legalDocuments} />
      </EntityInfoGrid.Cell>
    </EntityInfoGrid.Root>
  );
}
