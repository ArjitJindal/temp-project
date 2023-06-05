import { Space } from 'antd';
import ReactCountryFlag from 'react-country-flag';
import COUNTRIES, { COUNTRY_NAME_TO_CODE } from '@/utils/countries';

interface Props {
  // Alpha-2 code
  isoCode?: string;
  countryName?: string;
  flagStyle?: React.CSSProperties;
}

export default function CountryDisplay(props: Props): JSX.Element {
  const { isoCode, countryName, flagStyle = {} } = props;
  if (!isoCode && !countryName) {
    return <>-</>;
  }
  const code = isoCode || (countryName && COUNTRY_NAME_TO_CODE[countryName]);
  const name = countryName || COUNTRIES[code];

  if (code == null) {
    console.warn(`Unable to define country code. Country name: "${countryName}"`);
  }

  return (
    <Space align="start">
      {name && <ReactCountryFlag countryCode={code} svg style={flagStyle} />}
      <span>{name || code}</span>
    </Space>
  );
}
