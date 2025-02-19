import React, { useEffect, useState } from 'react';
import { Progress } from 'antd';
import s from './index.module.less';
import CopilotSources from './CopilotSources';
import Button from '@/components/library/Button';
import BrainLineIcon from '@/components/ui/icons/brain-icon-colored.react.svg';
import MagicLineIcon from '@/components/ui/icons/Remix/design/magic-line.react.svg';
import SearchIcon from '@/components/ui/icons/Remix/system/search-2-line.react.svg';
import {
  AdditionalCopilotInfo,
  CaseReasons,
  NarrativeResponseAttributes,
  NarrativeMode,
} from '@/apis';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Tooltip from '@/components/library/Tooltip';
import { getBranding } from '@/utils/branding';
import { EntityType } from '@/components/Narrative';
import Modal from '@/components/library/Modal';
import AnimatedButton from '@/components/Narrative/AnimatedButton';
import Dropdown from '@/components/library/Dropdown';
import ArrowDownLine from '@/components/ui/icons/Remix/system/arrow-down-s-line.react.svg';

type CopilotButtonProps = {
  askLoading: boolean;
  formatLoading: boolean;
  attributes: NarrativeResponseAttributes[];
  onAskClick: () => void;
  onFormatClick: () => void;
  narrative: string;
  copilotDisabled?: boolean;
  copilotDisabledReason?: string;
  narrativeMode: NarrativeMode;
  setNarrativeMode: (mode: NarrativeMode) => void;
};

