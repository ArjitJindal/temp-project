import React from 'react';
import EntityInfoGrid from 'src/components/ui/EntityInfoGrid';
import ContactDetails from 'src/pages/users-item/UserDetails/shared/ContactDetailsCard';
import GeneralDetails from './GeneralDetails';
import LegalDocuments from './LegalDocuments';
import { Person } from '@/apis';

interface Props {
  person: Person;
}

export default function PersonDetails(props: Props) {
  const { person } = props;

  return (
    <EntityInfoGrid.Root columns={3}>
      <EntityInfoGrid.Cell>
        <GeneralDetails person={person} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell>
        <ContactDetails contactDetails={person.contactDetails} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell>
        <LegalDocuments legalDocuments={person.legalDocuments} />
      </EntityInfoGrid.Cell>
    </EntityInfoGrid.Root>
  );
}
