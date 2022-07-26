import { DefaultFooter } from '@ant-design/pro-layout';
import style from '../styles.module.less';
import { useI18n } from '@/locales';

export default function Footer() {
  const i18l = useI18n();
  const defaultMessage = i18l('app.copyright.produced', {
    defaultMessage: 'Flagright Data Technologies Inc.',
  });

  const currentYear = new Date().getFullYear();
  return <DefaultFooter copyright={`${currentYear} ${defaultMessage}`} className={style.footer} />;
}
