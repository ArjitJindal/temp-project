// todo: need to find a way to share variables with less to get rid of code duplication
// Reference: https://www.notion.so/flagright/Color-Palette-b9fd3936b526416785220e5c0c1016f7
export type SimpleColor = string;

export interface ColorSet {
  base: SimpleColor;
  tint: SimpleColor;
  shade: SimpleColor;
}

interface MainPallete {
  navyBlue: ColorSet;
  brandBlue: ColorSet;
  turquoise: ColorSet;
  purpleGray: ColorSet;
  lightBlue: ColorSet;
  leafGreen: ColorSet;
  red: ColorSet;
  orange: ColorSet;
  purple: ColorSet;
  yellow: ColorSet;
  skyBlue: ColorSet;
  limeGreen: ColorSet;
  lightGreen: ColorSet;
  green: ColorSet;
  lightYellow: ColorSet;
  lightOrange: ColorSet;
  lightRed: ColorSet;
}

const MAIN_PALLETE: MainPallete = {
  navyBlue: { base: '#293f7a', tint: '#dee6fa', shade: '#131f40' }, // Base,Primary
  brandBlue: { base: '#1169f9', tint: '#ebf2ff', shade: '#063075' }, // Base,Primary
  turquoise: { base: '#87e8de', tint: '#ebfcfb', shade: '#1ab0a1' }, // Accent,Base,Primary
  purpleGray: { base: '#7284a3', tint: '#dfe6f2', shade: '#2a374d' }, // Base,Primary
  leafGreen: { base: '#52c41a', tint: '#f1ffeb', shade: '#357317' }, // Graphs,Primary
  red: { base: '#ff4d4f', tint: '#ffe5e6', shade: '#992628' }, // Graphs,Primary
  orange: { base: '#f6a429', tint: '#fff4e5', shade: '#a66d17' }, // Graphs,Primary
  purple: { base: '#8b75f2', tint: '#eeebfa', shade: '#986abb' }, // Graphs,Primary
  yellow: { base: '#f5e25a', tint: '#fcf9e3', shade: '#b2a542' }, // Graphs,Primary
  skyBlue: { base: '#78cbeb', tint: '#e6f8ff', shade: '#267999' }, // Graphs,Primary
  limeGreen: { base: '#bff35a', tint: '#f4fce3', shade: '#86a745' }, // Graphs,Primary
  lightBlue: { base: '#1890ff', tint: '#e6f7ff', shade: '#096dd9' }, // Graphs,Primary
  lightGreen: { base: '#D1E277', tint: '#F1F6D6', shade: '#000000' }, // Graphs,Primary
  green: { base: '#AAD246', tint: '#E6F2C8', shade: '#000000' }, // Graphs,Primary
  lightYellow: { base: '#EED23F', tint: '#FAF2C5', shade: '#000000' }, // Graphs,Primary
  lightOrange: { base: '#E47E30', tint: '#F7D8C1', shade: '#000000' }, // Graphs,Primary
  lightRed: { base: '#E93134', tint: '#F8C1C2', shade: '#000000' }, // Graphs,Primary
};

const NEW_COLORS = {
  gray2: '#e7e7e7',
  gray5: '#a8a8a8',
  gray10: '#262626',
  white: '#ffffff',
  gray6: '#8d8d8d',
};

const SEMANTIC_COLORS = {
  infoColor: MAIN_PALLETE.skyBlue,
  successColor: MAIN_PALLETE.green,
  warningColor: MAIN_PALLETE.lightYellow,
  errorColor: MAIN_PALLETE.lightOrange,
  alertColor: MAIN_PALLETE.lightRed,
};

const COLORS = {
  ...MAIN_PALLETE,
  ...SEMANTIC_COLORS,
  ...NEW_COLORS,
};

/*
  New palette colors, all the above is legacy
 */
export const COLORS_V2_GRAY_1 = '#f4f4f4';
export const COLORS_V2_GRAY_2 = '#e7e7e7';
export const COLORS_V2_GRAY_3 = '#e0e0e0';
export const COLORS_V2_GRAY_4 = '#c6c6c6';
export const COLORS_V2_GRAY_5 = '#a8a8a8';
export const COLORS_V2_GRAY_6 = '#8d8d8d';
export const COLORS_V2_GRAY_7 = '#6f6f6f';
export const COLORS_V2_GRAY_8 = '#525252';
export const COLORS_V2_GRAY_9 = '#393939';
export const COLORS_V2_GRAY_10 = '#262626';
export const COLORS_V2_GRAY_11 = '#161616';
export const COLORS_V2_PRIMARY_FLAGRIGHTBLUE = '#1169f9';
export const COLORS_V2_HIGHLIGHT_FLAGRIGHTBLUE = '#f0f4fb';
export const COLORS_V2_HIGHLIGHT_HIGHLIGHT_STROKE = '#DFE6F2';
export const COLORS_V2_HIGHLIGHT_CARD_BACKGROUND = '#F8F9FA';

export const COLORS_V2_STATE_ACTIVE = COLORS_V2_PRIMARY_FLAGRIGHTBLUE;
export const COLORS_V2_STATE_HOVER = '#1555bb';
export const COLORS_V2_STATE_DISABLED = '#c6c6c6';
export const COLORS_V2_ALERT_CRITICAL = '#d42a2a';
export const COLORS_V2_ALERT_WARNING = '#efbe12';
export const COLORS_V2_ALERT_SUCCESS = '#1ba543';
export const COLORS_V2_RISK_LEVEL_BASE_VERY_LOW = '#d1e277';
export const COLORS_V2_RISK_LEVEL_BG_VERY_LOW = '#f1f6d6';
export const COLORS_V2_RISK_LEVEL_BASE_LOW = '#aad246';
export const COLORS_V2_RISK_LEVEL_BG_LOW = '#e6f2c8';
export const COLORS_V2_RISK_LEVEL_BASE_MEDIUM = '#eed23f';
export const COLORS_V2_RISK_LEVEL_BG_MEDIUM = '#faf2c5';
export const COLORS_V2_RISK_LEVEL_BASE_HIGH = '#e47e30';
export const COLORS_V2_RISK_LEVEL_BG_HIGH = '#f7d8c1';
export const COLORS_V2_RISK_LEVEL_BASE_VERY_HIGH = '#e93134';
export const COLORS_V2_RISK_LEVEL_BG_VERY_HIGH = '#f8c1c2';

/*
  Color to use for text when it's over the specified color
 */
export function getLabelColor(backgroundColor: string): string {
  if (backgroundColor === COLORS.purpleGray.tint) {
    return COLORS.purpleGray.base;
  }
  if (backgroundColor === COLORS.turquoise.tint) {
    return COLORS.purpleGray.base;
  }
  return 'white';
}

export default COLORS;
