import { useContext, useEffect } from 'react';
import { shutdown, show as openIntercommWidget } from '@intercom/messenger-js-sdk';
import TopLevelLink from '../TopLevelLink';
import { useFeatureEnabled, useSettings } from '../../Providers/SettingsProvider';
import { CluesoContext } from '../../Providers/CluesoTokenProvider';
import FreshworkComponent, { openFreshworksWidget } from './Freshwork';
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

  const cluesoToken = useContext(CluesoContext);
  const hasFeatureChatbot = useFeatureEnabled('CHATBOT');
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
      {hasFeatureChatbot && chatbotName === 'INTERCOMM' && <IntercomComponent />}
      {hasFeatureChatbot && chatbotName === 'FRESHWORK' && <FreshworkComponent />}
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
