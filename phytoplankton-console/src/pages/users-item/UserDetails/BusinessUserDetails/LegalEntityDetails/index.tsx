import React from 'react';
import ContactDetailsCard from '../../shared/ContactDetailsCard';
import Tags from '../../shared/Tags';
import SavedPaymentDetailsCard from '../../shared/SavedPaymentDetailsCard';
import GeneralDetailsCard from './GeneralDetailsCard';
import RegistrationDetailsCard from './RegistrationDetailsCard';
import FinancialDetailsCard from './FinancialDetailsCard';
import MerchantCategoryCodeCard from './MerchantCategoryCodeCard';
import LinkedEntitiesCard from './LinkedEntitiesCard';
import TransactionAndPaymentMethodLimits from './TransactionAndPaymentMethodLimits';
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
        <EntityInfoGrid.ColumnGroup
          childrens={[
            <RegistrationDetailsCard key={'registration-details-card'} user={user} />,
            <FinancialDetailsCard key={'financial-details-card'} user={user} />,
          ]}
        />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell>
        <EntityInfoGrid.ColumnGroup
          childrens={[
            <ContactDetailsCard
              contactDetails={user.legalEntity.contactDetails}
              key={'contact-details-card'}
            />,
            <MerchantCategoryCodeCard user={user} key="merchant-category-code-card" />,
          ]}
        />
      </EntityInfoGrid.Cell>

      <EntityInfoGrid.Cell columnSpan={1} rowSpan={2} maxHeight={350}>
        <Tags tags={user.tags ?? []} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell columnSpan={isEntityLinkingEnabled ? 1 : 2} rowSpan={2} maxHeight={350}>
        <TransactionAndPaymentMethodLimits user={user} />
      </EntityInfoGrid.Cell>
      {isEntityLinkingEnabled && (
        <EntityInfoGrid.ColumnGroup
          columnSpan={1}
          rowSpan={2}
          maxHeight={350}
          childrens={[<LinkedEntitiesCard user={user} key="linked-entities-card" />]}
        />
      )}
      <EntityInfoGrid.Cell columnSpan={3}>
        <SavedPaymentDetailsCard user={user} />
      </EntityInfoGrid.Cell>
    </EntityInfoGrid.Root>
  );
}
