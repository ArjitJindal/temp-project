import { useContext, useEffect, useState } from 'react';
import { hide, show, shutdown } from '@intercom/messenger-js-sdk';
import TopLevelLink from '../TopLevelLink';
import { useFeatureEnabled } from '../../Providers/SettingsProvider';
import { CluesoContext } from '../../Providers/CluesoTokenProvider';
import IntercomComponent from './Intercomm';
import QuestionLineIcon from '@/components/ui/icons/Remix/system/question-line.react.svg';
import { useI18n } from '@/locales';
import { getBranding } from '@/utils/branding';

const branding = getBranding();

interface HelpProps {
  isCollapsed?: boolean;
  isActiveHighlightingEnabled: boolean;
}

const Help = (props: HelpProps) => {
  const { isCollapsed, isActiveHighlightingEnabled } = props;

  const [isOpen, setOpen] = useState(false);
  const cluesoToken = useContext(CluesoContext);
  const hasFeatureChatbot = useFeatureEnabled('CHATBOT');
  const i18n = useI18n();

  useEffect(() => {
    if (window.Intercom && !hasFeatureChatbot) {
      shutdown();
    }
  }, [hasFeatureChatbot]);

  return (
    <>
      {hasFeatureChatbot && <IntercomComponent setOpen={(state) => setOpen(state)} />}
      <TopLevelLink
        key="help"
        icon={<QuestionLineIcon />}
        isCollapsed={isCollapsed}
        isActiveHighlightingEnabled={isActiveHighlightingEnabled}
        {...(hasFeatureChatbot
          ? {
              onClick: () => {
                if (isOpen) {
                  hide();
                } else {
                  show();
                }
                setOpen(!isOpen);
              },
            }
          : {
              to: `${branding.knowledgeBaseUrl}?token=${cluesoToken}`,
              isExternal: true,
            })}
      >
        {i18n('menu.support')}
      </TopLevelLink>
      ,
    </>
  );
};

export default Help;
