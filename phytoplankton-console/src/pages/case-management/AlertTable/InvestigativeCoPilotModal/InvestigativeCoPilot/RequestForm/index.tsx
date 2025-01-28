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
  isLoading: boolean;
}

export default function RequestForm(props: Props) {
  const { mutation, history, alertId } = props;

  const mutationRes = getMutationAsyncResource(mutation);
  return (
    <div className={cn(s.root, props.isLoading && isLoading(mutationRes) && s.isLoading)}>
      <AiForensicsSearchBar searchMutation={mutation} alertId={alertId} history={history} />
    </div>
  );
}
