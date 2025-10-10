import enUS from './en-US';
import bnBD from './bn-BD';
import faIR from './fa-IR';
import idID from './id-ID';
import jaJP from './ja-JP';
import ptBR from './pt-BR';
import zhCN from './zh-CN';
import zhTW from './zh-TW';

const translations = {
  'bn-BD': bnBD,
  'en-US': enUS,
  'fa-IR': faIR,
  'id-ID': idID,
  'ja-JP': jaJP,
  'pt-BR': ptBR,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
};
type Translations = typeof enUS;
export type TranslationId = keyof Translations;

type Locale = keyof typeof translations;
const DEFAULT_LOCALE: Locale = 'en-US';

export type I18n = (
  id: TranslationId,
  params?: {
    defaultMessage?: string;
  },
) => string;

export function useI18n(): I18n {
  return (key, params) => translations[DEFAULT_LOCALE][key] ?? params?.defaultMessage ?? key;
}

export function FormattedMessage(props: {
  id: TranslationId;
  defaultMessage?: string;
  values?: { [key: string]: string };
}): JSX.Element {
  const i18n = useI18n();
  const message = i18n(props.id, { defaultMessage: props.defaultMessage });
  return <>{message}</>;
}
