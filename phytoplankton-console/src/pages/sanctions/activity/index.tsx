import { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import s from './index.module.less';
import { KpiCard } from './KpiCard';
import { useApi } from '@/api';
import { SANCTIONS_SCREENING_STATS } from '@/utils/queries/keys';
import { useQuery } from '@/utils/queries/hooks';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { dayjs, Dayjs } from '@/utils/dayjs';
import DatePicker from '@/components/ui/DatePicker';

const KPIS_LIVE_DATE = '2023-12-23'; // in format YYYY-MM-DD

export const Activity = () => {
  const api = useApi();
  const [dateRange, setDateRange] = useState<RangeValue<Dayjs>>([dayjs(KPIS_LIVE_DATE), dayjs()]);

  const result = useQuery(SANCTIONS_SCREENING_STATS(dateRange), () => {
    return api.getSanctionsScreeningStats({
      afterTimestamp: dateRange?.[0]?.unix(),
      beforeTimestamp: dateRange?.[1]?.unix(),
    });
  });

  return (
    <div className={s.parent}>
      <div className={s.datePicker}>
        <DatePicker.RangePicker
          disabledDate={(current) => current < dayjs(KPIS_LIVE_DATE)}
          value={dateRange}
          onChange={setDateRange}
        />
      </div>
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
    </div>
  );
};
