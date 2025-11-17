import React from 'react';
import GeneralDetails from './GeneralDetails';
import RegistrationDetails from './RegistrationDetails';
import FinancialDetails from './FinancialDetails';
import ContactDetails from '@/pages/users-item/UserDetails/shared/ContactDetailsCard';
import EntityInfoGrid from '@/components/ui/EntityInfoGrid';
import { LegalEntity } from '@/apis';

interface Props {
  legalEntity: LegalEntity;
}

export default function LegalEntityDetails(props: Props) {
  const { legalEntity } = props;
  return (
    <EntityInfoGrid.Root columns={3}>
      <EntityInfoGrid.Cell maxHeight={400}>
        <GeneralDetails generalDetails={legalEntity.companyGeneralDetails} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell maxHeight={400}>
        <ContactDetails contactDetails={legalEntity.contactDetails} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell maxHeight={400}>
        <RegistrationDetails registrationDetails={legalEntity.companyRegistrationDetails} />
      </EntityInfoGrid.Cell>
      {legalEntity.companyFinancialDetails && (
        <EntityInfoGrid.Cell columnSpan={3}>
          <FinancialDetails financialDetails={legalEntity.companyFinancialDetails} />
        </EntityInfoGrid.Cell>
      )}
    </EntityInfoGrid.Root>
  );
}
