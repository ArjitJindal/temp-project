import { useNavigate, useParams } from 'react-router';
import { useEffect, useState } from 'react';
import { useLocalStorageState } from 'ahooks';
import { SearchResultTable } from './search';
import { SanctionsSearchHistoryTable } from './search-history';
import { SanctionsScreeningActivity } from './activity';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import PageTabs from '@/components/ui/PageTabs';
import { useI18n } from '@/locales';
import SegmentedControl from '@/components/library/SegmentedControl';
import WhitelistTab from '@/pages/sanctions/whitelist';

export type SanctionsType = 'manual' | 'rule';

const SanctionsPage: React.FC = () => {
  const { type = 'search' } = useParams<'type'>();
  const { searchId } = useParams<'searchId'>();
  const navigate = useNavigate();
  const i18n = useI18n();
  const [storedActiveType, setStoredActiveType] = useLocalStorageState<SanctionsType>(
    'sanctions-active-type',
    'rule',
  );
  const [activeType, setActiveType] = useState<SanctionsType>(storedActiveType || 'rule');

  useEffect(() => {
    setStoredActiveType(activeType);
  }, [activeType, setStoredActiveType]);

  return (
    <PageWrapper title={i18n('menu.sanctions')}>
      <PageTabs
        activeKey={type}
        onChange={(key) => {
          navigate(`/screening/${key}`);
        }}
        items={[
          {
            key: 'search',
            title: 'Search',
            children: (
              <PageWrapperContentContainer>
                <SearchResultTable searchId={searchId} />
              </PageWrapperContentContainer>
            ),
          },
          {
            key: 'activity',
            title: 'Activity',
            children: (
              <PageWrapperContentContainer>
                <SegmentedControl<SanctionsType>
                  items={[
                    { label: 'Rule', value: 'rule' },
                    { label: 'Manual', value: 'manual' },
                  ]}
                  active={activeType}
                  onChange={setActiveType}
                />
                {activeType === 'rule' && <SanctionsScreeningActivity />}
                {activeType === 'manual' && <SanctionsSearchHistoryTable />}
              </PageWrapperContentContainer>
            ),
          },
          {
            key: 'whitelist',
            title: 'Whitelist',
            children: (
              <PageWrapperContentContainer>
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
