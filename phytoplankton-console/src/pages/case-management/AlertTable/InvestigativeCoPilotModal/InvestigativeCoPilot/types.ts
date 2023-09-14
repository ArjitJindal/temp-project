import * as Api from '@/apis';

export type QuestionResponseBase = Pick<Api.QuestionResponse, 'questionId'>;

export interface QuestionResponseTable extends QuestionResponseBase, Api.Table {
  questionType: 'TABLE';
}

export interface QuestionResponseTimeseries extends QuestionResponseBase, Api.Timeseries {
  questionType: 'TIME_SERIES';
}

export interface QuestionResponseStackedBarchart extends QuestionResponseBase, Api.StackedBarchart {
  questionType: 'STACKED_BARCHART';
}

export type QuestionResponse =
  | QuestionResponseTable
  | QuestionResponseTimeseries
  | QuestionResponseStackedBarchart;

export function parseQuestionResponse(response: Api.QuestionResponse): QuestionResponse {
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
  throw new Error(`Not able to parse response`);
}
