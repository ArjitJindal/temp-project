import React from 'react';
import { QuestionResponseProperties } from '../../../types';
import s from './index.module.less';
import * as Form from '@/components/ui/Form';
import * as Card from '@/components/ui/Card';

interface Props {
  item: QuestionResponseProperties;
}

export default function HistoryItemProperties({ item }: Props) {
  return (
    <Card.Section>
      {(!item.properties || item.properties.length === 0) && (
        <div className={s.noData}>No data available.</div>
      )}
      {item.properties && item.properties?.length > 0 && (
        <div className={s.table}>
          {item.properties?.map((property) => (
            <>
              <Form.Layout.Label title={property.key || ''} />
              <div>{property.value || '-'}</div>
            </>
          ))}
        </div>
      )}
    </Card.Section>
  );
}
