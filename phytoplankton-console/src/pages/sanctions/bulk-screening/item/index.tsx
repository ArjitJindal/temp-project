import { useParams, useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import s from './index.module.less';
import DataValidationStep from './DataValidationStep';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import Breadcrumbs from '@/components/library/Breadcrumbs';
import StepButtons from '@/components/library/StepButtons';
import { P } from '@/components/ui/Typography';
import {
  useSanctionsBulkSearchItems,
  useSanctionsBulkSearchTermHistory,
} from '@/utils/api/screening';
import ScreeningHitTable, { TableSearchParams } from '@/components/ScreeningHitTable';
import { sanitizeFuzziness } from '@/components/ScreeningHitTable/utils';
import { AsyncResource, getOr, isSuccess } from '@/utils/asyncResource';
import { DEFAULT_PAGE_SIZE, DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { AllParams } from '@/components/library/Table/types';
import { map as mapQuery } from '@/utils/queries/types';
import EyeLineIcon from '@/components/ui/icons/Remix/system/eye-line.react.svg';
import { useApi } from '@/api';
import { FlatFileProgressResponse } from '@/apis';
import { FLAT_FILE_PROGRESS } from '@/utils/queries/keys';
import { useQuery } from '@/utils/queries/hooks';

export default function BulkScreeningItemPage() {
  const { searchTermId } = useParams<{ searchTermId: string }>();
  const navigate = useNavigate();
  const batchId = (searchTermId ?? '').split('.')[0] || undefined;
  const activeSearchTermId = searchTermId ?? (batchId ? `${batchId}.1` : undefined);
  const [params, setParams] = useState<AllParams<TableSearchParams>>({
    ...DEFAULT_PARAMS_STATE,
  });

  const progressRes = useProgressResource(batchId ?? '');

  const isProgressLoaded = isSuccess(progressRes);
  const isImportOngoing = isProgressLoaded
    ? progressRes.value?.status === 'PENDING' ||
      progressRes.value?.status === 'IN_PROGRESS' ||
      progressRes.value?.isValidationJobRunning
    : false;

  const enableDataQueries = !!batchId && isProgressLoaded && !isImportOngoing;

  const historyItemQueryResults = useSanctionsBulkSearchTermHistory(
    activeSearchTermId,
    { page: params.page, pageSize: params.pageSize },
    { enabled: enableDataQueries && !!activeSearchTermId },
  );
  const batchIndexQuery = useSanctionsBulkSearchItems({ batchId }, { enabled: enableDataQueries });

  const historyItem = getOr(historyItemQueryResults.data, null);
  useEffect(() => {
    if (historyItem?.request) {
      setParams((prev) => ({
        ...prev,
        fuzziness: sanitizeFuzziness(historyItem.request?.fuzziness, 'hundred'),
        entityType: historyItem.request?.entityType,
        types: historyItem.request?.types,
        screeningProfileId: historyItem.request?.screeningProfileId,
      }));
    }
  }, [historyItem]);

  const currentIndex = Number((activeSearchTermId ?? '').split('.')[1] || '1');
  const hasPrev = currentIndex > 1;
  const total = getOr(batchIndexQuery.data, { count: 0 } as any)?.count ?? 0;
  const hasNext = currentIndex < total;
  const goToIndex = (index: number) => {
    if (!batchId || index < 1) {
      return;
    }
    const targetId = `${batchId}.${index}`;
    navigate(`/screening/bulk-search/${targetId}`);
  };

  return (
    <PageWrapper
      header={
        <div className={s.pageHeader}>
          <Breadcrumbs
            items={[
              { title: 'Screening', to: '/screening/manual-screening' },
              { title: 'Manual screening', to: '/screening/manual-screening' },
              { title: 'Batch screening', to: '/screening/manual-screening' },
              { title: searchTermId ?? '', to: `/screening/bulk-search/${activeSearchTermId}` },
            ]}
          />
          <Link to="/screening/imports" className={s.history}>
            <EyeLineIcon className={s.icon} /> Import history
          </Link>
        </div>
      }
    >
      {isImportOngoing ? (
        <DataValidationStep progressRes={progressRes} />
      ) : (
        <PageWrapperContentContainer>
          <div className={s.pageContainerHeader}>
            <P bold>Search term : {historyItem?.request?.searchTerm}</P>
            <StepButtons
              prevDisabled={!hasPrev}
              nextDisabled={!hasNext}
              onPrevious={() => goToIndex(currentIndex - 1)}
              onNext={() => goToIndex(currentIndex + 1)}
            />
          </div>
          {activeSearchTermId && (
            <ScreeningHitTable
              readOnly
              params={params}
              onChangeParams={setParams}
              queryResult={mapQuery(historyItemQueryResults, (x) => ({
                items: x?.response?.data ?? [],
                total: x?.response?.hitsCount ?? 0,
                pageSize: x?.response?.pageSize ?? DEFAULT_PAGE_SIZE,
              }))}
              searchedAt={historyItem?.updatedAt ?? historyItem?.createdAt}
            />
          )}
        </PageWrapperContentContainer>
      )}
    </PageWrapper>
  );
}

/*
  Helpers
 */
function useProgressResource(batchId: string): AsyncResource<FlatFileProgressResponse> {
  const api = useApi();

  const ongoingImportsProgressQueryResult = useQuery(
    FLAT_FILE_PROGRESS(batchId),
    async () => {
      return await api.getFlatFilesProgress({
        schema: 'BULK_MANUAL_SCREENING',
        entityId: batchId,
      });
    },
    {
      refetchInterval: (progress) => {
        if (
          progress != null &&
          (progress.status === 'PENDING' || progress.status === 'IN_PROGRESS')
        ) {
          return 5000;
        }
        return 60000;
      },
      backgroundFetch: true,
    },
  );
  return ongoingImportsProgressQueryResult.data;
}