export const CopilotButtons = (props: CopilotButtonProps) => {
  const settings = useSettings();
  const {
    narrative,
    askLoading,
    formatLoading,
    attributes,
    onFormatClick,
    onAskClick,
    copilotDisabled = false,
    copilotDisabledReason = '',
    narrativeMode,
    setNarrativeMode,
  } = props;
  const [showSources, setShowSources] = useState(false);

  if (askLoading || formatLoading) {
    return <ProgressBar />;
  }
  return (
    <div className={s.buttons}>
      <div className={s.narrativeMode}>
        <Tooltip
          title={
            copilotDisabled
              ? copilotDisabledReason
              : settings.isAiEnabled
              ? `Use AI to generate the narrative template`
              : `Enable AI Features to generate a narrative`
          }
        >
          <span>
            <AnimatedButton
              isLoading={askLoading}
              className={s.copilotAskButton}
              onClick={onAskClick}
              icon={<BrainLineIcon />}
              isDisabled={!settings?.isAiEnabled || askLoading || copilotDisabled}
              testName="ask-copilot"
              requiredPermissions={['copilot:narrative:write']}
            >
              Ask copilot
            </AnimatedButton>
          </span>
        </Tooltip>
        {settings.allowManualNarrativeModeUpdates && (
          <Dropdown<NarrativeMode>
            options={[
              { value: 'COMPACT', label: 'Compact' },
              { value: 'STANDARD', label: 'Standard' },
            ]}
            onSelect={(value) => setNarrativeMode(value.value)}
          >
            <Button type={'TEXT'} iconRight={<ArrowDownLine />}>
              Narrative: {narrativeMode === 'COMPACT' ? 'Compact' : 'Standard'}
            </Button>
          </Dropdown>
        )}
      </div>
      <Tooltip
        title={
          settings.isAiEnabled
            ? `Use AI to format your narrative`
            : `Enable AI Features to generate a narrative`
        }
      >
        <span>
          <Button
            isLoading={formatLoading}
            className={s.copilotFormatButton}
            onClick={onFormatClick}
            type={'TEXT'}
            icon={<MagicLineIcon />}
            isDisabled={
              !settings?.isAiEnabled || formatLoading || !narrative || narrative.length < 50
            }
            testName="format-copilot-narrative"
            requiredPermissions={['copilot:narrative:write']}
          >
            Format
          </Button>
        </span>
      </Tooltip>
      <Tooltip
        title={
          settings.isAiEnabled
            ? `Discover the data that was used to generate the narrative.`
            : `Enable AI Features to generate a narrative`
        }
      >
        <span>
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
        </span>
      </Tooltip>
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

type CopilotButtonContentProps = {
  reasons: string[];
  entityId: string;
  entityType?: EntityType;
  narrative: string;
  setNarrativeValue: (narrative: string) => void;
  additionalCopilotInfo?: AdditionalCopilotInfo;
  otherReason?: string;
  copilotDisabled?: boolean;
  copilotDisabledReason?: string;
};

export const CopilotButtonContent = (props: CopilotButtonContentProps) => {
  const {
    reasons,
    entityId,
    entityType,
    narrative,
    setNarrativeValue,
    additionalCopilotInfo,
    otherReason,
    copilotDisabled,
    copilotDisabledReason,
  } = props;
  const branding = getBranding();
  const settings = useSettings();

  // TODO We will support alerts and transactions in a later version.
  if (entityType !== 'CASE' && entityType !== 'ALERT' && entityType !== 'TRANSACTION') {
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
            additionalCopilotInfo={additionalCopilotInfo}
            otherReason={otherReason}
            copilotDisabled={copilotDisabled}
            copilotDisabledReason={copilotDisabledReason}
          />
        </Tooltip>
      ) : (
        <CopilotWrapperContent
          reasons={reasons}
          entityId={entityId}
          entityType={entityType}
          narrative={narrative}
          setNarrativeValue={setNarrativeValue}
          additionalCopilotInfo={additionalCopilotInfo}
          otherReason={otherReason}
          copilotDisabled={copilotDisabled}
          copilotDisabledReason={copilotDisabledReason}
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

type CopilotWrapperContentProps = {
  reasons: string[];
  entityId: string;
  entityType: EntityType;
  narrative: string;
  setNarrativeValue: (narrative: string) => void;
  additionalCopilotInfo?: AdditionalCopilotInfo;
  otherReason?: string;
  copilotDisabled?: boolean;
  copilotDisabledReason?: string;
};

export const CopilotWrapperContent = (props: CopilotWrapperContentProps) => {
  const api = useApi();
  const {
    reasons,
    entityId,
    entityType,
    narrative,
    setNarrativeValue,
    additionalCopilotInfo,
    otherReason,
    copilotDisabled,
    copilotDisabledReason,
  } = props;

  const [askLoading, setAskLoading] = useState(false);
  const [formatLoading, setFormatLoading] = useState(false);
  const [attributes, setAttributes] = useState<NarrativeResponseAttributes[]>([]);
  const settings = useSettings();
  const [narrativeMode, setNarrativeMode] = useState<NarrativeMode>(
    settings.narrativeMode ?? 'STANDARD',
  );

  const boldPlaceholders = (text: string) => text.replace(/\[(.*?)\]/g, '**[$1]**');

  const onAsk = async () => {
    try {
      setAskLoading(true);
      const response = await api.generateNarrative({
        NarrativeRequest: {
          entityId,
          entityType: entityType || 'CASE',
          reasons: reasons as CaseReasons[],
          otherReason,
          narrative: '',
          additionalCopilotInfo,
          narrativeMode,
        },
      });
      const processedNarrative = boldPlaceholders(response.narrative);
      setNarrativeValue(processedNarrative);
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
        NarrativeRequest: {
          entityId,
          entityType: entityType || 'CASE',
          narrative,
          reasons: reasons as CaseReasons[],
          narrativeMode,
        },
      });
      const processedNarrative = boldPlaceholders(response.narrative);
      setNarrativeValue(processedNarrative);
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
              copilotDisabled={copilotDisabled}
              copilotDisabledReason={copilotDisabledReason}
              narrativeMode={narrativeMode}
              setNarrativeMode={setNarrativeMode}
            />
          )}
        </div>
      )}
    </>
  );
};
