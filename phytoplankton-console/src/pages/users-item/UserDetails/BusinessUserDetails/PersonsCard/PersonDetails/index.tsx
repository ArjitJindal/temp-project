import React from 'react';
import EntityInfoGrid from 'src/components/ui/EntityInfoGrid';
import ContactDetails from 'src/pages/users-item/UserDetails/shared/ContactDetailsCard';
import GeneralDetails from './GeneralDetails';
import Attachments from './Attachments';
import LegalDocuments from './LegalDocuments';
import { Person } from '@/apis';
import { useAuth0User } from '@/utils/user-utils';

interface Props {
  userId: string;
  person: Person;
  isShareHolder: boolean;
}

export default function PersonDetails(props: Props) {
  const user = useAuth0User();
  const { userId, person, isShareHolder } = props;

  return (
    <EntityInfoGrid.Root columns={3}>
      <EntityInfoGrid.Cell>
        <GeneralDetails person={person} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell>
        <ContactDetails contactDetails={person.contactDetails} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell>
        <Attachments
          attachments={person.attachments || []}
          userId={userId}
          personId={person.userId}
          currentUserId={user.userId}
          isShareHolder={isShareHolder}
        />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell columnSpan={3}>
        <LegalDocuments legalDocuments={person.legalDocuments} />
      </EntityInfoGrid.Cell>
    </EntityInfoGrid.Root>
  );
}
