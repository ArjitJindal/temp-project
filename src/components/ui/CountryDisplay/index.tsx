import { Space } from 'antd';
import ReactCountryFlag from 'react-country-flag';
import COUNTRIES from '@/utils/countries';

interface Props {
  // Alpha-2, Alpha-3 or Numeric code
  isoCode?: string;
}

export default function CountryDisplay(props: Props): JSX.Element {
  const { isoCode } = props;
  if (!isoCode) {
    return <>-</>;
  }
  const countryName = COUNTRIES[isoCode];

  return (
    <Space>
      {countryName && <ReactCountryFlag countryCode={isoCode} svg />}
      <span>{countryName || isoCode}</span>
    </Space>
  );
}
