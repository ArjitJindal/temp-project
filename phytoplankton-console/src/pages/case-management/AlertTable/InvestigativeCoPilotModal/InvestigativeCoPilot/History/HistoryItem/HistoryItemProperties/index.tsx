import React from 'react';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { COPILOT_QUESTIONS } from '@flagright/lib/utils/copilot';
import { QuestionResponseProperties } from '../../../types';
import s from './index.module.less';
import * as Form from '@/components/ui/Form';
import * as Card from '@/components/ui/Card';
import Money from '@/components/ui/Money';
import { isValidNumber } from '@/utils/number';

interface Props {
  item: QuestionResponseProperties;
}

export default function HistoryItemProperties({ item }: Props) {
  const showCurrency = item.questionId === COPILOT_QUESTIONS.TRANSACTION_INSIGHTS;
  let currency: string | undefined;
  if (showCurrency) {
    currency = item.variables?.find((variable) => variable.name === 'currency')?.value;
    if (currency) {
      currency = currency as string;
    }
  }
  return (
    <Card.Section>
      {(!item.properties || item.properties.length === 0) && (
        <div className={s.noData}>No data available.</div>
      )}
      {item.properties && item.properties?.length > 0 && (
        <div className={s.table}>
          {item.properties?.map((property) => (
            <React.Fragment key={property.key}>
              <Form.Layout.Label title={humanizeAuto(property.key || '')} />
              <div>
                {property.value ? (
                  showCurrency &&
                  currency &&
                  property.key?.includes('amount') &&
                  isValidNumber(property.value) ? (
                    <Money value={Number(property.value)} currency={currency} />
                  ) : (
                    property.value
                  )
                ) : (
                  '-'
                )}
              </div>
            </React.Fragment>
          ))}
        </div>
      )}
    </Card.Section>
  );
}
