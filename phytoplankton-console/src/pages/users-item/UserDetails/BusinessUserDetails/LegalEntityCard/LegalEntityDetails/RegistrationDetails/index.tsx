import React from 'react';
import { CompanyRegistrationDetails } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';
import CountryDisplay from '@/components/ui/CountryDisplay';
import TagList from '@/components/library/Tag/TagList';
import KeyValueTag from '@/components/library/Tag/KeyValueTag';

interface Props {
  registrationDetails?: CompanyRegistrationDetails;
}

export default function RegistrationDetails(props: Props) {
  const { registrationDetails } = props;

  if (!registrationDetails) {
    return null;
  }

  return (
    <EntityPropertiesCard
      title={'Registration details'}
      items={[
        {
          label: 'Registration identifier',
          value: registrationDetails?.registrationIdentifier ?? '-',
        },
        {
          label: 'Registered in',
          value: registrationDetails?.registrationCountry ? (
            <CountryDisplay isoCode={registrationDetails.registrationCountry} />
          ) : (
            '-'
          ),
        },
        {
          label: 'Registered on',
          value: registrationDetails?.dateOfRegistration
            ? dayjs(registrationDetails.dateOfRegistration).format(DATE_TIME_FORMAT_WITHOUT_SECONDS)
            : '-',
        },
        {
          label: 'Tax residence',
          value: registrationDetails?.taxResidenceCountry ? (
            <CountryDisplay isoCode={registrationDetails.taxResidenceCountry} />
          ) : (
            '-'
          ),
        },
        {
          label: 'Tax ID',
          value: registrationDetails?.taxIdentifier ?? '-',
        },
        {
          label: 'Legal entity type',
          value: registrationDetails?.legalEntityType ?? '-',
        },
        {
          label: 'Tags',
          value: registrationDetails?.tags?.length ? (
            <TagList>
              {registrationDetails.tags.map((x) => (
                <KeyValueTag key={x.key} tag={x} />
              ))}
            </TagList>
          ) : (
            '-'
          ),
        },
      ]}
    />
  );
}
