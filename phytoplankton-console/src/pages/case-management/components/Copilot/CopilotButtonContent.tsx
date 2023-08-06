import React, { useState } from 'react';
import s from './index.module.less';
import Button from '@/components/library/Button';
import BrainLineIcon from '@/components/ui/icons/Remix/health/brain-line.react.svg';
import Alert from '@/components/library/Alert';
import { CaseClosingReasons, NarrativeResponse } from '@/apis';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import CopilotSources from '@/pages/case-management/components/Copilot/CopilotSources';
import Modal from '@/components/library/Modal';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Tooltip from '@/components/library/Tooltip';
import { getBranding } from '@/utils/branding';

interface Props {
  reasons: CaseClosingReasons[];
  setCommentValue: (comment: string) => void;
  caseId: string;
}

export const CopilotButtonContent = ({ reasons, caseId, setCommentValue }: Props) => {
  const [copilotResponse, setCopilotResponse] = useState<NarrativeResponse | undefined>();
  const branding = getBranding();
  const [showSources, setShowSources] = useState(false);
  const settings = useSettings();

  return (
    <>
      {!settings.isAiEnabled ? (
        <Tooltip title={`Enable ${branding.companyName} AI Features to generate a narrative`}>
          <CopilotWrapperContent
            reasons={reasons}
            caseId={caseId}
            setCommentValue={setCommentValue}
            copilotResponse={copilotResponse}
            setShowSources={setShowSources}
            setCopilotResponse={setCopilotResponse}
          />
        </Tooltip>
      ) : (
        <CopilotWrapperContent
          reasons={reasons}
          caseId={caseId}
          setCommentValue={setCommentValue}
          copilotResponse={copilotResponse}
          setShowSources={setShowSources}
          setCopilotResponse={setCopilotResponse}
        />
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
        title="ⓘ Copilot Sources"
        okText="Back"
        isOpen={showSources}
        onOk={() => setShowSources(false)}
        hideFooter
        onCancel={() => setShowSources(false)}
      >
        <CopilotSources attributes={copilotResponse?.attributes || []} />
      </Modal>
    </>
  );
};

const CopilotWrapperContent = ({
  reasons,
  caseId,
  copilotResponse,
  setShowSources,
  setCommentValue,
  setCopilotResponse,
}: Props & {
  copilotResponse?: NarrativeResponse;
  setShowSources: (show: boolean) => void;
  setCopilotResponse: (response: NarrativeResponse | undefined) => void;
}) => {
  const api = useApi();
  const [copilotLoading, setCopilotLoading] = useState(false);

  const settings = useSettings();

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
              isDisabled={!settings?.isAiEnabled}
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
    </>
  );
};
