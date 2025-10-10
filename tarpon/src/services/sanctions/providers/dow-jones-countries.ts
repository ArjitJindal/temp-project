// Dow Jones has a completely non-standard country code system.
// This is a mapping of their codes to ISO 3166-1 alpha-2 codes.
// Generate with ChatGPT:
// https://chatgpt.com/share/5e18ee52-7eca-4332-8e5a-36c0fdd3b3c5
export const DOW_JONES_COUNTRIES = {
  AFGH: 'AF',
  ALB: 'AL',
  ALG: 'DZ',
  ARG: 'AR',
  ARMEN: 'AM',
  AUST: 'AT',
  AUSTR: 'AU',
  AZERB: 'AZ',
  BAH: 'BS',
  BAHRN: 'BH',
  BANDH: 'BD',
  BARB: 'BB',
  BELG: 'BE',
  BELZ: 'BZ',
  BENIN: 'BJ',
  BHUTAN: 'BT',
  BOL: 'BO',
  BOTS: 'BW',
  BRAZ: 'BR',
  BRUNEI: 'BN',
  BSHZG: 'BA',
  BUL: 'BG',
  BURMA: 'MM',
  BURUN: 'BI',
  CAFR: 'CF',
  CAMER: 'CM',
  CANA: 'CA',
  CHAD: 'TD',
  CHIL: 'CL',
  CHINA: 'CN',
  COL: 'CO',
  COMOR: 'KM',
  CONGO: 'CG',
  COSR: 'CR',
  CRTIA: 'HR',
  CUBA: 'CU',
  CVI: 'CV',
  CYPR: 'CY',
  CZREP: 'CZ',
  DEN: 'DK',
  DOMA: 'DM',
  DOMR: 'DO',
  ECU: 'EC',
  EGYPT: 'EG',
  ELSAL: 'SV',
  EQGNA: 'GQ',
  ERTRA: 'ER',
  ESTNIA: 'EE',
  ETHPA: 'ET',
  FIJI: 'FJ',
  FIN: 'FI',
  FRA: 'FR',
  GABON: 'GA',
  GAMB: 'GM',
  GFR: 'DE',
  GHANA: 'GH',
  GREECE: 'GR',
  GREN: 'GD',
  GRGIA: 'GE',
  GUAT: 'GT',
  GUBI: 'GW',
  GUREP: 'GN',
  GUY: 'GY',
  HAIT: 'HT',
  HON: 'HN',
  HUNG: 'HU',
  ICEL: 'IS',
  ICST: 'CI',
  INDIA: 'IN',
  INDON: 'ID',
  IRAN: 'IR',
  IRAQ: 'IQ',
  IRE: 'IE',
  ISRAEL: 'IL',
  ITALY: 'IT',
  JAMA: 'JM',
  JAP: 'JP',
  JORDAN: 'JO',
  KAMPA: 'KH',
  KAZK: 'KZ',
  KENYA: 'KE',
  KIRB: 'KI',
  KIRGH: 'KG',
  KOSOVO: 'XK',
  KUWAIT: 'KW',
  LAOS: 'LA',
  LATV: 'LV',
  LEBAN: 'LB',
  LESOT: 'LS',
  LIBER: 'LR',
  LIBYA: 'LY',
  LIECHT: 'LI',
  LITH: 'LT',
  LUX: 'LU',
  MCDNIA: 'MK',
  MEX: 'MX',
  MNTNG: 'ME',
  MOLDV: 'MD',
  MONAC: 'MC',
  MONGLA: 'MN',
  MOROC: 'MA',
  MOZAM: 'MZ',
  NAMIB: 'NA',
  NAURU: 'NR',
  NEPAL: 'NP',
  NETH: 'NL',
  NICG: 'NI',
  NIGEA: 'NG',
  NIGER: 'NE',
  NKOREA: 'KP',
  NORW: 'NO',
  NZ: 'NZ',
  OMAN: 'OM',
  PAKIS: 'PK',
  PALAU: 'PW',
  PALEST: 'PS',
  PANA: 'PA',
  PAPNG: 'PG',
  PARA: 'PY',
  PERU: 'PE',
  PHLNS: 'PH',
  POL: 'PL',
  PORL: 'PT',
  PST: 'ST',
  QATAR: 'QA',
  ROM: 'RO',
  RUSS: 'RU',
  RWANDA: 'RW',
  SAARAB: 'SA',
  SAFR: 'ZA',
  SENEG: 'SN',
  SEYCH: 'SC',
  SILEN: 'SL',
  SINGP: 'SG',
  SKIT: 'KN',
  SKOREA: 'KR',
  SLUC: 'LC',
  SLVAK: 'SK',
  SLVNIA: 'SI',
  SMARNO: 'SM',
  SOLIL: 'SB',
  SOMAL: 'SO',
  SOUSUD: 'SS',
  SPAIN: 'ES',
  SRILAN: 'LK',
  SUDAN: 'SD',
  SURM: 'SR',
  SWAZD: 'SZ',
  SWED: 'SE',
  SWITZ: 'CH',
  SYRIA: 'SY',
  TADZK: 'TJ',
  TANZA: 'TZ',
  THAIL: 'TH',
  TIMOR: 'TL',
  TOGO: 'TG',
  TONGA: 'TO',
  TRTO: 'TT',
  TUNIS: 'TN',
  TURK: 'TR',
  TURKM: 'TM',
  UAE: 'AE',
  UGANDA: 'UG',
  UK: 'GB',
  UKRN: 'UA',
  UPVOLA: 'BF',
  URU: 'UY',
  USA: 'US',
  UZBK: 'UZ',
  VANU: 'VU',
  VCAN: 'VA',
  VEN: 'VE',
  VIETN: 'VN',
  WSOMOA: 'WS',
  YEMAR: 'YE',
  YUG: 'RS',
  ZAIRE: 'CD',
  ZAMBIA: 'ZM',
  ZIMBAB: 'ZW',
  AARCT: 'AQ',
  ABKHAZ: 'GE', // Abkhazia is internationally recognized as part of Georgia
  AMSAM: 'AS', // American Samoa
  ANDO: 'AD', // Andorra
  ANGOL: 'AO', // Angola
  ANGUIL: 'AI', // Anguilla
  ANTA: 'AG', // Antigua and Barbuda
  ARUBA: 'AW', // Aruba
  BERM: 'BM', // Bermuda
  BIOT: 'IO', // British Indian Ocean Territory
  BOUV: 'BV', // Bouvet Island
  BVI: 'VG', // British Virgin Islands
  BYELRS: 'BY', // Belarus
  CAYI: 'KY', // Cayman Islands
  CHR: 'CX', // Christmas Island
  COCOS: 'CC', // Cocos (Keeling) Islands
  COOKIS: 'CK', // Cook Islands
  FAEROE: 'FO', // Faroe Islands
  FALK: 'FK', // Falkland Islands
  FESMIC: 'FM', // Micronesia
  FGNA: 'GF', // French Guiana
  FPOLY: 'PF', // French Polynesia
  GIB: 'GI', // Gibraltar
  GREENL: 'GL', // Greenland
  GUAD: 'GP', // Guadeloupe
  GUAM: 'GU', // Guam
  GUERN: 'GG', // Guernsey
  HEARD: 'HM', // Heard and McDonald Islands
  HKONG: 'HK', // Hong Kong
  INTERNATIONAL: 'INT', // International
  ISLEOM: 'IM', // Isle of Man
  JERSEY: 'JE', // Jersey
  MACAO: 'MO', // Macau
  MAH: 'MH', // Marshall Islands
  MALAG: 'MG', // Madagascar
  MALAW: 'MW', // Malawi
  MALAY: 'MY', // Malaysia
  MALDR: 'MV', // Maldives
  MALI: 'ML', // Mali
  MALTA: 'MT', // Malta
  MARQ: 'MQ', // Martinique
  MAURTN: 'MR', // Mauritania
  MAURTS: 'MU', // Mauritius
  MAYOT: 'YT', // Mayotte
  MONT: 'MS', // Montserrat
  NANT: 'CW', // Curaçao
  NEWCAL: 'NC', // New Caledonia
  NIUE: 'NU', // Niue
  NOMARI: 'MP', // Northern Mariana Islands
  NONE: 'XX', // None (Not a country)
  NORFIS: 'NF', // Norfolk Island
  NOTK: 'ZZ', // Not Known
  PITCIS: 'PN', // Pitcairn Islands
  PURI: 'PR', // Puerto Rico
  REUNI: 'RE', // Reunion
  SBRTHY: 'BL', // Saint Barthélemy
  SGSSI: 'GS', // South Georgia and South Sandwich Islands
  SINTMA: 'SX', // Sint Maarten
  SOSSRT: 'SO', // South Ossetia
  SPSAH: 'EH', // Western Sahara
  STHEL: 'SH', // Saint Helena
  STMART: 'MF', // Saint Martin
  STPM: 'PM', // Saint Pierre and Miquelon
  SVALB: 'SJ', // Svalbard and Jan Mayen
  SVIN: 'VC', // Saint Vincent and the Grenadines
  TAI: 'DJ', // Djibouti
  TAIWAN: 'TW', // Taiwan
  TCAI: 'TC', // Turks and Caicos Islands
  TOKLAU: 'TK', // Tokelau
  TURNC: 'CY', // Turkish Republic of Northern Cyprus (Internationally recognized as part of Cyprus)
  TVLU: 'TV', // Tuvalu
  VI: 'VI', // U.S. Virgin Islands
  WALLIS: 'WF', // Wallis and Futuna Islands
}
