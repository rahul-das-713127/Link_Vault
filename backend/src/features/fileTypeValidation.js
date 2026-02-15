export function createFileTypeValidator({ allowedMimeTypes }) {
  function isAllowedMimeType(mimeType) {
    if (!allowedMimeTypes.length) return true;
    return allowedMimeTypes.includes(mimeType);
  }

  return { isAllowedMimeType };
}
