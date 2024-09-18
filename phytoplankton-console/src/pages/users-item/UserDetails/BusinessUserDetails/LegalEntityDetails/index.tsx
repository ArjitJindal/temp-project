import React from 'react';
import ContactDetailsCard from '../../shared/ContactDetailsCard';
import Tags from '../../shared/Tags';
import SavedPaymentDetailsCard from '../../shared/SavedPaymentDetailsCard';
import GeneralDetailsCard from './GeneralDetailsCard';
import RegistrationDetailsCard from './RegistrationDetailsCard';
import FinancialDetailsCard from './FinancialDetailsCard';
import MerchantCategoryCodeCard from './MerchantCategoryCodeCard';
import LinkedEntitiesCard from './LinkedEntitiesCard';
import EntityInfoGrid from '@/components/ui/EntityInfoGrid';
import { InternalBusinessUser } from '@/apis';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  user: InternalBusinessUser;
}

export default function LegalEntityDetails(props: Props) {
  const { user } = props;
  const isEntityLinkingEnabled = useFeatureEnabled('ENTITY_LINKING');

  return (
    <EntityInfoGrid.Root columns={3}>
      <EntityInfoGrid.Cell>
        <GeneralDetailsCard user={user} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell>
        <ContactDetailsCard contactDetails={user.legalEntity.contactDetails} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell>
        <RegistrationDetailsCard user={user} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell rowSpan={2}>
        <Tags user={user} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell>
        <FinancialDetailsCard user={user} />
      </EntityInfoGrid.Cell>
      {isEntityLinkingEnabled && (
        <EntityInfoGrid.Cell rowSpan={2}>
          <LinkedEntitiesCard user={user} />
        </EntityInfoGrid.Cell>
      )}
      <EntityInfoGrid.Cell>
        <MerchantCategoryCodeCard user={user} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell columnSpan={3}>
        <SavedPaymentDetailsCard user={user} />
      </EntityInfoGrid.Cell>
    </EntityInfoGrid.Root>
  );
}
