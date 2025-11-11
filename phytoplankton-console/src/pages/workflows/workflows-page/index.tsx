import { useNavigate } from 'react-router';
import { useParams } from 'react-router-dom';
import Header from '../components/Header';
import WorkflowsList from './workflows-list';
import WorkflowsLibrary from './workflows-library';
import { makeUrl } from '@/utils/routing';
import PageTabs from '@/components/ui/PageTabs';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';

export default function WorkflowsPage() {
  const navigate = useNavigate();
  const { section = 'list' } = useParams<'section'>() as {
    section: 'list' | 'library';
  };
  return (
    <PageWrapper header={<Header section={section} />}>
      <PageTabs
        activeKey={section}
        onChange={(section: string) => {
          navigate(makeUrl(`/workflows/:section`, { section }), { replace: true });
        }}
        items={[
          {
            title: 'Active',
            key: 'list',
            children: (
              <PageWrapperContentContainer>
                <WorkflowsList />
              </PageWrapperContentContainer>
            ),
          },
          {
            title: 'Library',
            key: 'library',
            children: <WorkflowsLibrary />,
          },
        ]}
      />
    </PageWrapper>
  );
}
