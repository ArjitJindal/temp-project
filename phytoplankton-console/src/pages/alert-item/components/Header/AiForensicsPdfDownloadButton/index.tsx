import React, { useCallback, useState, useRef, useMemo } from 'react';
import { COPILOT_QUESTIONS } from '@flagright/lib/utils';
import { usePreloadedHistory } from '../../AlertDetails/AlertDetailsTabs/AiForensicsTab/helpers';
import PdfQuestionResponseItem from './PdfQuestionResponseItem';
import s from './index.module.less';
import { useQuery } from '@/utils/queries/hooks';
import Button from '@/components/library/Button';
import DownloadAsPDF from '@/components/DownloadAsPdf/DownloadAsPDF';
import { message } from '@/components/library/Message';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useApi } from '@/api';
import { getOr } from '@/utils/asyncResource';
import { ALERT_ITEM, COPILOT_ALERT_QUESTIONS } from '@/utils/queries/keys';
import {
  parseQuestionResponse,
  QuestionResponse,
} from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/types';
import { getErrorMessage } from '@/utils/lang';

interface Props {
  alertId: string;
}

const groupIntoPages = (items: QuestionResponse[]): QuestionResponse[][] => {
  // Each question gets its own page to prevent overflow
  return items.map((item) => [item]);
};

const AiForensicsPdfDownloadButton: React.FC<Props> = ({ alertId }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);
  const api = useApi();

  const alertQueryResult = useQuery(ALERT_ITEM(alertId), async () => {
    const response = await api.getAlert({ alertId });
    return response;
  });

  const questionsQuery = useQuery(COPILOT_ALERT_QUESTIONS(alertId), async () =>
    parseQuestionResponse(await api.getQuestions({ alertId })),
  );

  const questions = getOr(questionsQuery.data, []);

  const alert = getOr(alertQueryResult.data, undefined);

  const preloadedHistory = usePreloadedHistory(alert || ({} as any), alert?.caseId || '');

  const allItems = useMemo(() => {
    return preloadedHistory ? [...preloadedHistory, ...questions] : questions;
  }, [preloadedHistory, questions]);

  const questionPages = useMemo(() => {
    const filteredItems = allItems.filter(
      (q) => 'questionId' in q && q.questionId !== COPILOT_QUESTIONS.ONTOLOGY,
    );
    return groupIntoPages(filteredItems as QuestionResponse[]);
  }, [allItems]);

  const isAiForensicsEnabled = useFeatureEnabled('AI_FORENSICS');
  const isClickhouseEnabled = useFeatureEnabled('CLICKHOUSE_ENABLED');

  const isEnabled = isAiForensicsEnabled && isClickhouseEnabled;

  const handleDownload = useCallback(async () => {
    if (!pdfRef.current || allItems.length === 0) {
      message.info('No AI Forensics content available');
      return;
    }

    setIsDownloading(true);
    const hideMessage = message.loading('Generating PDF...');

    try {
      const pageElements = Array.from(pdfRef.current.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement,
      );

      await DownloadAsPDF({
        pdfRef: pageElements,
        fileName: `AI-Forensics-Alert-${alertId}.pdf`,
        orientation: 'landscape',
        addPageNumber: true,
      });
      message.success('PDF downloaded successfully');
    } catch (error) {
      console.error(getErrorMessage(error));
      message.error('Failed to download PDF');
    } finally {
      setIsDownloading(false);
      hideMessage?.();
    }
  }, [alertId, allItems.length]);

  if (!isEnabled) {
    return null;
  }

  return (
    <>
      <Button
        type="TETRIARY"
        onClick={handleDownload}
        isLoading={isDownloading}
        isDisabled={isDownloading}
      >
        AI Forensics Report
      </Button>

      <div ref={pdfRef} className={s.pdfContainer}>
        {questionPages.map((pageQuestions, pageIndex) => (
          <div key={pageIndex} className={s.pdfPage}>
            {pageIndex === 0 && (
              <div className={s.pdfHeader}>
                <p className={s.pdfTimestamp}>
                  Alert ID: {alertId} | Generated on {new Date().toLocaleDateString()} at{' '}
                  {new Date().toLocaleTimeString()}
                </p>
              </div>
            )}

            {pageQuestions.map((question, questionIndex) => {
              const globalIndex =
                questionPages.slice(0, pageIndex).reduce((total, page) => total + page.length, 0) +
                questionIndex;

              return (
                <PdfQuestionResponseItem
                  key={question.questionId || globalIndex}
                  item={question}
                  index={globalIndex}
                />
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
};

export default AiForensicsPdfDownloadButton;
