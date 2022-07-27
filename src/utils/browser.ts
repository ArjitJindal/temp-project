export async function copyTextToClipboard(text: string) {
  if (!navigator.clipboard) {
    // todo: i18n
    throw new Error(`Sorry, you browser doesn't support this operation`);
  }
  await navigator.clipboard.writeText(text);
}
