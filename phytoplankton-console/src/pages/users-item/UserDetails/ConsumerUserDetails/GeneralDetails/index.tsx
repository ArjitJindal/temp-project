import React from 'react';
import { uniqBy } from 'lodash';
import PlaceOfBirth from 'src/pages/users-item/UserDetails/shared/PlaceOfBirth';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import styles from './index.module.less';
import { InternalConsumerUser } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs, DEFAULT_DATE_FORMAT } from '@/utils/dayjs';
import CountryDisplay from '@/components/ui/CountryDisplay';
import TagList from '@/components/library/Tag/TagList';
import Tag from '@/components/library/Tag';
import GenericConstantTag from '@/components/library/Tag/GenericConstantTag';
import Money from '@/components/ui/Money';
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
          label: 'Created at',
          value: dayjs(user.createdTimestamp).format(DATE_TIME_FORMAT_WITHOUT_SECONDS),
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
        ...(user.expectedIncome
          ? Object.entries(user.expectedIncome)
              .filter(([_key, value]) => value != null)
              .map(([key, value]) => ({
                label: humanizeAuto(key),
                value: value ? <Money amount={value} /> : '-',
              }))
          : []),
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
          label: 'PEP Status',
          value: uniqBy(
            user.pepStatus?.filter((pep) => pep.isPepHit != null),
            'pepCountry',
          ).map((pepCountry) => (
            <div className={styles.pepStatus}>
              <CountryDisplay key={pepCountry.pepCountry} isoCode={pepCountry.pepCountry} />
              <div>{pepCountry.isPepHit ? '(Yes)' : '(No)'}</div>
            </div>
          )),
        },
      ]}
    />
  );
}
