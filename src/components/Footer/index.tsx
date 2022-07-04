// import { useIntl } from 'umi';
import { DefaultFooter } from '@ant-design/pro-layout';
import { useI18n } from '@/locales';

export default () => {
  const i18l = useI18n();
  const defaultMessage = i18l('app.copyright.produced', {
    defaultMessage: '蚂蚁集团体验技术部出品',
  });

  const currentYear = new Date().getFullYear();

  return <DefaultFooter copyright={`${currentYear} ${defaultMessage}`} />;
};
