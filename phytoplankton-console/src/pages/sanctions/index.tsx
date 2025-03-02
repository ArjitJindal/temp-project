import { useNavigate, useParams } from 'react-router';
import { useEffect, useState } from 'react';
import { useLocalStorageState } from 'ahooks';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { SearchResultTable } from './search';
import { SanctionsSearchHistoryTable } from './search-history';
import { SanctionsScreeningActivity } from './activity';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import PageTabs from '@/components/ui/PageTabs';
import SegmentedControl from '@/components/library/SegmentedControl';
import WhitelistTab from '@/pages/sanctions/whitelist';
import Breadcrumbs from '@/components/library/Breadcrumbs';
import { P } from '@/components/ui/Typography';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs } from '@/utils/dayjs';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';

import { AllParams } from '@/components/library/Table/types';
import { BooleanString, SanctionsScreeningEntity } from '@/apis';
export type SanctionsType = 'manual' | 'rule';
type TableSearchParams = AllParams<{
  entity?: SanctionsScreeningEntity[];
  isHit?: BooleanString;
  isOngoingScreening?: BooleanString;
  isNew?: BooleanString;
  name?: string;
  afterTimestamp?: number;
  beforeTimestamp?: number;
}>;
const DEFAULT_DATE_RANGE_PARAMS = {
  afterTimestamp: dayjs().subtract(1, 'month').valueOf(),
  beforeTimestamp: dayjs().add(1, 'hour').valueOf(),
};
const SanctionsPage: React.FC = () => {
  const { type = 'manual-screening' } = useParams<'type'>();
  const { searchId } = useParams<'searchId'>();
  const navigate = useNavigate();
  const [storedActiveType, setStoredActiveType] = useLocalStorageState<SanctionsType>(
    'sanctions-active-type',
    'rule',
  );
  const [activeType, setActiveType] = useState<SanctionsType>(storedActiveType || 'rule');

  useEffect(() => {
    setStoredActiveType(activeType);
  }, [activeType, setStoredActiveType]);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [params, setParams] = useState<TableSearchParams>({
    ...DEFAULT_PARAMS_STATE,
    ...DEFAULT_DATE_RANGE_PARAMS,
  });
  return (
    <PageWrapper
      header={
        <Breadcrumbs
          items={[
            { title: 'Screening', to: '/screening/manual-screening' },
            { title: humanizeAuto(type), to: `/screening/${type}` },
            ...(searchTerm
              ? [{ title: searchTerm, to: `/screening/manual-screening/${searchTerm}` }]
              : []),
          ]}
        />
      }
    >
      <PageTabs
        activeKey={type}
        onChange={(key) => {
          navigate(`/screening/${key}`);
        }}
        items={[
          {
            key: 'manual-screening',
            title: 'Manual screening',
            children: (
              <PageWrapperContentContainer>
                <P grey={true}>
                  Manually screen individuals or entities against Sanctions/PEP/AML lists and view
                  detailed match results.
                </P>
                <SearchResultTable searchId={searchId} setSearchTerm={setSearchTerm} />
              </PageWrapperContentContainer>
            ),
          },
          {
            key: 'activity',
            title: 'Activity',
            children: (
              <PageWrapperContentContainer>
                <P grey={true}>
                  View screening history and results from both rule-based and manual screening
                  activities.
                </P>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <SegmentedControl<SanctionsType>
                    items={[
                      { label: 'Rule', value: 'rule' },
                      { label: 'Manual', value: 'manual' },
                    ]}
                    active={activeType}
                    onChange={setActiveType}
                  />
                  {activeType === 'rule' && (
                    <DatePicker.RangePicker
                      value={[dayjs(params.afterTimestamp), dayjs(params.beforeTimestamp)]}
                      onChange={(range) => {
                        if (!range) {
                          setParams((prevState) => ({
                            ...prevState,
                            ...DEFAULT_DATE_RANGE_PARAMS,
                          }));
                        }
                        setParams((prevState) => ({
                          ...prevState,
                          afterTimestamp: range?.[0]?.valueOf(),
                          beforeTimestamp: range?.[1]?.valueOf(),
                        }));
                      }}
                    />
                  )}
                </div>
                {activeType === 'rule' && (
                  <SanctionsScreeningActivity params={params} setParams={setParams} />
                )}
                {activeType === 'manual' && <SanctionsSearchHistoryTable />}
              </PageWrapperContentContainer>
            ),
          },
          {
            key: 'whitelist',
            title: 'Whitelist',
            children: (
              <PageWrapperContentContainer>
                <P grey={true}>
                  Manage whitelisted entities that are excluded from screening hits.
                </P>
                <WhitelistTab />
              </PageWrapperContentContainer>
            ),
          },
        ]}
      />
    </PageWrapper>
  );
};

export default SanctionsPage;
