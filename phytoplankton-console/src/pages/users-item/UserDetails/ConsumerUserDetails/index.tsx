import ContactDetails from 'src/pages/users-item/UserDetails/shared/ContactDetailsCard';
import ExpectedIncome from 'src/pages/users-item/UserDetails/shared/ExpectedIncome';
import SavedPaymentDetails from 'src/pages/users-item/UserDetails/shared/SavedPaymentDetailsCard';
import GeneralDetails from './GeneralDetails';
import LegalDocuments from './LegalDocument';
import EntityInfoGrid from '@/components/ui/EntityInfoGrid';
import { InternalConsumerUser } from '@/apis';
import Tags from '@/pages/users-item/UserDetails/shared/Tags';

interface Props {
  user: InternalConsumerUser;
}

export default function ConsumerUserDetails(props: Props) {
  const { user } = props;
  return (
    <EntityInfoGrid.Root columns={3}>
      <EntityInfoGrid.Cell>
        <GeneralDetails user={user} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell>
        <ContactDetails contactDetails={user.contactDetails} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell>
        <LegalDocuments legalDocuments={user.legalDocuments} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell>
        <Tags tags={user.tags ?? []} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell>
        <SavedPaymentDetails user={user} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell>
        <ExpectedIncome expectedIncome={user.expectedIncome} />
      </EntityInfoGrid.Cell>
    </EntityInfoGrid.Root>
  );
}
