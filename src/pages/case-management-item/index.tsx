import { useCallback, useContext, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import _ from 'lodash';
import Header from './components/Header';
import { Case, Comment } from '@/apis';
import { useApi } from '@/api';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { makeUrl } from '@/utils/routing';
import * as Card from '@/components/ui/Card';
import { useBackUrl } from '@/utils/backUrl';
import { useQuery } from '@/utils/queries/hooks';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { ALERT_LIST, CASES_ITEM } from '@/utils/queries/keys';
import CaseDetails from '@/pages/case-management-item/CaseDetails';
import Button from '@/components/library/Button';
import COLORS from '@/components/ui/colors';
import PrintButton from '@/components/ui/PrintButton';
import {
  ExpandableContext,
  ExpandableProvider,
} from '@/components/AppWrapper/Providers/ExpandableProvider';
import { useApiTime, usePageViewTracker } from '@/utils/tracker';
import { useCloseSidebarByDefault } from '@/components/AppWrapper/Providers/SidebarProvider';

function CaseManagementItemPage() {
  const { id: caseId } = useParams<'id'>() as { id: string };
  const api = useApi();
  const measure = useApiTime();
  const queryClient = useQueryClient();
  usePageViewTracker('Single Case Management Item Page');
  useCloseSidebarByDefault();

  const queryResults = useQuery(
    CASES_ITEM(caseId),
    (): Promise<Case> =>
      measure(
        () =>
          api.getCase({
            caseId,
          }),
        'Get Case Details',
      ),
  );

  const handleCommentAdded = (newComment: Comment) => {
    queryClient.setQueryData<Case>(CASES_ITEM(caseId), (caseItem) => {
      if (caseItem == null) {
        return caseItem;
      }
      return {
        ...caseItem,
        comments: [...(caseItem?.comments ?? []), newComment],
      };
    });
  };

  const onReload = () => {
    queryResults.refetch();
    queryClient.invalidateQueries({ queryKey: ALERT_LIST() });
  };

  const [collapseState, setCollapseState] = useState<Record<string, boolean>>({});

  const isAllCollapsed = useMemo(() => {
    return _.every(collapseState, (value) => value);
  }, [collapseState]);

  const expandableContext = useContext(ExpandableContext);
  const updateCollapseState = useCallback(
    (key: string, value: boolean) => {
      expandableContext.setExpandMode('MANUAL');
      setCollapseState((prevState) => ({
        ...prevState,
        [key]: value,
      }));
    },
    [expandableContext],
  );

  return (
    <Card.Root collapsable={false}>
      <AsyncResourceRenderer resource={queryResults.data}>
        {(caseItem) => (
          <>
            <Header caseItem={caseItem} onReload={onReload} onCommentAdded={handleCommentAdded} />
            <div
              className="hide-on-print"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
              }}
            >
              <Button
                type={'TEXT'}
                onClick={() =>
                  expandableContext.setExpandMode(isAllCollapsed ? 'EXPAND_ALL' : 'COLLAPSE_ALL')
                }
                analyticsName={'case-management-item-expand-button'}
                style={{
                  width: 'max-content',
                  margin: '1rem 1.5rem',
                  color: COLORS.lightBlue.base,
                  borderColor: COLORS.lightBlue.base,
                }}
              >
                {isAllCollapsed ? 'Expand all' : 'Collapse all'}
              </Button>
              <PrintButton onClickAction={() => expandableContext.setExpandMode('EXPAND_ALL')} />
            </div>
            <Card.Section>
              <CaseDetails
                caseItem={caseItem}
                updateCollapseState={updateCollapseState}
                onReload={onReload}
              />
            </Card.Section>
          </>
        )}
      </AsyncResourceRenderer>
    </Card.Root>
  );
}

export default function CaseManagementItemPageWrapper() {
  const i18n = useI18n();
  const backUrl = useBackUrl();
  return (
    <PageWrapper
      backButton={{
        title: i18n('menu.case-management.item.back-button'),
        url: backUrl ?? makeUrl('/case-management'),
      }}
    >
      <ExpandableProvider>
        <CaseManagementItemPage />
      </ExpandableProvider>
    </PageWrapper>
  );
}
