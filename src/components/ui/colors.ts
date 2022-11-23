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
};

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
