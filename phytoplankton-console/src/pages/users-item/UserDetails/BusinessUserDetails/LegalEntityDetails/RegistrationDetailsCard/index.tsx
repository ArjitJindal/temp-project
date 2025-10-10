import React from 'react';
import { InternalBusinessUser } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';
import CountryDisplay from '@/components/ui/CountryDisplay';
import TagList from '@/components/library/Tag/TagList';
import KeyValueTag from '@/components/library/Tag/KeyValueTag';

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
          value: user.legalEntity.companyRegistrationDetails?.tags?.length && (
            <TagList>
              {user.legalEntity.companyRegistrationDetails?.tags?.map((x) => (
                <KeyValueTag key={x.key} tag={x} />
              ))}
            </TagList>
          ),
        },
      ]}
    />
  );
}
