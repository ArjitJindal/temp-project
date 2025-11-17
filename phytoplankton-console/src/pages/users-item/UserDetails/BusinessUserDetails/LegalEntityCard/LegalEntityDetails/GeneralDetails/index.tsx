import React from 'react';
import { CompanyGeneralDetails } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import TagList from '@/components/library/Tag/TagList';
import Tag from '@/components/library/Tag';
import CountryDisplay from '@/components/ui/CountryDisplay';

interface Props {
  generalDetails: CompanyGeneralDetails;
}

export default function GeneralDetails(props: Props) {
  const { generalDetails } = props;
  return (
    <EntityPropertiesCard
      title={'General details'}
      items={[
        {
          label: 'Legal name',
          value: generalDetails?.legalName ?? '-',
        },
        {
          label: 'Business industry',
          value: (
            <TagList>
              {generalDetails?.businessIndustry?.length
                ? generalDetails.businessIndustry.map((industry) => (
                    <Tag key={industry}>{industry}</Tag>
                  ))
                : '-'}
            </TagList>
          ),
        },
        {
          label: 'Main products and services',
          value: (
            <TagList>
              {generalDetails?.mainProductsServicesSold?.length
                ? generalDetails.mainProductsServicesSold.map((product) => (
                    <Tag key={product}>{product}</Tag>
                  ))
                : '-'}
            </TagList>
          ),
        },
        ...(generalDetails?.alias?.length
          ? [
              {
                label: 'Alias',
                value: (
                  <TagList>
                    {generalDetails.alias.map((alias) => (
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
              {generalDetails?.operatingCountries?.length
                ? generalDetails.operatingCountries.map((country) => (
                    <CountryDisplay key={country} isoCode={country} />
                  ))
                : '-'}
            </TagList>
          ),
        },
      ]}
    />
  );
}
