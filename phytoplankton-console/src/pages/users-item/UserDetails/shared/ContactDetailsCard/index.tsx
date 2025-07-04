import React from 'react';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import { ContactDetails as ApiContactDetails } from '@/apis';
import { callRender } from '@/components/library/Table/dataTypeHelpers';
import {
  ADDRESS,
  EMAIL,
  EXTERNAL_LINK,
  FAX,
  PHONE,
} from '@/components/library/Table/standardDataTypes';
import { formatConsumerName } from '@/utils/api/users';
import TagList from '@/components/library/Tag/TagList';
import KeyValueTag from '@/components/library/Tag/KeyValueTag';

interface Props {
  contactDetails?: ApiContactDetails;
}

export default function ContactDetails(props: Props) {
  const { contactDetails } = props;

  return (
    <EntityPropertiesCard
      title={'Contact details'}
      items={[
        {
          label: 'Name',
          value: formatConsumerName(contactDetails?.name),
        },
        {
          label: 'Email',
          value: contactDetails?.emailIds?.length && (
            <div>
              {contactDetails?.emailIds?.map((x, index) => (
                <div key={`email-${index}`}>{callRender(EMAIL, x)}</div>
              ))}
            </div>
          ),
        },
        {
          label: 'Tel.',
          value: contactDetails?.contactNumbers?.length && (
            <div>
              {contactDetails?.contactNumbers?.map((x, index) => (
                <div key={`phone-${index}`}>{callRender(PHONE, x)}</div>
              ))}
            </div>
          ),
        },
        {
          label: 'Fax',
          value: contactDetails?.faxNumbers?.length && (
            <div>
              {contactDetails?.faxNumbers?.map((x, index) => (
                <div key={`fax-${index}`}>{callRender(FAX, x)}</div>
              ))}
            </div>
          ),
        },
        {
          label: 'Website',
          value: contactDetails?.websites?.length && (
            <div>
              {contactDetails?.websites?.map((x, index) => (
                <div key={`external-link-${index}`}>{callRender(EXTERNAL_LINK, x)}</div>
              ))}
            </div>
          ),
        },
        {
          label: 'Address',
          value: contactDetails?.addresses?.length && (
            <div>
              {contactDetails?.addresses?.map((x, index) => (
                <div key={`address-${index}`}>{callRender(ADDRESS, x)}</div>
              ))}
            </div>
          ),
        },
        {
          label: 'Tags',
          value: contactDetails?.tags?.length && (
            <TagList>
              {contactDetails?.tags?.map((x) => (
                <KeyValueTag key={x.key} tag={x} />
              ))}
            </TagList>
          ),
        },
      ]}
    />
  );
}
