import React, { useState } from 'react';
import { Modal } from 'antd';
import s from './index.module.less';
import Button from '@/components/library/Button';
import BrainLineIcon from '@/components/ui/icons/Remix/health/brain-line.react.svg';
import Alert from '@/components/library/Alert';
import { CaseClosingReasons, NarrativeResponse } from '@/apis';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import CopilotSources from '@/pages/case-management/components/Copilot/CopilotSources';

export const CopilotButtonContent = ({
  reasons,
  caseId,
  setCommentValue,
}: {
  reasons: CaseClosingReasons[];
  setCommentValue: (comment: string) => void;
  caseId: string;
}) => {
  const api = useApi();
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotResponse, setCopilotResponse] = useState<NarrativeResponse | undefined>();
  const [showSources, setShowSources] = useState(false);

  const onCopilotNarrative = async () => {
    try {
      setCopilotLoading(true);
      const response = await api.generateNarrative({
        NarrativeRequest: {
          caseId,
          reasons: reasons,
        },
      });
      setCopilotResponse(response);
      setCommentValue(response.narrative);
    } catch (e) {
      message.error('Failed to generate narrative with AI');
    } finally {
      setCopilotLoading(false);
    }
  };
  return (
    <>
      {(reasons.length > 0 || (copilotResponse?.userPrompts?.length ?? 0) > 0) && (
        <div className={s.copilotWrapper}>
          {reasons.length > 0 && (
            <Button
              isLoading={copilotLoading}
              className={s.copilotButton}
              onClick={onCopilotNarrative}
              type={'TEXT'}
              icon={<BrainLineIcon />}
            >
              {copilotLoading ? 'Loading...' : 'Ask Copilot'}
            </Button>
          )}
          {(copilotResponse?.userPrompts?.length ?? 0) > 0 && (
            <Button
              className={s.copilotShowSourcesButton}
              type={'TEXT'}
              onClick={() => setShowSources(true)}
            >
              Check my sources
            </Button>
          )}
        </div>
      )}
      {copilotResponse?.userPrompts && copilotResponse?.userPrompts?.length > 0 && (
        <div className={s.copilotPrompts}>
          {copilotResponse?.userPrompts.map((p) => (
            <a target="_blank" href={p.link}>
              <Alert type="info">{p.text ?? ''}</Alert>
            </a>
          ))}
        </div>
      )}
      <Modal
        className={s.modal}
        title="ⓘ Copilot Sources"
        visible={showSources}
        okText="Back"
        onOk={() => setShowSources(false)}
        cancelButtonProps={{ hidden: true }}
        onCancel={() => setShowSources(false)}
      >
        <CopilotSources attributes={copilotResponse?.attributes || []} />
      </Modal>
    </>
  );
};
