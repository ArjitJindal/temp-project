import React from 'react';
import { Person } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import { formatConsumerName } from '@/utils/api/users';
import CountryDisplay from '@/components/ui/CountryDisplay';
import TagList from '@/components/library/Tag/TagList';
import KeyValueTag from '@/components/library/Tag/KeyValueTag';
import GenderTag from '@/components/library/Tag/GenderTag';

interface Props {
  person: Person;
}

export default function GeneralDetails(props: Props) {
  const { person } = props;
  const { generalDetails } = person;
  return (
    <EntityPropertiesCard
      title={'General details'}
      items={[
        { label: 'First name', value: formatConsumerName(generalDetails.name) },
        { label: 'Date of birth', value: generalDetails.dateOfBirth },
        {
          label: 'Gender',
          value: <GenderTag>{generalDetails.gender}</GenderTag>,
        },
        {
          label: 'Country of residence',
          value: <CountryDisplay isoCode={generalDetails.countryOfResidence} />,
        },
        {
          label: 'Country of nationality',
          value: <CountryDisplay isoCode={generalDetails.countryOfNationality} />,
        },
        {
          label: 'Tags',
          value: (
            <TagList>
              {person.tags?.map((tag) => (
                <KeyValueTag key={tag.key} tag={tag} />
              ))}
            </TagList>
          ),
        },
      ]}
    />
  );
}
