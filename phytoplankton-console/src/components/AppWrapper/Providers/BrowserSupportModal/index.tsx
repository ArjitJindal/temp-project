import { useLocalStorageState, useSessionStorageState } from 'ahooks';
import { useState } from 'react';
import { browserName } from 'react-device-detect';
import Checkbox from '../../../library/Checkbox';
import EdgeLogo from '../../../ui/icons/edge-logo.react.svg';
import ChromeLogo from '../../../ui/icons/chrome-logo.react.svg';
import s from './index.module.less';
import Modal from '@/components/library/Modal';
import { getBranding } from '@/utils/branding';

const SUPPORTED_BROWSERS = ['Chrome', 'Edge'];

export const BrowserSupportModal = () => {
  const [isBrowserSuppported, setIsBrowserSuppported] = useLocalStorageState<boolean | undefined>(
    'BROWSER_SUPPORT_RESPONSE',
    undefined,
  );
  const [isBrowserSuppportedTemp, setIsBrowserSuppportedTemp] = useSessionStorageState<
    boolean | undefined
  >('BROWSER_SUPPORT_RESPONSE', undefined);
  const isCurrentBrowserSupported = SUPPORTED_BROWSERS.includes(browserName);
  const [isOpen, setIsOpen] = useState<boolean>(
    !isCurrentBrowserSupported &&
      isBrowserSuppported === undefined &&
      isBrowserSuppportedTemp === undefined,
  );
  const [isDontShowAgain, setIsDontShowAgain] = useState<boolean>(false);
  const handleCancel = () => {
    setIsOpen(false);
    setIsBrowserSuppportedTemp(true);
    if (isDontShowAgain) {
      setIsBrowserSuppported(true);
    }
  };

  const companyName = getBranding().companyName;

  return (
    <Modal
      isOpen={isOpen}
      cancelText={`Continue in ${browserName}`}
      onCancel={handleCancel}
      title={`Unfortunately, ${browserName} is not compatible!`}
      hideOk
      maskClosable={true}
      width="S"
    >
      <div className={s.root}>
        <div className={s.text}>
          <span className={s.title}>
            You might face issues using {companyName} console on {browserName}.
          </span>
          <span className={s.subTitle}>
            For a better experience use one of the supported browsers.
          </span>
        </div>
        <div className={s.browsers}>
          <a className={s.browser} href="https://www.google.com/intl/en_in/chrome/" target="_blank">
            <ChromeLogo />
            <span>Download Chrome</span>
          </a>
          <a
            className={s.browser}
            href="https://www.microsoft.com/en-us/edge/download?form=MA13FJ"
            target="_blank"
          >
            <EdgeLogo />
            <span>Download Edge</span>
          </a>
        </div>
        <div className={s.checkbox}>
          <Checkbox
            value={isDontShowAgain}
            onChange={() => {
              setIsDontShowAgain((prevState) => !prevState);
            }}
          />{' '}
          <span>Don't show this message again.</span>
        </div>
      </div>
    </Modal>
  );
};
