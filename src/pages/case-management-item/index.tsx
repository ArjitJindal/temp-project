import { useCallback, useContext, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import _ from 'lodash';
import Header from './components/Header';
import { Case } from '@/apis';
import { useApi } from '@/api';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { makeUrl } from '@/utils/routing';
import * as Card from '@/components/ui/Card';
import { useBackUrl } from '@/utils/backUrl';
import { useQuery } from '@/utils/queries/hooks';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { CASES_ITEM } from '@/utils/queries/keys';
import TransactionCaseDetails from '@/pages/case-management-item/TransactionCaseDetails';
import UserCaseDetails from '@/pages/case-management-item/UserCaseDetails';
import Button from '@/components/ui/Button';
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

  const handleCaseUpdate = (caseItem: Case) => {
    queryClient.setQueryData(CASES_ITEM(caseId), caseItem);
  };

  const onReload = () => {
    queryResults.refetch();
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
    <Card.Root>
      <AsyncResourceRenderer resource={queryResults.data}>
        {(caseItem) => (
          <>
            <Card.Section>
              <Header caseItem={caseItem} onReload={onReload} showCloseButton={false} />
            </Card.Section>
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
                type={'text'}
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
              {caseItem.caseType === 'TRANSACTION' && (
                <TransactionCaseDetails
                  caseItem={caseItem}
                  onCaseUpdate={handleCaseUpdate}
                  onReload={onReload}
                  updateCollapseState={updateCollapseState}
                />
              )}

              {caseItem.caseType === 'USER' && (
                <UserCaseDetails
                  caseItem={caseItem}
                  onCaseUpdate={handleCaseUpdate}
                  updateCollapseState={updateCollapseState}
                  onReload={onReload}
                />
              )}
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
