import { useParams } from 'react-router';
import { RuleInstanceInfo } from './RuleInstanceInfo';
import s from './styles.module.less';
import { useApi } from '@/api';
import { RuleInstance } from '@/apis';
import Breadcrumbs from '@/components/library/Breadcrumbs';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useQuery } from '@/utils/queries/hooks';
import { GET_RULES_INSTANCE } from '@/utils/queries/keys';
import { makeUrl } from '@/utils/routing';
import PageWrapper from '@/components/PageWrapper';

export const RuleInstancePage = () => {
  const { id: ruleInstanceId } = useParams<{ id: string }>();
  const api = useApi();
  const ruleInstanceResult = useQuery<RuleInstance>(
    GET_RULES_INSTANCE(ruleInstanceId),
    async (_paginationParams) => {
      if (ruleInstanceId == null) {
        throw new Error(`ruleInstanceId can not be null`);
      }
      const ruleInstance = await api.getRuleInstancesItem({
        ruleInstanceId: ruleInstanceId,
      });
      return ruleInstance;
    },
  );
  return (
    <PageWrapper
      header={
        <div className={s.header}>
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
        </div>
      }
    >
      <AsyncResourceRenderer resource={ruleInstanceResult.data}>
        {(ruleInstance) => <RuleInstanceInfo ruleInstance={ruleInstance} />}
      </AsyncResourceRenderer>
    </PageWrapper>
  );
};

export default RuleInstancePage;
