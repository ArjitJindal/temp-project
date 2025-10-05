import { useParams } from 'react-router';
import { RuleInstanceInfo } from './RuleInstanceInfo';
import Breadcrumbs from '@/components/library/Breadcrumbs';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useRuleInstance } from '@/hooks/api/rules';
import { makeUrl } from '@/utils/routing';
import PageWrapper from '@/components/PageWrapper';

export const RuleInstancePage = () => {
  const { id: ruleInstanceId } = useParams<{ id: string }>();
  const ruleInstanceResult = useRuleInstance(ruleInstanceId);
  return (
    <PageWrapper
      header={
        <Breadcrumbs
          items={[
            { title: 'Rules', to: '/rules/my-rules' },
            { title: 'My rules', to: '/rules/my-rules' },
            ...(ruleInstanceId
              ? [
                  {
                    title: ruleInstanceId,
                    to: makeUrl('/rules/my-rules/:id', {
                      id: ruleInstanceId,
                    }),
                  },
                ]
              : []),
          ]}
        />
      }
    >
      <AsyncResourceRenderer resource={ruleInstanceResult.data}>
        {(ruleInstance) => <RuleInstanceInfo ruleInstance={ruleInstance} />}
      </AsyncResourceRenderer>
    </PageWrapper>
  );
};

export default RuleInstancePage;
