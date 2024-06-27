import { UseMutationResult } from '@tanstack/react-query';
import cn from 'clsx';
import s from './index.module.less';
import { isLoading } from '@/utils/asyncResource';
import {
  QuestionResponse,
  QuestionResponseSkeleton,
} from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/types';
import { SearchBar as AiForensicsSearchBar } from '@/components/AiForensics/SearchBar';
import { getMutationAsyncResource } from '@/utils/queries/mutations/helpers';

export type FormValues = {
  searchString: string;
};

interface Props {
  mutation: UseMutationResult<unknown, unknown, FormValues[]>;
  history: (QuestionResponse | QuestionResponseSkeleton)[];
  alertId: string;
}

export default function RequestForm(props: Props) {
  const { mutation, history, alertId } = props;

  const mutationRes = getMutationAsyncResource(mutation);
  return (
    <div className={cn(s.root, isLoading(mutationRes) && s.isLoading)}>
      <AiForensicsSearchBar searchMutation={mutation} alertId={alertId} history={history} />
    </div>
  );
}

export function randomSubset<T>(variants: T[], limit: number): T[] {
  const shuffled = [...variants];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, limit);
}
