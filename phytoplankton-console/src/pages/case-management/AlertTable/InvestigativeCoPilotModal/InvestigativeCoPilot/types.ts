import * as Api from '@/apis';

export type QuestionResponseBase = Pick<
  Api.QuestionResponse,
  | 'questionId'
  | 'variableOptions'
  | 'title'
  | 'createdById'
  | 'createdAt'
  | 'variables'
  | 'summary'
  | 'explained'
>;

export interface QuestionResponseTable extends QuestionResponseBase, Api.Table {
  questionType: 'TABLE';
}

export interface QuestionResponseTimeSeries extends QuestionResponseBase, Api.Timeseries {
  questionType: 'TIME_SERIES';
}

export interface QuestionResponseBarchart extends QuestionResponseBase, Api.Barchart {
  questionType: 'BARCHART';
}

export interface QuestionResponseProperties extends QuestionResponseBase, Api.Properties {
  questionType: 'PROPERTIES';
}

export interface QuestionResponseEmbedded extends QuestionResponseBase {
  questionType: 'EMBEDDED';
}

export interface QuestionResponseStackedBarchart extends QuestionResponseBase, Api.StackedBarchart {
  questionType: 'STACKED_BARCHART';
}

export interface QuestionResponseScreeningComparison
  extends QuestionResponseBase,
    Api.SanctionsHitComparison {
  questionType: 'SCREENING_COMPARISON';
}

export type QuestionResponseSkeleton = {
  questionType: 'SKELETON';
  requestId: string;
  requestString: string;
  error?: string;
};

export type QuestionResponse =
  | QuestionResponseTable
  | QuestionResponseTimeSeries
  | QuestionResponseStackedBarchart
  | QuestionResponseBarchart
  | QuestionResponseProperties
  | QuestionResponseEmbedded
  | QuestionResponseScreeningComparison;

export function parseQuestionResponse(responses: Api.GetQuestionsResponse): QuestionResponse[] {
  return (
    responses.data?.map((response) => {
      const { questionType, ...rest } = response;
      if (questionType === 'TABLE') {
        return {
          questionType: 'TABLE' as const,
          ...rest,
        };
      }
      if (questionType === 'TIME_SERIES') {
        return {
          questionType: 'TIME_SERIES' as const,
          ...rest,
        };
      }
      if (questionType === 'STACKED_BARCHART') {
        return {
          questionType: 'STACKED_BARCHART' as const,
          ...rest,
        };
      }
      if (questionType === 'PROPERTIES') {
        return {
          questionType: 'PROPERTIES' as const,
          ...rest,
        };
      }
      if (questionType === 'BARCHART') {
        return {
          questionType: 'BARCHART' as const,
          ...rest,
        };
      }
      if (questionType === 'EMBEDDED') {
        return {
          questionType: 'EMBEDDED' as const,
          ...rest,
        };
      }
      throw new Error(`Not able to parse response. Unsupported question type: "${questionType}"`);
    }) || []
  );
}
