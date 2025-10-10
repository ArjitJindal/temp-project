import React from 'react';
import { setUserAlias } from '@flagright/lib/utils/userAlias';
import s from './index.module.less';
import PdfTable from './PdfTable';
import PdfProperties from './PdfProperties';
import PdfBarchart from './PdfBarchart';
import PdfStackedBarchart from './PdfStackedBarchart';
import PdfTimeSeries from './PdfTimeSeries';
import PdfRuleHit from './PdfRuleHit';
import PdfEmbedded from './PdfEmbedded';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { QuestionResponse } from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/types';
import { neverReturn } from '@/utils/lang';

interface Props {
  item: QuestionResponse;
  index: number;
}

const PdfQuestionResponseItem: React.FC<Props> = ({ item, index }) => {
  const { userAlias } = useSettings();
  const renderContent = () => {
    switch (item.questionType) {
      case 'TABLE':
        return <PdfTable item={item} />;
      case 'PROPERTIES':
      case 'RULE_LOGIC':
        return <PdfProperties item={item} />;
      case 'BARCHART':
        return <PdfBarchart item={item} />;
      case 'STACKED_BARCHART':
        return <PdfStackedBarchart item={item} />;
      case 'TIME_SERIES':
        return <PdfTimeSeries item={item} />;
      case 'RULE_HIT':
        return <PdfRuleHit item={item} />;
      case 'EMBEDDED':
        return <PdfEmbedded item={item} />;
      default:
        return neverReturn(
          item.questionType as never,
          <div className={s.unsupportedContent}>Content type not supported</div>,
        );
    }
  };

  return (
    <div className={s.questionContainer}>
      <h3 className={s.questionTitle}>
        {index + 1}. {setUserAlias(item.title || `Question ${index + 1}`, userAlias)}{' '}
      </h3>

      {item.summary && (
        <div className={s.questionSummary}>
          <strong>Summary:</strong> {setUserAlias(item.summary, userAlias)}
        </div>
      )}

      {renderContent()}
    </div>
  );
};

export default PdfQuestionResponseItem;
