function isQAConsoleUrl(url: string): boolean {
  return url.includes('https://qa') && url.includes('.console.flagright.dev/');
}

export function checkQAUrl(): boolean {
  const currentUrl = window.location.href;
  return isQAConsoleUrl(currentUrl);
}
