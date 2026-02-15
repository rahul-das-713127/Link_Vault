export function isOverLimits(share) {
  const maxViews = share.max_views == null ? null : Number(share.max_views);
  const maxDownloads = share.max_downloads == null ? null : Number(share.max_downloads);
  const views = Number(share.view_count || 0);
  const downloads = Number(share.download_count || 0);
  if (maxViews != null && Number.isFinite(maxViews) && views >= maxViews) return true;
  if (maxDownloads != null && Number.isFinite(maxDownloads) && downloads >= maxDownloads) return true;
  return false;
}
