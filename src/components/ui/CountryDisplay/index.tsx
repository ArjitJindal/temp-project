import { Space } from 'antd';
import countries from 'i18n-iso-countries';
import ReactCountryFlag from 'react-country-flag';

// eslint-disable-next-line @typescript-eslint/no-var-requires
countries.registerLocale(require('i18n-iso-countries/langs/en.json'));

interface Props {
  // Alpha-2, Alpha-3 or Numeric code
  isoCode?: string;
}

// TODO: Support i18n
const LANG = 'en';

export default function CountryDisplay(props: Props): JSX.Element {
  const { isoCode } = props;
  if (!isoCode) {
    return <>-</>;
  }
  const countryName = countries.getName(isoCode, LANG);

  return (
    <Space>
      {countryName && (
        <ReactCountryFlag countryCode={countries.getAlpha2Code(countryName, LANG)} svg />
      )}
      <span>{countryName || isoCode}</span>
    </Space>
  );
}
