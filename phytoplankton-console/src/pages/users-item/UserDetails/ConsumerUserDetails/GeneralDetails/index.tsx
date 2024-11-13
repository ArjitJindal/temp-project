import React, { useState } from 'react';
import PlaceOfBirth from 'src/pages/users-item/UserDetails/shared/PlaceOfBirth';
import { PepStatusLabel, PepStatusValue } from './PepStatus';
import { InternalConsumerUser, PEPStatus } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs, DEFAULT_DATE_FORMAT } from '@/utils/dayjs';
import CountryDisplay from '@/components/ui/CountryDisplay';
import TagList from '@/components/library/Tag/TagList';
import Tag from '@/components/library/Tag';
import GenericConstantTag from '@/components/library/Tag/GenericConstantTag';
interface Props {
  user: InternalConsumerUser;
}

const GENDER_MAP = {
  M: 'Male',
  F: 'Female',
  NB: 'Non-binary',
};

export default function GeneralDetails(props: Props) {
  const { user } = props;
  const [pepStatus, setPepStatus] = useState<PEPStatus[]>(user.pepStatus ?? []);
  return (
    <EntityPropertiesCard
      title={'General details'}
      items={[
        {
          label: 'DOB',
          value: user.userDetails?.dateOfBirth
            ? dayjs(user.userDetails?.dateOfBirth).format(DEFAULT_DATE_FORMAT)
            : '-',
        },
        {
          label: 'Nationality',
          value: <CountryDisplay isoCode={user.userDetails?.countryOfNationality} />,
        },
        {
          label: 'Residence',
          value: <CountryDisplay isoCode={user.userDetails?.countryOfResidence} />,
        },
        {
          label: 'Tax residence',
          value: <CountryDisplay isoCode={user.userDetails?.countryOfTaxResidence} />,
        },
        {
          label: 'Created at',
          value: dayjs(user.createdTimestamp).format(DATE_TIME_FORMAT_WITHOUT_SECONDS),
        },
        {
          label: 'Activated at',
          value: user.activatedTimestamp
            ? dayjs(user.activatedTimestamp).format(DATE_TIME_FORMAT_WITHOUT_SECONDS)
            : '-',
        },
        {
          label: 'Marital status',
          value: <GenericConstantTag>{user.userDetails?.maritalStatus}</GenericConstantTag>,
        },
        {
          label: 'Gender',
          value: user.userDetails?.gender ? GENDER_MAP[user.userDetails?.gender] : '-',
        },
        {
          label: 'Place of birth',
          value: user.userDetails?.placeOfBirth ? <PlaceOfBirth user={user} /> : '-',
        },
        { label: 'Occupation', value: user?.occupation },
        {
          label: 'Consumer segment',
          value: <GenericConstantTag>{user.userSegment}</GenericConstantTag>,
        },
        {
          label: 'User category',
          value: user.userDetails?.userCategory ?? '-',
        },
        {
          label: 'Acquisition channel',
          value: <GenericConstantTag>{user.acquisitionChannel}</GenericConstantTag>,
        },
        {
          label: 'Employment status',
          value: user.employmentStatus ?? '-',
        },
        { label: 'Sector', value: user?.employmentDetails?.employmentSector },
        { label: 'Industry', value: user?.employmentDetails?.businessIndustry },
        { label: 'Employer', value: user?.employmentDetails?.employerName },
        {
          label: 'Reason for opening account',
          value: (
            <TagList>
              {user.reasonForAccountOpening?.map((reason) => (
                <Tag key={reason}>{reason}</Tag>
              ))}
            </TagList>
          ),
        },
        {
          label: 'Source of funds',
          value: (
            <TagList>
              {user.sourceOfFunds?.map((source) => (
                <Tag key={source}>{source}</Tag>
              ))}
            </TagList>
          ),
        },
        {
          label: 'Alias',
          value: user.userDetails?.alias,
        },
        {
          label: (
            <PepStatusLabel
              userId={user.userId}
              pepStatus={user.pepStatus ?? []}
              updatePepStatus={setPepStatus}
            />
          ),
          value: <PepStatusValue pepStatus={pepStatus} />,
        },
      ]}
    />
  );
}
