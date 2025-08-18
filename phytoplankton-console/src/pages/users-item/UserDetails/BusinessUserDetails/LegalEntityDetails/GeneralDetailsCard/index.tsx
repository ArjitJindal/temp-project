import React from 'react';
import s from './index.module.less';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';
import { InternalBusinessUser } from '@/apis';
import CheckMark from '@/components/ui/icons/Remix/system/checkbox-circle-fill.react.svg';
import PaymentMethodTag from '@/components/library/Tag/PaymentTypeTag';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import Tag from '@/components/library/Tag';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import TagList from '@/components/library/Tag/TagList';
import GenericConstantTag from '@/components/library/Tag/GenericConstantTag';
import CountryDisplay from '@/components/ui/CountryDisplay';
interface Props {
  user: InternalBusinessUser;
}

export default function GeneralDetailsCard(props: Props) {
  const { user } = props;

  const api = useApi();
  const ongoingSanctionsScreeningQueryResult = useQuery(['user-status', user.userId], async () => {
    return await api.getUserScreeningStatus({
      userId: user.userId,
    });
  });

  return (
    <EntityPropertiesCard
      title={'General details'}
      items={[
        {
          label: 'Business industry',
          value: (
            <TagList>
              {user?.legalEntity?.companyGeneralDetails?.businessIndustry
                ? user?.legalEntity?.companyGeneralDetails?.businessIndustry.map((industry) => (
                    <Tag key={industry}>{industry}</Tag>
                  ))
                : '-'}
            </TagList>
          ),
        },
        {
          label: 'Main products and services',
          value: user?.legalEntity?.companyGeneralDetails?.mainProductsServicesSold ?? '-',
        },
        ...(user?.legalEntity?.reasonForAccountOpening?.length
          ? [
              {
                label: 'Reason for opening account',
                value: (
                  <TagList>
                    {user?.legalEntity?.reasonForAccountOpening.map((reason) => (
                      <Tag key={reason}>{reason}</Tag>
                    ))}
                  </TagList>
                ),
              },
            ]
          : []),
        ...(user?.legalEntity?.companyGeneralDetails?.alias?.length
          ? [
              {
                label: 'Alias',
                value: (
                  <TagList>
                    {user?.legalEntity?.companyGeneralDetails?.alias.map((alias) => (
                      <Tag key={alias}>{alias}</Tag>
                    ))}
                  </TagList>
                ),
              },
            ]
          : []),
        {
          label: 'Operating countries',
          value: (
            <TagList>
              {user?.legalEntity?.companyGeneralDetails?.operatingCountries?.length
                ? user?.legalEntity?.companyGeneralDetails?.operatingCountries?.map((country) => (
                    <CountryDisplay key={country} isoCode={country} />
                  ))
                : '-'}
            </TagList>
          ),
        },
        ...(user?.legalEntity?.sourceOfFunds?.length
          ? [
              {
                label: 'Source of funds',
                value: (
                  <TagList>
                    {user?.legalEntity?.sourceOfFunds.map((source) => (
                      <Tag key={source}>{source}</Tag>
                    ))}
                  </TagList>
                ),
              },
            ]
          : []),
        {
          label: 'Allowed payment methods',
          value: (
            <TagList>
              {user.allowedPaymentMethods
                ? user.allowedPaymentMethods.map((paymentMethod) => {
                    return (
                      <PaymentMethodTag
                        paymentMethod={paymentMethod}
                        key={paymentMethod}
                      ></PaymentMethodTag>
                    );
                  })
                : '-'}
            </TagList>
          ),
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
        {
          label: 'Acquisition channel',
          value: <GenericConstantTag>{user.acquisitionChannel}</GenericConstantTag>,
        },
      ]}
    />
  );
}
