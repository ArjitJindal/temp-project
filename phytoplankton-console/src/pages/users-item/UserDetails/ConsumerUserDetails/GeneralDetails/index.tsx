import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import s from './index.module.less';
import { InternalConsumerUser } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs, DEFAULT_DATE_FORMAT } from '@/utils/dayjs';
import CountryDisplay from '@/components/ui/CountryDisplay';
import TagList from '@/components/library/Tag/TagList';
import Tag from '@/components/library/Tag';
import GenericConstantTag from '@/components/library/Tag/GenericConstantTag';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useApi } from '@/api';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import CheckMark from '@/components/ui/icons/Remix/system/checkbox-circle-fill.react.svg';
import { useQuery } from '@/utils/queries/hooks';

interface Props {
  user: InternalConsumerUser;
  columns?: number;
}

const GENDER_MAP = {
  M: 'Male',
  F: 'Female',
  NB: 'Non-binary',
};

export default function GeneralDetails(props: Props) {
  const { user, columns = 1 } = props;
  const settings = useSettings();
  const api = useApi();
  const ongoingSanctionsScreeningQueryResult = useQuery(['user-status', user.userId], async () => {
    return await api.getUserScreeningStatus({
      userId: user.userId,
    });
  });
  return (
    <EntityPropertiesCard
      title={'General details'}
      columns={columns}
      items={[
        {
          label: 'DOB',
          value: user.userDetails?.dateOfBirth
            ? `${dayjs(user.userDetails.dateOfBirth).format(DEFAULT_DATE_FORMAT)} (${dayjs().diff(
                dayjs(user.userDetails.dateOfBirth),
                'year',
              )} years)`
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
        { label: 'Occupation', value: user?.occupation },
        {
          label: 'Consumer segment',
          value: <GenericConstantTag>{user.userSegment}</GenericConstantTag>,
        },
        {
          label: `${firstLetterUpper(settings.userAlias)} category`,
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
          label: 'Ongoing screening',
          value: (
            <div className={s.ongoingSanctions}>
              <AsyncResourceRenderer resource={ongoingSanctionsScreeningQueryResult.data}>
                {({ isOngoingScreening }) =>
                  isOngoingScreening ? (
                    <>
                      <CheckMark className={s.successIcon} /> Yes
                    </>
                  ) : (
                    <>No</>
                  )
                }
              </AsyncResourceRenderer>
            </div>
          ),
        },
      ]}
    />
  );
}
