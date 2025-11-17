import React from 'react';
import { CompanyFinancialDetails, Tag as ApiTag } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import Tag from '@/components/library/Tag';
import TagList from '@/components/library/Tag/TagList';

interface Props {
  financialDetails: CompanyFinancialDetails;
}

export default function FinancialDetails(props: Props) {
  const { financialDetails } = props;

  return (
    <EntityPropertiesCard
      title={'Company financial details'}
      items={[
        {
          label: 'Expected total transaction volume per month',
          value: financialDetails?.expectedTransactionAmountPerMonth ? (
            <div>
              {financialDetails.expectedTransactionAmountPerMonth.amountValue?.toLocaleString()}{' '}
              {financialDetails.expectedTransactionAmountPerMonth.amountCurrency}
            </div>
          ) : (
            '-'
          ),
        },
        {
          label: 'Expected revenue per month',
          value: financialDetails?.expectedTurnoverPerMonth ? (
            <span>
              {financialDetails.expectedTurnoverPerMonth.amountValue?.toLocaleString()}{' '}
              {financialDetails.expectedTurnoverPerMonth.amountCurrency}
            </span>
          ) : (
            '-'
          ),
        },
        {
          label: 'Tags',
          value: financialDetails?.tags?.length ? (
            <TagList>
              {financialDetails.tags.map(({ key, value }: ApiTag) => (
                <Tag key={key} color={'cyan'}>
                  {key}: <span style={{ fontWeight: 700 }}>{value}</span>
                </Tag>
              ))}
            </TagList>
          ) : (
            '-'
          ),
        },
      ]}
    />
  );
}
