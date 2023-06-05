export type UiSettingsType = {
  title: string;
  key: string;
  cards: {
    [key: string]: {
      title: string;
      key: string;
    };
  };
};
