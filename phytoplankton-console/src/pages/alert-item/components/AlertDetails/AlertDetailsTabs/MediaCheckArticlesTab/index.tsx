import { useMemo, useState } from 'react';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import uniq from 'lodash/uniq';
import SanctionDetailSelect from '../SanctionDetailSelect';
import { ArticleContentDrawer } from './ArticleContentDrawer';
import { MediaCheckArticleResponseItem, SanctionsDetails } from '@/apis';
import { Alert } from '@/apis/models/Alert';
import { useMediaCheckArticles } from '@/utils/api/alerts';
import { AllParams } from '@/components/library/Table/types';
import { DEFAULT_PAGINATION_VIEW, DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { STRING } from '@/components/library/Table/standardDataTypes';
import Id from '@/components/ui/Id';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import { CursorPaginationParams } from '@/utils/queries/hooks';
import Drawer from '@/components/library/Drawer';

interface Props {
  alert: Alert;
}

export const MediaCheckArticlesTab = (props: Props) => {
  const { alert } = props;
  const sanctionDetails = alert?.ruleHitMeta?.sanctionsDetails ?? [];
  const [selectedItem, setSelectedItem] = useState<SanctionsDetails | undefined>(
    sanctionDetails[0],
  );
  const [selectedArticleId, setSelectedArticleId] = useState<string | undefined>(undefined);
  const [params, onChangeParams] = useState<AllParams<CursorPaginationParams>>({
    ...DEFAULT_PARAMS_STATE,
    from: undefined,
    view: DEFAULT_PAGINATION_VIEW,
  });
  const mediaCheckArticles = useMediaCheckArticles(selectedItem?.searchId, params);
  const columns = useMemo(() => {
    const helper = new ColumnHelper<MediaCheckArticleResponseItem>();
    return [
      helper.simple<'id'>({
        title: 'Article ID',
        key: 'id',
        defaultWidth: 300,
        type: {
          ...STRING,
          render: (value, context) => {
            return (
              <Id
                onClick={() => {
                  setSelectedArticleId(context.item.lsegArticleId);
                }}
              >
                {value ?? '-'}
              </Id>
            );
          },
        },
      }),
      helper.simple<'articleSummary.contentType'>({
        title: 'Content Type',
        key: 'articleSummary.contentType',
        type: {
          ...STRING,
          render: (value) => {
            return <span>{value ? humanizeAuto(value) : '-'}</span>;
          },
        },
      }),
      helper.simple<'articleSummary.publication.name'>({
        title: 'Publication',
        key: 'articleSummary.publication.name',
        type: {
          ...STRING,
          render: (value) => {
            return <span>{value}</span>;
          },
        },
      }),
      helper.simple<'articleSummary.publication.countries'>({
        title: 'Publication countries',
        key: 'articleSummary.publication.countries',
        type: {
          render: (value) => {
            return (
              <div>
                {uniq(value)?.map((country) => (
                  <CountryDisplay key={country} countryName={country} />
                ))}
              </div>
            );
          },
        },
      }),
      helper.simple<'articleSummary.publicationDate'>({
        title: 'Publication date',
        key: 'articleSummary.publicationDate',
        type: {
          ...STRING,
          render: (value) => {
            return <span>{dayjs(value).format(DEFAULT_DATE_TIME_FORMAT)}</span>;
          },
        },
      }),
    ];
  }, []);
  return (
    <>
      {selectedItem && (
        <SanctionDetailSelect
          sanctionDetails={sanctionDetails}
          selectedItem={selectedItem}
          setSelectedItem={setSelectedItem}
        />
      )}
      <QueryResultsTable
        tableId="media-check-articles"
        queryResults={mediaCheckArticles}
        columns={columns}
        rowKey="lsegArticleId"
        pagination={true}
        params={params}
        onChangeParams={onChangeParams}
        hideFilters={true}
        externalHeader={false}
        toolsOptions={false}
        cursor={mediaCheckArticles.cursor}
      />
      <Drawer
        isVisible={!!selectedArticleId}
        onChangeVisibility={() => setSelectedArticleId(undefined)}
        title="Article Content"
      >
        <ArticleContentDrawer articleId={selectedArticleId} queryResult={mediaCheckArticles} />
      </Drawer>
    </>
  );
};
