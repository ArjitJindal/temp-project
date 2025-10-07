export function formatNumber(number: number, showAllDecimals?: boolean) {
  return showAllDecimals ? number.toString() : number.toFixed(2)
}
