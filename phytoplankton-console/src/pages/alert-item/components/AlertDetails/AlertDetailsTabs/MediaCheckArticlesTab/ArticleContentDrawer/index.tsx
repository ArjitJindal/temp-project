import { Interweave } from 'interweave';
import s from './index.module.less';
import { MediaCheckArticleResponseItem } from '@/apis';
import { H3, P } from '@/components/ui/Typography';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { CursorPaginatedData } from '@/utils/queries/hooks';
import { QueryResult } from '@/utils/queries/types';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';

interface Props {
  articleId?: string;
  queryResult: QueryResult<CursorPaginatedData<MediaCheckArticleResponseItem>>;
}
export const ArticleContentDrawer = (props: Props) => {
  const { articleId, queryResult } = props;
  return (
    <AsyncResourceRenderer<CursorPaginatedData<MediaCheckArticleResponseItem>>
      resource={queryResult.data}
      children={(data) => {
        const article = data.items.find((item) => item.lsegArticleId === articleId);
        return (
          <div className={s.content}>
            <div className={s.titleContainer}>
              <H3 className={s.title}>{article?.articleSummary?.title}</H3>
              <div className={s.publicationContainer}>
                <P variant="s" grey>
                  {article?.articleSummary?.publication?.name}
                </P>
                <P variant="s" grey>
                  |
                </P>
                <P variant="s" grey>
                  {dayjs(article?.articleSummary?.publicationDate).format(DEFAULT_DATE_TIME_FORMAT)}
                </P>
              </div>
            </div>
            <div className={s.divider} />
            <P variant="s">
              <Interweave content={article?.articleContent?.content} />
            </P>
            <div className={s.divider} />
            <div className={s.copyrightContainer}>
              <span className={s.topicsContainer}>
                <P variant="s" bold className={s.topics}>
                  Article topics:{' '}
                  <P variant="s" grey>
                    {article?.articleSummary?.topics?.join(', ') ?? '-'}
                  </P>
                </P>
                <P variant="s" bold className={s.topics}>
                  Article phases:{' '}
                  <P variant="s" grey>
                    {article?.articleSummary?.phases?.join(', ') ?? '-'}
                  </P>
                </P>
                <P variant="s" bold className={s.topics}>
                  Article geographies:{' '}
                  <P variant="s" grey>
                    {article?.articleSummary?.geographies?.join(', ') ?? '-'}
                  </P>
                </P>
                <P variant="s" bold className={s.topics}>
                  Article copyright holder:{' '}
                  <P variant="s" grey>
                    {article?.articleContent?.copyrightHolder ?? '-'}
                  </P>
                </P>
                <P variant="s" bold className={s.topics}>
                  Article copyright notice:{' '}
                  <P variant="s" grey>
                    {article?.articleContent?.copyrightNotice ?? '-'}
                  </P>
                </P>
              </span>
            </div>
          </div>
        );
      }}
    />
  );
};
