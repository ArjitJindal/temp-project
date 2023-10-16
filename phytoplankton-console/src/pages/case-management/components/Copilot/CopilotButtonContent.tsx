import React, { useEffect, useState } from 'react';
import { Progress } from 'antd';
import s from './index.module.less';
import CopilotSources from './CopilotSources';
import Button from '@/components/library/Button';
import BrainLineIcon from '@/components/ui/icons/Remix/health/brain-line.react.svg';
import MagicLineIcon from '@/components/ui/icons/Remix/design/magic-line.react.svg';
import SearchIcon from '@/components/ui/icons/Remix/system/search-2-line.react.svg';
import { CaseReasons, NarrativeResponseAttributes } from '@/apis';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Tooltip from '@/components/library/Tooltip';
import { getBranding } from '@/utils/branding';
import { EntityType } from '@/components/Narrative';
import Modal from '@/components/library/Modal';

type CopilotButtonProps = {
  askLoading: boolean;
  formatLoading: boolean;
  attributes: NarrativeResponseAttributes[];
  onAskClick: () => void;
  onFormatClick: () => void;
  narrative: string;
};

export const CopilotButtons = (props: CopilotButtonProps) => {
  const settings = useSettings();
  const { narrative, askLoading, formatLoading, attributes, onFormatClick, onAskClick } = props;
  const [showSources, setShowSources] = useState(false);

  if (askLoading || formatLoading) {
    return <ProgressBar />;
  }

  return (
    <div className={s.buttons}>
      <Button
        isLoading={askLoading}
        className={s.copilotAskButton}
        onClick={onAskClick}
        type={'TEXT'}
        icon={<BrainLineIcon />}
        isDisabled={!settings?.isAiEnabled || askLoading}
        testName="ask-copilot"
        requiredPermissions={['copilot:narrative:write']}
      >
        Ask copilot
      </Button>
      <Button
        isLoading={formatLoading}
        className={s.copilotFormatButton}
        onClick={onFormatClick}
        type={'TEXT'}
        icon={<MagicLineIcon />}
        isDisabled={!settings?.isAiEnabled || formatLoading || !narrative || narrative.length < 50}
        testName="format-copilot-narrative"
        requiredPermissions={['copilot:narrative:write']}
      >
        Format
      </Button>
      <Button
        className={s.copilotShowSourcesButton}
        type={'TEXT'}
        onClick={() => setShowSources(true)}
        icon={<SearchIcon />}
        isDisabled={attributes.length === 0}
        requiredPermissions={['copilot:narrative:read']}
      >
        Sources
      </Button>
      <Modal
        title="ⓘ Copilot Sources"
        okText="Back"
        isOpen={showSources}
        onOk={() => setShowSources(false)}
        hideFooter
        onCancel={() => setShowSources(false)}
      >
        <CopilotSources attributes={attributes} />
      </Modal>
    </div>
  );
};

interface Props {
  reasons: string[];
  narrative: string;
  setNarrativeValue: (narrative: string) => void;
  entityId: string;
  entityType?: EntityType;
}

export const CopilotButtonContent = ({
  reasons,
  entityId,
  narrative,
  setNarrativeValue,
  entityType,
}: Props) => {
  const branding = getBranding();
  const settings = useSettings();

  // TODO We will support alerts and transactions in a later version.
  if (entityType !== 'CASE') {
    return <></>;
  }

  return (
    <>
      {!settings.isAiEnabled ? (
        <Tooltip title={`Enable ${branding.companyName} AI Features to generate a narrative`}>
          <CopilotWrapperContent
            reasons={reasons}
            entityId={entityId}
            entityType={entityType}
            narrative={narrative}
            setNarrativeValue={setNarrativeValue}
          />
        </Tooltip>
      ) : (
        <CopilotWrapperContent
          reasons={reasons}
          entityId={entityId}
          entityType={entityType}
          narrative={narrative}
          setNarrativeValue={setNarrativeValue}
        />
      )}
    </>
  );
};

function ProgressBar() {
  const [currentPercent, setCurrentPercent] = useState(0);

  useEffect(() => {
    const targetPercent = 80; // The target percent you want to reach
    const duration = 10000; // 10 seconds in milliseconds

    const startTime = Date.now();

    const updateProgress = () => {
      const currentTime = Date.now();
      const elapsedTime = currentTime - startTime;

      if (elapsedTime >= duration) {
        setCurrentPercent(targetPercent);
      } else {
        // Calculate the logarithmic progress based on the elapsed time
        const logProgress = (Math.log(elapsedTime + 1) / Math.log(duration + 1)) * targetPercent;
        setCurrentPercent(logProgress);

        // Schedule the next update
        requestAnimationFrame(updateProgress);
      }
    };

    // Start the progress update
    updateProgress();
  }, []);

  return (
    <div style={{ width: '100%' }}>
      <div>
        <Progress percent={currentPercent} showInfo={false} />
      </div>
      <div style={{ textAlign: 'center' }}>
        {currentPercent < 30 && 'Gathering case data...'}
        {currentPercent >= 30 && currentPercent < 75 && 'Aggregating and obfuscating data...'}
        {currentPercent >= 75 && 'Preparing narrative...'}
      </div>
    </div>
  );
}
export const CopilotWrapperContent = ({
  reasons,
  entityType,
  entityId,
  narrative,
  setNarrativeValue,
}: Props) => {
  const api = useApi();
  const [askLoading, setAskLoading] = useState(false);
  const [formatLoading, setFormatLoading] = useState(false);
  const [attributes, setAttributes] = useState<NarrativeResponseAttributes[]>([]);

  const onAsk = async () => {
    try {
      setAskLoading(true);
      const response = await api.generateNarrative({
        NarrativeRequest: {
          entityId,
          entityType: entityType || 'CASE',
          // TODO make this generic
          reasons: reasons as CaseReasons[],
        },
      });
      setNarrativeValue(response.narrative);
      setAttributes(response.attributes);
    } catch (e) {
      message.error('Failed to generate narrative with AI');
    } finally {
      setAskLoading(false);
    }
  };
  const onFormat = async () => {
    try {
      setFormatLoading(true);
      const response = await api.formatNarrative({
        FormatRequest: {
          entityId,
          entityType: entityType || 'CASE',
          narrative,
        },
      });
      setNarrativeValue(response.narrative);
    } catch (e) {
      message.error('Failed to format narrative with AI');
    } finally {
      setFormatLoading(false);
    }
  };

  return (
    <>
      {reasons.length > 0 && (
        <div className={s.copilotWrapper}>
          {reasons.length > 0 && (
            <CopilotButtons
              askLoading={askLoading}
              onAskClick={onAsk}
              formatLoading={formatLoading}
              onFormatClick={onFormat}
              attributes={attributes}
              narrative={narrative}
            />
          )}
        </div>
      )}
    </>
  );
};
