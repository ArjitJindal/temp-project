import React from 'react';
import { InternalConsumerUser } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';

interface Props {
  user: InternalConsumerUser;
  columns?: number;
}

export default function EmploymentDetails(props: Props) {
  const { user, columns = 1 } = props;

  return (
    <EntityPropertiesCard
      title={'Employment details'}
      columns={columns}
      items={[
        {
          label: 'Employment sector',
          value: user.employmentDetails?.employmentSector,
        },
        {
          label: 'Employer name',
          value: user.employmentDetails?.employerName,
        },
        {
          label: 'Business industry',
          value: user.employmentDetails?.businessIndustry,
        },
      ]}
    />
  );
}
