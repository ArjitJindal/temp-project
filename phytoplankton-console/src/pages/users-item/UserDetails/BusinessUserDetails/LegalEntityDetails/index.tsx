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
      <EntityInfoGrid.Cell columnSpan={1} rowSpan={2} maxHeight={350}>
        <Tags tags={user.tags ?? []} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell columnSpan={1} rowSpan={2} maxHeight={350}>
        <FinancialDetailsCard user={user} />
      </EntityInfoGrid.Cell>
      {isEntityLinkingEnabled ? (
        <EntityInfoGrid.ColumnGroup
          columnSpan={1}
          rowSpan={2}
          maxHeight={350}
          childrens={[
            <LinkedEntitiesCard user={user} key="linked-entities-card" />,
            <MerchantCategoryCodeCard user={user} key="merchant-category-code-card" />,
          ]}
        />
      ) : (
        <EntityInfoGrid.ColumnGroup
          columnSpan={1}
          rowSpan={2}
          maxHeight={350}
          childrens={[<MerchantCategoryCodeCard user={user} key="merchant-category-code-card" />]}
        />
      )}

      <EntityInfoGrid.Cell columnSpan={3}>
        <SavedPaymentDetailsCard user={user} />
      </EntityInfoGrid.Cell>
    </EntityInfoGrid.Root>
  );
}
