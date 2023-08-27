import React, { useState } from 'react';
import s from './index.module.less';
import Button from '@/components/library/Button';
import BrainLineIcon from '@/components/ui/icons/Remix/health/brain-line.react.svg';
import { CaseReasons } from '@/apis';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Tooltip from '@/components/library/Tooltip';
import { getBranding } from '@/utils/branding';

interface Props {
  reasons: CaseReasons[];
  setCommentValue: (comment: string) => void;
  entityId: string;
  entityType?: 'ALERT' | 'CASE' | 'TRANSACTION';
}

export const CopilotButtonContent = ({ reasons, entityId, setCommentValue, entityType }: Props) => {
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
            setCommentValue={setCommentValue}
          />
        </Tooltip>
      ) : (
        <CopilotWrapperContent
          reasons={reasons}
          entityId={entityId}
          entityType={entityType}
          setCommentValue={setCommentValue}
        />
      )}
    </>
  );
};

const CopilotWrapperContent = ({ reasons, entityType, entityId, setCommentValue }: Props) => {
  const api = useApi();
  const [copilotLoading, setCopilotLoading] = useState(false);

  const settings = useSettings();

  const onCopilotNarrative = async () => {
    try {
      setCopilotLoading(true);
      const response = await api.generateNarrative({
        NarrativeRequest: {
          entityId,
          entityType: entityType || 'CASE',
          reasons: reasons,
        },
      });
      setCommentValue(response.narrative);
    } catch (e) {
      message.error('Failed to generate narrative with AI');
    } finally {
      setCopilotLoading(false);
    }
  };

  return (
    <>
      {reasons.length > 0 && (
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
        </div>
      )}
    </>
  );
};
