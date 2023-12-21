import s from './index.module.less';
import { KpiCard } from './KpiCard';
import { useApi } from '@/api';
import { SANCTIONS_SCREENING_STATS } from '@/utils/queries/keys';
import { useQuery } from '@/utils/queries/hooks';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
export const Activity = () => {
  const api = useApi();
  const result = useQuery(SANCTIONS_SCREENING_STATS(), () => {
    return api.getSanctionsScreeningStats();
  });
  return (
    <AsyncResourceRenderer resource={result.data}>
      {({ bank, user, counterPartyUser, iban }) => {
        return (
          <div className={s.root}>
            <KpiCard data={user} title="Users" className={s['user']} />
            <KpiCard data={bank} title="Bank names" className={s['bank']} />
            <KpiCard data={iban} title="IBAN's" className={s['iban']} />
            <KpiCard
              data={counterPartyUser}
              title="Transaction counter party users"
              className={s['counterPartyUser']}
            />
          </div>
        );
      }}
    </AsyncResourceRenderer>
  );
};
