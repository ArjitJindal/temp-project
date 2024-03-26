import React from 'react';
import { COPILOT_QUESTIONS } from '@flagright/lib/utils';
import { QuestionResponseEmbedded } from '../../../types';
import { Recommendation } from './Recommendation';
import * as Card from '@/components/ui/Card';
import Linking from '@/pages/users-item/UserDetails/Linking';

interface Props {
  item: QuestionResponseEmbedded;
}

export default function HistoryItemEmbedded({ item }: Props) {
  const userId = item.variables?.find((v) => v.name === 'userId')?.value;
  const alertId = item.variables?.find((v) => v.name === 'alertId')?.value;

  return (
    <Card.Section key={JSON.stringify(item.variables)}>
      {item.questionId === COPILOT_QUESTIONS.ONTOLOGY && typeof userId === 'string' && (
        <div style={{ height: '400px' }}>
          <Linking userId={userId} />
        </div>
      )}
      {item.questionId === COPILOT_QUESTIONS.RECOMMENDATION && typeof alertId === 'string' && (
        <Recommendation alertId={alertId} />
      )}
    </Card.Section>
  );
}
