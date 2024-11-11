// todo: need to find a way to share variables with less to get rid of code duplication
// Reference: https://www.notion.so/flagright/Color-Palette-b9fd3936b526416785220e5c0c1016f7
export type SimpleColor = string;

export interface ColorSet {
  base: SimpleColor;
  tint: SimpleColor;
  shade: SimpleColor;
  alpha?: SimpleColor;
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
  brandBlue: { base: '#1169f9', tint: '#ebf2ff', shade: '#063075', alpha: '#1169f91a' }, // Base,Primary
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

export const COLORS_V2_PRIMARY_TINTS_BLUE_50 = '#020A19';
export const COLORS_V2_PRIMARY_TINTS_BLUE_100 = '#131F40';
export const COLORS_V2_PRIMARY_TINTS_BLUE_200 = '#031532';
export const COLORS_V2_PRIMARY_TINTS_BLUE_300 = '#072A64';
export const COLORS_V2_PRIMARY_TINTS_BLUE_400 = '#09357D';
export const COLORS_V2_PRIMARY_TINTS_BLUE_500 = '#0A3F95';
export const COLORS_V2_PRIMARY_TINTS_BLUE_600 = '#0C4AAE';
export const COLORS_V2_PRIMARY_TINTS_BLUE_700 = '#1555BB';
export const COLORS_V2_PRIMARY_TINTS_BLUE_800 = '#0F5FE0';
export const COLORS_V2_PRIMARY_TINTS_BLUE_900 = '#1169F9';

export const COLORS_V2_PRIMARY_SHADES_BLUE_50 = '#E8F0FF';
export const COLORS_V2_PRIMARY_SHADES_BLUE_100 = '#CFE1FE';
export const COLORS_V2_PRIMARY_SHADES_BLUE_200 = '#B8D2FE';
export const COLORS_V2_PRIMARY_SHADES_BLUE_300 = '#A0C3FD';
export const COLORS_V2_PRIMARY_SHADES_BLUE_400 = '#87B3FB';
export const COLORS_V2_PRIMARY_SHADES_BLUE_500 = '#70A5FB';
export const COLORS_V2_PRIMARY_SHADES_BLUE_600 = '#5996FB';
export const COLORS_V2_PRIMARY_SHADES_BLUE_700 = '#4187FA';
export const COLORS_V2_PRIMARY_SHADES_BLUE_800 = '#2978FA';
export const COLORS_V2_PRIMARY_SHADES_BLUE_900 = '#1169F9';

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
export const COLORS_V2_GRAY_12 = '#f9f9f9';
export const COLORS_V2_PRIMARY_FLAGRIGHTBLUE = '#1169f9';
export const COLORS_V2_HIGHLIGHT_FLAGRIGHTBLUE = '#f0f4fb';
export const COLORS_V2_HIGHLIGHT_HIGHLIGHT_STROKE = '#DFE6F2';
export const COLORS_V2_HIGHLIGHT_CARD_BACKGROUND = '#F8F9FA';

export const COLORS_V2_STATE_ACTIVE = COLORS_V2_PRIMARY_FLAGRIGHTBLUE;
export const COLORS_V2_STATE_HOVER = '#1555bb';
export const COLORS_V2_STATE_DISABLED = '#a8a8a8';
export const COLORS_V2_ALERT_CRITICAL = '#d42a2a';
export const COLORS_V2_ALERT_WARNING = '#efbe12';
export const COLORS_V2_ALERT_SUCCESS = '#1ba543';
export const COLORS_V2_ALERT_ERROR = '#f5222d';
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

export const COLORS_V2_ANALYTICS_CHARTS_01 = '#56BE9F';
export const COLORS_V2_ANALYTICS_CHARTS_02 = '#9269B8';
export const COLORS_V2_ANALYTICS_CHARTS_03 = '#89C9E9';
export const COLORS_V2_ANALYTICS_CHARTS_04 = '#586F9D';
export const COLORS_V2_ANALYTICS_CHARTS_05 = '#9A8DD6';
export const COLORS_V2_ANALYTICS_CHARTS_06 = '#69A5B8';
export const COLORS_V2_ANALYTICS_CHARTS_07 = '#6E94F2';
export const COLORS_V2_ANALYTICS_CHARTS_08 = '#C9A4CF';
export const COLORS_V2_ANALYTICS_CHARTS_09 = '#8AC9E9';
export const COLORS_V2_ANALYTICS_CHARTS_10 = '#B57DBE';
export const COLORS_V2_ANALYTICS_CHARTS_11 = '#519898';
export const COLORS_V2_ANALYTICS_CHARTS_12 = '#5C528D';
export const COLORS_V2_ANALYTICS_CHARTS_13 = '#687695';
export const COLORS_V2_ANALYTICS_CHARTS_14 = COLORS_V2_PRIMARY_SHADES_BLUE_300;
export const COLORS_V2_ANALYTICS_CHARTS_15 = '#9369B8';
export const COLORS_V2_ANALYTICS_CHARTS_16 = '#C396CE';
export const COLORS_V2_ANALYTICS_CHARTS_17 = '#D3DFFA';
export const COLORS_V2_ANALYTICS_CHARTS_18 = '#D4D1FA';
export const COLORS_V2_ANALYTICS_CHARTS_19 = '#EFC34F';
export const COLORS_V2_ANALYTICS_CHARTS_20 = '#F2A25F';
export const COLORS_V2_ANALYTICS_CHARTS_21 = COLORS_V2_PRIMARY_TINTS_BLUE_900;
export const COLORS_V2_ANALYTICS_CHARTS_22 = COLORS_V2_PRIMARY_SHADES_BLUE_600;
export const COLORS_V2_ANALYTICS_CHARTS_23 = '#6E94F3';
export const COLORS_V2_ANALYTICS_CHARTS_24 = COLORS_V2_PRIMARY_SHADES_BLUE_900;
export const COLORS_V2_ANALYTICS_CHARTS_25 = '#4D99FF';
export const COLORS_V2_ANALYTICS_CHARTS_26 = '#90C4FF';
export const COLORS_V2_ANALYTICS_CHARTS_27 = '#B3D8FF';
export const COLORS_V2_ANALYTICS_CHARTS_28 = '#1169F9';
export const COLORS_V2_ANALYTICS_CHARTS_29 = '#B763C5';

export const ALL_CHART_COLORS = [
  COLORS_V2_ANALYTICS_CHARTS_01,
  COLORS_V2_ANALYTICS_CHARTS_02,
  COLORS_V2_ANALYTICS_CHARTS_03,
  COLORS_V2_ANALYTICS_CHARTS_04,
  COLORS_V2_ANALYTICS_CHARTS_05,
  COLORS_V2_ANALYTICS_CHARTS_06,
  COLORS_V2_ANALYTICS_CHARTS_07,
  COLORS_V2_ANALYTICS_CHARTS_08,
  COLORS_V2_ANALYTICS_CHARTS_09,
  COLORS_V2_ANALYTICS_CHARTS_10,
  COLORS_V2_ANALYTICS_CHARTS_11,
  COLORS_V2_ANALYTICS_CHARTS_12,
  COLORS_V2_ANALYTICS_CHARTS_13,
  COLORS_V2_ANALYTICS_CHARTS_14,
  COLORS_V2_ANALYTICS_CHARTS_15,
  COLORS_V2_ANALYTICS_CHARTS_16,
  COLORS_V2_ANALYTICS_CHARTS_17,
  COLORS_V2_ANALYTICS_CHARTS_18,
  COLORS_V2_ANALYTICS_CHARTS_19,
  COLORS_V2_ANALYTICS_CHARTS_20,
  COLORS_V2_ANALYTICS_CHARTS_21,
  COLORS_V2_ANALYTICS_CHARTS_22,
  COLORS_V2_ANALYTICS_CHARTS_23,
  COLORS_V2_ANALYTICS_CHARTS_24,
  COLORS_V2_ANALYTICS_CHARTS_25,
  COLORS_V2_ANALYTICS_CHARTS_26,
  COLORS_V2_ANALYTICS_CHARTS_27,
];

export const COLORS_V2_AI_RISK_DISPLAY_BACKGROUND =
  'linear-gradient(144deg, rgba(72, 40, 222, 0.06) 0%, rgba(219, 23, 176, 0.06) 100%), #FFF';

export const COLORS_V2_SKELETON_COLOR = COLORS_V2_GRAY_3;

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
