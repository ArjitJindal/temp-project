import { Space } from 'antd';
import ReactCountryFlag from 'react-country-flag';
import COUNTRIES, { COUNTRY_NAME_TO_CODE } from '@/utils/countries';

interface Props {
  // Alpha-2 code
  isoCode?: string;
  countryName?: string;
}

export default function CountryDisplay(props: Props): JSX.Element {
  const { isoCode, countryName } = props;
  if (!isoCode && !countryName) {
    return <>-</>;
  }
  const code = isoCode || COUNTRY_NAME_TO_CODE[countryName!];
  const name = countryName || COUNTRIES[isoCode!];

  return (
    <Space align="start">
      {name && <ReactCountryFlag countryCode={code} svg />}
      <span>{name || code}</span>
    </Space>
  );
}
