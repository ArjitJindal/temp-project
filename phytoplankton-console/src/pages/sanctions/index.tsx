import { useNavigate, useParams } from 'react-router';
import { SanctionsSearchTable } from './search';
import { SanctionsSearchHistoryTable } from './search-history';
import { SanctionsScreeningActivity } from './activity';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import PageTabs from '@/components/ui/PageTabs';
import { useI18n } from '@/locales';

const SanctionsPage: React.FC = () => {
  const { type = 'search' } = useParams<'type'>();
  const { searchId } = useParams<'searchId'>();
  const navigate = useNavigate();
  const i18n = useI18n();
  return (
    <PageWrapper title={i18n('menu.sanctions')}>
      <PageTabs
        activeKey={type}
        onChange={(key) => {
          navigate(`/sanctions/${key}`, { replace: true });
        }}
        items={[
          {
            key: 'search',
            title: 'Search',
            children: (
              <PageWrapperContentContainer>
                <SanctionsSearchTable searchId={searchId} />
              </PageWrapperContentContainer>
            ),
          },
          {
            key: 'search-history',
            title: 'Search history',
            children: (
              <PageWrapperContentContainer>
                <SanctionsSearchHistoryTable />
              </PageWrapperContentContainer>
            ),
          },
          {
            key: 'activity',
            title: 'Activity',
            children: (
              <PageWrapperContentContainer>
                <SanctionsScreeningActivity />
              </PageWrapperContentContainer>
            ),
          },
        ]}
      />
    </PageWrapper>
  );
};

export default SanctionsPage;
