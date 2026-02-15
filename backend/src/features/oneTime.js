export function isOneTime(share) {
  return Number(share.one_time || 0) === 1;
}
