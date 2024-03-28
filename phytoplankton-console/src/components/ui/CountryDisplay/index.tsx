import ReactCountryFlag from 'react-country-flag';
import { COUNTRIES, COUNTRY_NAME_TO_CODE, CountryCode } from '@flagright/lib/constants';
import s from './index.module.less';

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
  const code = isoCode || (countryName && COUNTRY_NAME_TO_CODE[countryName]);
  const name = countryName || COUNTRIES[code];

  if (code == null) {
    console.warn(`Unable to define country code. Country name: "${countryName}"`);
  }

  return (
    <div className={s.root}>
      {name && <CountryFlag code={code} />}
      <span>{name || code}</span>
    </div>
  );
}

export function CountryFlag(props: { code: CountryCode }) {
  const { code } = props;
  return <ReactCountryFlag countryCode={code} svg />;
}
