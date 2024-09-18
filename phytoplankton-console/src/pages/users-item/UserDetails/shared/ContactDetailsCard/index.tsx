import React from 'react';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import { ContactDetails as ApiContactDetails } from '@/apis';
import { callRender } from '@/components/library/Table/dataTypeHelpers';
import { EMAIL, EXTERNAL_LINK, FAX, PHONE } from '@/components/library/Table/standardDataTypes';

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
          label: 'Email',
          value: contactDetails?.emailIds?.length && (
            <div>{contactDetails?.emailIds?.map((x) => callRender(EMAIL, x))}</div>
          ),
        },
        {
          label: 'Tel.',
          value: contactDetails?.contactNumbers?.length && (
            <div>{contactDetails?.contactNumbers?.map((x) => callRender(PHONE, x))}</div>
          ),
        },
        {
          label: 'Fax',
          value: contactDetails?.faxNumbers?.length && (
            <div>{contactDetails?.faxNumbers?.map((x) => callRender(FAX, x))}</div>
          ),
        },
        {
          label: 'Website',
          value: contactDetails?.websites?.length && (
            <div>{contactDetails?.websites?.map((x) => callRender(EXTERNAL_LINK, x))}</div>
          ),
        },
      ]}
    />
  );
}
