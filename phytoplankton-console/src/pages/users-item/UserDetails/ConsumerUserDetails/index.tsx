import ContactDetails from 'src/pages/users-item/UserDetails/shared/ContactDetailsCard';
import SavedPaymentDetails from 'src/pages/users-item/UserDetails/shared/SavedPaymentDetailsCard';
import GeneralDetails from './GeneralDetails';
import EntityInfoGrid from '@/components/ui/EntityInfoGrid';
import { InternalConsumerUser } from '@/apis';
import LegalDocuments from '@/pages/users-item/UserDetails/BusinessUserDetails/PersonsCard/PersonDetails/LegalDocuments';
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
        <Tags user={user} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell columnSpan={2}>
        <SavedPaymentDetails user={user} />
      </EntityInfoGrid.Cell>
    </EntityInfoGrid.Root>
  );
}
