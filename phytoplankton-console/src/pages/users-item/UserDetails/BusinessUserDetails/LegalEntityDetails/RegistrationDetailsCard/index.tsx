import React from 'react';
import { InternalBusinessUser } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';
import CountryDisplay from '@/components/ui/CountryDisplay';
import Tags from '@/pages/users-item/UserDetails/shared/Tags';

interface Props {
  user: InternalBusinessUser;
}

export default function RegistrationDetails(props: Props) {
  const { user } = props;

  return (
    <EntityPropertiesCard
      title={'Registration details'}
      items={[
        {
          label: 'Registration identifier',
          value: user?.legalEntity?.companyRegistrationDetails?.registrationIdentifier ?? '-',
        },
        {
          label: 'Registered in',
          value: user?.legalEntity?.companyRegistrationDetails?.registrationCountry ? (
            <CountryDisplay
              isoCode={user?.legalEntity?.companyRegistrationDetails.registrationCountry}
            />
          ) : (
            '-'
          ),
        },
        {
          label: 'Registered on',
          value: user?.legalEntity?.companyRegistrationDetails?.dateOfRegistration
            ? dayjs(user?.legalEntity?.companyRegistrationDetails.dateOfRegistration).format(
                DATE_TIME_FORMAT_WITHOUT_SECONDS,
              )
            : '-',
        },
        {
          label: 'Tax residence',
          value: user?.legalEntity?.companyRegistrationDetails?.taxResidenceCountry ? (
            <CountryDisplay
              isoCode={user?.legalEntity?.companyRegistrationDetails.taxResidenceCountry}
            />
          ) : (
            '-'
          ),
        },
        {
          label: 'Tax ID',
          value: user?.legalEntity?.companyRegistrationDetails?.taxIdentifier ?? '-',
        },
        {
          label: 'Legal entity type',
          value: user?.legalEntity?.companyRegistrationDetails?.legalEntityType ?? '-',
        },
        {
          label: 'Tags',
          value: <Tags tags={user?.legalEntity?.companyRegistrationDetails?.tags ?? []} />,
        },
      ]}
    />
  );
}
