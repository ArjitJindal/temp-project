import { useEffect, useState } from 'react';
import { shutdown, show as openIntercommWidget } from '@intercom/messenger-js-sdk';
import TopLevelLink from '../TopLevelLink';
import { useFeatureEnabled, useSettings } from '../../Providers/SettingsProvider';
import FreshworkComponent, { openFreshworksWidget } from './Freshwork';
import IntercomComponent from './Intercomm';
import QuestionLineIcon from '@/components/ui/icons/Remix/system/question-line.react.svg';
import { useI18n } from '@/locales';
import { getBranding } from '@/utils/branding';
import { useCluesoToken } from '@/utils/api/auth';
import { isSuccess } from '@/utils/asyncResource';

const branding = getBranding();

interface HelpProps {
  isCollapsed?: boolean;
  isActiveHighlightingEnabled: boolean;
}

const Help = (props: HelpProps) => {
  const { isCollapsed, isActiveHighlightingEnabled } = props;

  const hasFeatureChatbot = useFeatureEnabled('CHATBOT');
  const cluesoTokenQuery = useCluesoToken(hasFeatureChatbot);
  const [isWidgetInitialized, setWidgetInitialization] = useState(false);
  const chatbotName = useSettings().chatbotName;
  const i18n = useI18n();

  useEffect(() => {
    if (window.Intercom && (!hasFeatureChatbot || chatbotName !== 'INTERCOMM')) {
      shutdown();
    }
  }, [hasFeatureChatbot, chatbotName]);

  // const handleChatbotClose = () => {
  //   switch (chatbotName) {
  //     case 'INTERCOMM':
  //       closeIntercommWidget();
  //       break;
  //     case 'FRESHWORK':
  //       closeFreshworksWidget();
  //       break;
  //     default:
  //   }
  // };

  const handleChatbotOpen = () => {
    if (!isWidgetInitialized) {
      setWidgetInitialization(true);
      return;
    }
    switch (chatbotName) {
      case 'INTERCOMM':
        openIntercommWidget();
        break;
      case 'FRESHWORK':
        openFreshworksWidget();
        break;
      default:
    }
  };

  return (
    <>
      {hasFeatureChatbot && isWidgetInitialized && chatbotName === 'INTERCOMM' && (
        <IntercomComponent />
      )}
      {hasFeatureChatbot && isWidgetInitialized && chatbotName === 'FRESHWORK' && (
        <FreshworkComponent />
      )}
      <TopLevelLink
        key="help"
        icon={<QuestionLineIcon />}
        isCollapsed={isCollapsed}
        isActiveHighlightingEnabled={isActiveHighlightingEnabled}
        {...(hasFeatureChatbot
          ? {
              onClick: () => {
                handleChatbotOpen();
              },
            }
          : {
              to: isSuccess(cluesoTokenQuery.data)
                ? `${branding.knowledgeBaseUrl}?token=${cluesoTokenQuery.data.value}`
                : '/',
              isExternal: true,
            })}
      >
        {i18n('menu.support')}
      </TopLevelLink>
    </>
  );
};

export default Help;
