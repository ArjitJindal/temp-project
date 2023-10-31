import { CurrencyCode } from '@/apis';

export const CURRENCIES: ReadonlyArray<{
  readonly value: CurrencyCode;
  readonly label: string;
  readonly symbol: string | null;
}> = [
  {
    value: 'ADA',
    label: 'ADA (Cardano)',
    symbol: null,
  },
  {
    value: 'AED',
    label: 'AED (United Arab Emirates Dirham)',
    symbol: 'د.إ',
  },
  {
    value: 'AFN',
    label: 'AFN (Afghan afghani)',
    symbol: '؋',
  },
  {
    value: 'ALGO',
    label: 'ALGO (Algorand)',
    symbol: null,
  },
  {
    value: 'ALL',
    label: 'ALL (Albanian lek)',
    symbol: 'Lek',
  },
  {
    value: 'AMD',
    label: 'AMD (Armenian dram)',
    symbol: null,
  },
  {
    value: 'ANG',
    label: 'ANG (Netherlands Antillean Guilder)',
    symbol: 'ƒ',
  },
  {
    value: 'AOA',
    label: 'AOA (Angolan kwanza)',
    symbol: null,
  },
  {
    value: 'ARS',
    label: 'ARS (Argentine peso)',
    symbol: '$',
  },
  {
    value: 'ATOM',
    label: 'ATOM (Atomic Coin)',
    symbol: null,
  },
  {
    value: 'AUD',
    label: 'AUD (Australian dollar)',
    symbol: '$',
  },
  {
    value: 'AVAX',
    label: 'AVAX (Avalanche)',
    symbol: null,
  },
  {
    value: 'AWG',
    label: 'AWG (Aruban florin)',
    symbol: 'ƒ',
  },
  {
    value: 'AZN',
    label: 'AZN (Azerbaijani manat)',
    symbol: '₼',
  },
  {
    value: 'BAM',
    label: 'BAM (Bosnia-Herzegovina Convertible Mark)',
    symbol: 'KM',
  },
  {
    value: 'BBD',
    label: 'BBD (Bajan dollar)',
    symbol: '$',
  },
  {
    value: 'BCH',
    label: 'BCH (Bitcoin Cash)',
    symbol: null,
  },
  {
    value: 'BDT',
    label: 'BDT (Bangladeshi taka)',
    symbol: null,
  },
  {
    value: 'BGN',
    label: 'BGN (Bulgarian lev)',
    symbol: 'лв',
  },
  {
    value: 'BHD',
    label: 'BHD (Bahraini dinar)',
    symbol: null,
  },
  {
    value: 'BIF',
    label: 'BIF (Burundian Franc)',
    symbol: null,
  },
  {
    value: 'BMD',
    label: 'BMD (Bermudan dollar)',
    symbol: '$',
  },
  {
    value: 'BNB',
    label: 'BNB (Binance Coin)',
    symbol: null,
  },
  {
    value: 'BND',
    label: 'BND (Brunei dollar)',
    symbol: '$',
  },
  {
    value: 'BOB',
    label: 'BOB (Bolivian boliviano)',
    symbol: '$b',
  },
  {
    value: 'BRB',
    label: 'BRB (Brazilian real)',
    symbol: null,
  },
  {
    value: 'BSD',
    label: 'BSD (Bahamian dollar)',
    symbol: '$',
  },
  {
    value: 'BTC',
    label: 'BTC (Bitcoin)',
    symbol: null,
  },
  {
    value: 'BTN',
    label: 'BTN (Bhutan currency)',
    symbol: null,
  },
  {
    value: 'BUSD',
    label: 'BUSD (Binance USD)',
    symbol: null,
  },
  {
    value: 'BWP',
    label: 'BWP (Botswanan Pula)',
    symbol: 'P',
  },
  {
    value: 'BYN',
    label: 'BYN (New Belarusian Ruble)',
    symbol: 'Br',
  },
  {
    value: 'BYR',
    label: 'BYR (Belarusian Ruble)',
    symbol: null,
  },
  {
    value: 'BZD',
    label: 'BZD (Belize dollar)',
    symbol: 'BZ$',
  },
  {
    value: 'CAD',
    label: 'CAD (Canadian dollar)',
    symbol: '$',
  },
  {
    value: 'CDF',
    label: 'CDF (Congolese franc)',
    symbol: null,
  },
  {
    value: 'CHF',
    label: 'CHF (Swiss franc)',
    symbol: 'CHF',
  },
  {
    value: 'CHZ',
    label: 'CHZ (Chiliz)',
    symbol: null,
  },
  {
    value: 'CLF',
    label: 'CLF (Chilean Unit of Account (UF))',
    symbol: null,
  },
  {
    value: 'CLP',
    label: 'CLP (Chilean peso)',
    symbol: '$',
  },
  {
    value: 'CNY',
    label: 'CNY (Chinese Yuan)',
    symbol: '¥',
  },
  {
    value: 'COP',
    label: 'COP (Colombian peso)',
    symbol: 'Col$',
  },
  {
    value: 'CRC',
    label: 'CRC (Costa Rican Colón)',
    symbol: '₡',
  },
  {
    value: 'CRO',
    label: 'CRO (Crypto.com Chain Token)',
    symbol: null,
  },
  {
    value: 'CUC',
    label: 'CUC (Cuban peso)',
    symbol: null,
  },
  {
    value: 'CUP',
    label: 'CUP (Cuban Peso)',
    symbol: '₱',
  },
  {
    value: 'CVE',
    label: 'CVE (Cape Verdean escudo)',
    symbol: null,
  },
  {
    value: 'CZK',
    label: 'CZK (Czech koruna)',
    symbol: 'Kč',
  },
  {
    value: 'DAI',
    label: 'DAI (Dai)',
    symbol: null,
  },
  {
    value: 'DIF',
    label: 'DIF (Djiboutian franc)',
    symbol: null,
  },
  {
    value: 'DKK',
    label: 'DKK (Danish krone)',
    symbol: 'kr',
  },
  {
    value: 'DOGE',
    label: 'DOGE (Dogecoin)',
    symbol: null,
  },
  {
    value: 'DOP',
    label: 'DOP (Dominican peso)',
    symbol: 'RD$',
  },
  {
    value: 'DOT',
    label: 'DOT (Dotcoin)',
    symbol: null,
  },
  {
    value: 'DZD',
    label: 'DZD (Algerian dinar)',
    symbol: null,
  },
  {
    value: 'EGLD',
    label: 'EGLD (Elrond)',
    symbol: null,
  },
  {
    value: 'EGP',
    label: 'EGP (Egyptian pound)',
    symbol: '£',
  },
  {
    value: 'ENJ',
    label: 'ENJ (Enjin Coin)',
    symbol: null,
  },
  {
    value: 'ERN',
    label: 'ERN (Eritrean nakfa)',
    symbol: null,
  },
  {
    value: 'ETB',
    label: 'ETB (Ethiopian birr)',
    symbol: null,
  },
  {
    value: 'ETC',
    label: 'ETC (Ethereum Classic)',
    symbol: null,
  },
  {
    value: 'ETH',
    label: 'ETH (Ether)',
    symbol: null,
  },
  {
    value: 'EUR',
    label: 'EUR (Euro)',
    symbol: '€',
  },
  {
    value: 'FIL',
    label: 'FIL (FileCoin)',
    symbol: null,
  },
  {
    value: 'FJD',
    label: 'FJD (Fijian dollar)',
    symbol: '$',
  },
  {
    value: 'FKP',
    label: 'FKP (Falkland Islands pound)',
    symbol: '£',
  },
  {
    value: 'FTT',
    label: 'FTT (FarmaTrust)',
    symbol: null,
  },
  {
    value: 'GBP',
    label: 'GBP (Pound sterling)',
    symbol: '£',
  },
  {
    value: 'GEL',
    label: 'GEL (Georgian lari)',
    symbol: null,
  },
  {
    value: 'GGP',
    label: 'GGP (GGPro)',
    symbol: '£',
  },
  {
    value: 'GHS',
    label: 'GHS (Ghanaian cedi)',
    symbol: '¢',
  },
  {
    value: 'GIP',
    label: 'GIP (Gibraltar pound)',
    symbol: '£',
  },
  {
    value: 'GMD',
    label: 'GMD (Gambian dalasi)',
    symbol: null,
  },
  {
    value: 'GNF',
    label: 'GNF (Guinean franc)',
    symbol: null,
  },
  {
    value: 'GRT',
    label: 'GRT (Golden Ratio Token)',
    symbol: null,
  },
  {
    value: 'GTQ',
    label: 'GTQ (Guatemalan quetzal)',
    symbol: 'Q',
  },
  {
    value: 'GYD',
    label: 'GYD (Guyanaese Dollar)',
    symbol: '$',
  },
  {
    value: 'HKD',
    label: 'HKD (Hong Kong dollar)',
    symbol: '$',
  },
  {
    value: 'HNL',
    label: 'HNL (Honduran lempira)',
    symbol: 'L',
  },
  {
    value: 'HRK',
    label: 'HRK (Croatian kuna)',
    symbol: 'kn',
  },
  {
    value: 'HTG',
    label: 'HTG (Haitian gourde)',
    symbol: null,
  },
  {
    value: 'HUF',
    label: 'HUF (Hungarian forint)',
    symbol: 'Ft',
  },
  {
    value: 'ICP',
    label: 'ICP (Internet Computer)',
    symbol: null,
  },
  {
    value: 'IDR',
    label: 'IDR (Indonesian rupiah)',
    symbol: 'Rp',
  },
  {
    value: 'ILS',
    label: 'ILS (Israeli New Shekel)',
    symbol: '₪',
  },
  {
    value: 'IMP',
    label: 'IMP (CoinIMP)',
    symbol: '£',
  },
  {
    value: 'INJ',
    label: 'INJ (Injective)',
    symbol: null,
  },
  {
    value: 'INR',
    label: 'INR (Indian rupee)',
    symbol: '₹',
  },
  {
    value: 'IQD',
    label: 'IQD (Iraqi dinar)',
    symbol: null,
  },
  {
    value: 'IRR',
    label: 'IRR (Iranian rial)',
    symbol: '﷼',
  },
  {
    value: 'ISK',
    label: 'ISK (Icelandic króna)',
    symbol: 'kr',
  },
  {
    value: 'JEP',
    label: 'JEP (Jersey Pound)',
    symbol: '£',
  },
  {
    value: 'JMD',
    label: 'JMD (Jamaican dollar)',
    symbol: 'J$',
  },
  {
    value: 'JOD',
    label: 'JOD (Jordanian dinar)',
    symbol: null,
  },
  {
    value: 'JPY',
    label: 'JPY (Japanese yen)',
    symbol: '¥',
  },
  {
    value: 'KES',
    label: 'KES (Kenyan shilling)',
    symbol: null,
  },
  {
    value: 'KGS',
    label: 'KGS (Kyrgystani Som)',
    symbol: 'лв',
  },
  {
    value: 'KHR',
    label: 'KHR (Cambodian riel)',
    symbol: '៛',
  },
  {
    value: 'KMF',
    label: 'KMF (Comorian franc)',
    symbol: null,
  },
  {
    value: 'KPW',
    label: 'KPW (North Korean won)',
    symbol: '₩',
  },
  {
    value: 'KRW',
    label: 'KRW (South Korean won)',
    symbol: '₩',
  },
  {
    value: 'KSM',
    label: 'KSM (Kusama)',
    symbol: null,
  },
  {
    value: 'KWD',
    label: 'KWD (Kuwaiti dinar)',
    symbol: null,
  },
  {
    value: 'KYD',
    label: 'KYD (Cayman Islands dollar)',
    symbol: '$',
  },
  {
    value: 'KZT',
    label: 'KZT (Kazakhstani tenge)',
    symbol: 'лв',
  },
  {
    value: 'LAK',
    label: 'LAK (Laotian Kip)',
    symbol: '₭',
  },
  {
    value: 'LBP',
    label: 'LBP (Lebanese pound)',
    symbol: '£',
  },
  {
    value: 'LINK',
    label: 'LINK (ChainLink)',
    symbol: null,
  },
  {
    value: 'LKR',
    label: 'LKR (Sri Lankan rupee)',
    symbol: '₨',
  },
  {
    value: 'LRD',
    label: 'LRD (Liberian dollar)',
    symbol: '$',
  },
  {
    value: 'LSR',
    label: 'LSR (Lesotho loti)',
    symbol: null,
  },
  {
    value: 'LTC',
    label: 'LTC (Litecoin)',
    symbol: null,
  },
  {
    value: 'LTL',
    label: 'LTL (Lithuanian litas)',
    symbol: null,
  },
  {
    value: 'LVL',
    label: 'LVL (Latvian lats)',
    symbol: null,
  },
  {
    value: 'LYD',
    label: 'LYD (Libyan dinar)',
    symbol: null,
  },
  {
    value: 'MAD',
    label: 'MAD (Moroccan dirham)',
    symbol: null,
  },
  {
    value: 'MATIC',
    label: 'MATIC (Polygon)',
    symbol: null,
  },
  {
    value: 'MDL',
    label: 'MDL (Moldovan leu)',
    symbol: null,
  },
  {
    value: 'MGA',
    label: 'MGA (Malagasy ariary)',
    symbol: null,
  },
  {
    value: 'MKD',
    label: 'MKD (Macedonian denar)',
    symbol: 'ден',
  },
  {
    value: 'MMK',
    label: 'MMK (Myanmar Kyat)',
    symbol: null,
  },
  {
    value: 'MNT',
    label: 'MNT (Mongolian tugrik)',
    symbol: '₮',
  },
  {
    value: 'MOP',
    label: 'MOP (Macanese pataca)',
    symbol: null,
  },
  {
    value: 'MRO',
    label: 'MRO (Mauritanian ouguiya)',
    symbol: null,
  },
  {
    value: 'MUR',
    label: 'MUR (Mauritian rupee)',
    symbol: '₨',
  },
  {
    value: 'MVR',
    label: 'MVR (Maldivian rufiyaa)',
    symbol: null,
  },
  {
    value: 'MWK',
    label: 'MWK (Malawian kwacha)',
    symbol: null,
  },
  {
    value: 'MXN',
    label: 'MXN (Mexican peso)',
    symbol: '$',
  },
  {
    value: 'MYR',
    label: 'MYR (Malaysian ringgit)',
    symbol: 'RM',
  },
  {
    value: 'MZN',
    label: 'MZN (Mozambican Metical)',
    symbol: 'MT',
  },
  {
    value: 'NAD',
    label: 'NAD (Namibian dollar)',
    symbol: '$',
  },
  {
    value: 'NGN',
    label: 'NGN (Nigerian naira)',
    symbol: '₦',
  },
  {
    value: 'NIO',
    label: 'NIO (Nicaraguan córdoba)',
    symbol: 'C$',
  },
  {
    value: 'NOK',
    label: 'NOK (Norwegian krone)',
    symbol: 'kr',
  },
  {
    value: 'NPR',
    label: 'NPR (Nepalese rupee)',
    symbol: '₨',
  },
  {
    value: 'NZD',
    label: 'NZD (New Zealand dollar)',
    symbol: '$',
  },
  {
    value: 'OMR',
    label: 'OMR (Omani rial)',
    symbol: '﷼',
  },
  {
    value: 'ONE',
    label: 'ONE (Menlo One)',
    symbol: null,
  },
  {
    value: 'PAB',
    label: 'PAB (Panamanian balboa)',
    symbol: 'B/.',
  },
  {
    value: 'PEN',
    label: 'PEN (Sol)',
    symbol: 'S/.',
  },
  {
    value: 'PGK',
    label: 'PGK (Papua New Guinean kina)',
    symbol: null,
  },
  {
    value: 'PHP',
    label: 'PHP (Philippine peso)',
    symbol: '₱',
  },
  {
    value: 'PKR',
    label: 'PKR (Pakistani rupee)',
    symbol: '₨',
  },
  {
    value: 'PLN',
    label: 'PLN (Poland złoty)',
    symbol: 'zł',
  },
  {
    value: 'PYG',
    label: 'PYG (Paraguayan guarani)',
    symbol: 'Gs',
  },
  {
    value: 'QAR',
    label: 'QAR (Qatari Rial)',
    symbol: '﷼',
  },
  {
    value: 'RON',
    label: 'RON (Romanian leu)',
    symbol: 'lei',
  },
  {
    value: 'RSD',
    label: 'RSD (Serbian dinar)',
    symbol: 'Дин.',
  },
  {
    value: 'RUB',
    label: 'RUB (Russian ruble)',
    symbol: '₽',
  },
  {
    value: 'RWF',
    label: 'RWF (Rwandan Franc)',
    symbol: null,
  },
  {
    value: 'SAR',
    label: 'SAR (Saudi riyal)',
    symbol: '﷼',
  },
  {
    value: 'SBD',
    label: 'SBD (Solomon Islands dollar)',
    symbol: '$',
  },
  {
    value: 'SRC',
    label: 'SRC (Seychellois rupee)',
    symbol: null,
  },
  {
    value: 'SDG',
    label: 'SDG (Sudanese pound)',
    symbol: null,
  },
  {
    value: 'SEK',
    label: 'SEK (Swedish krona)',
    symbol: 'kr',
  },
  {
    value: 'SGD',
    label: 'SGD (Singapore dollar)',
    symbol: '$',
  },
  {
    value: 'SHIB',
    label: 'SHIB (Shiba Inu)',
    symbol: null,
  },
  {
    value: 'SHP',
    label: 'SHP (Saint Helena pound)',
    symbol: '£',
  },
  {
    value: 'SLL',
    label: 'SLL (Sierra Leonean leone)',
    symbol: null,
  },
  {
    value: 'SOL',
    label: 'SOL (Sola)',
    symbol: null,
  },
  {
    value: 'SOS',
    label: 'SOS (Somali shilling)',
    symbol: 'S',
  },
  {
    value: 'SRD',
    label: 'SRD (Surinamese dollar)',
    symbol: '$',
  },
  {
    value: 'STD',
    label: 'STD (São Tomé and Príncipe Dobra (pre-2018))',
    symbol: null,
  },
  {
    value: 'SVC',
    label: 'SVC (Salvadoran Colón)',
    symbol: '$',
  },
  {
    value: 'SYP',
    label: 'SYP (Syrian pound)',
    symbol: '£',
  },
  {
    value: 'SZL',
    label: 'SZL (Swazi lilangeni)',
    symbol: null,
  },
  {
    value: 'THB',
    label: 'THB (Thai baht)',
    symbol: '฿',
  },
  {
    value: 'THETA',
    label: 'THETA (Theta)',
    symbol: null,
  },
  {
    value: 'TJS',
    label: 'TJS (Tajikistani somoni)',
    symbol: null,
  },
  {
    value: 'TMT',
    label: 'TMT (Turkmenistani manat)',
    symbol: null,
  },
  {
    value: 'TND',
    label: 'TND (Tunisian dinar)',
    symbol: null,
  },
  {
    value: 'TOP',
    label: "TOP (Tongan Pa'anga)",
    symbol: null,
  },
  {
    value: 'TRX',
    label: 'TRX (TRON)',
    symbol: null,
  },
  {
    value: 'TRY',
    label: 'TRY (Turkish lira)',
    symbol: '₺',
  },
  {
    value: 'TTD',
    label: 'TTD (Trinidad & Tobago Dollar)',
    symbol: 'TT$',
  },
  {
    value: 'TWD',
    label: 'TWD (New Taiwan dollar)',
    symbol: 'NT$',
  },
  {
    value: 'TZS',
    label: 'TZS (Tanzanian shilling)',
    symbol: null,
  },
  {
    value: 'UAH',
    label: 'UAH (Ukrainian hryvnia)',
    symbol: '₴',
  },
  {
    value: 'UGX',
    label: 'UGX (Ugandan shilling)',
    symbol: null,
  },
  {
    value: 'UNI',
    label: 'UNI (Universe)',
    symbol: null,
  },
  {
    value: 'USD',
    label: 'USD (United States dollar)',
    symbol: '$',
  },
  {
    value: 'USDC',
    label: 'USDC (USD Coin)',
    symbol: null,
  },
  {
    value: 'USDT',
    label: 'USDT (Tether)',
    symbol: null,
  },
  {
    value: 'UYU',
    label: 'UYU (Uruguayan peso)',
    symbol: '$U',
  },
  {
    value: 'UZS',
    label: 'UZS (Uzbekistani som)',
    symbol: 'лв',
  },
  {
    value: 'VEF',
    label: 'VEF (Sovereign Bolivar)',
    symbol: 'Bs',
  },
  {
    value: 'VET',
    label: 'VET (Vechain)',
    symbol: null,
  },
  {
    value: 'VND',
    label: 'VND (Vietnamese dong)',
    symbol: '₫',
  },
  {
    value: 'VUV',
    label: 'VUV (Vanuatu vatu)',
    symbol: null,
  },
  {
    value: 'WBTC',
    label: 'WBTC (Wrapped Bitcoin)',
    symbol: null,
  },
  {
    value: 'WST',
    label: 'WST (Samoan tala)',
    symbol: null,
  },
  {
    value: 'XAF',
    label: 'XAF (Central African CFA franc)',
    symbol: null,
  },
  {
    value: 'XAG',
    label: 'XAG (Silver Ounce)',
    symbol: null,
  },
  {
    value: 'XAU',
    label: 'XAU (XauCoin)',
    symbol: null,
  },
  {
    value: 'XCD',
    label: 'XCD (East Cari,bbean dollar)',
    symbol: '$',
  },
  {
    value: 'XDR',
    label: 'XDR (Special Drawing Rights)',
    symbol: null,
  },
  {
    value: 'XLM',
    label: 'XLM (Stellar)',
    symbol: null,
  },
  {
    value: 'XMR',
    label: 'XMR (Monero)',
    symbol: null,
  },
  {
    value: 'XOF',
    label: 'XOF (West African CFA franc)',
    symbol: null,
  },
  {
    value: 'XPF',
    label: 'XPF (CFP franc)',
    symbol: null,
  },
  {
    value: 'XRP',
    label: 'XRP (XRP)',
    symbol: null,
  },
  {
    value: 'YER',
    label: 'YER (Yemeni rial)',
    symbol: '﷼',
  },
  {
    value: 'ZAR',
    label: 'ZAR (South African rand)',
    symbol: 'R',
  },
  {
    value: 'ZMK',
    label: 'ZMK (Zambian kwacha)',
    symbol: null,
  },
  {
    value: 'ZMW',
    label: 'ZMW (Zambian Kwacha)',
    symbol: null,
  },
  {
    value: 'ZWL',
    label: 'ZWL (Zimbabwean Dollar)',
    symbol: null,
  },
] as const;

export type CurrencyInfo = typeof CURRENCIES[number];
export type Currency = CurrencyInfo['value'];

export const CURRENCIES_SELECT_OPTIONS = [...CURRENCIES];
