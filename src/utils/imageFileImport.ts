export type ImageImportFailureReason = 'empty' | 'not-image';

export interface ImageImportSelection {
  file: File | null;
  reason: ImageImportFailureReason | null;
}

const isImageFile = (file: File | null): file is File =>
  file !== null && typeof file.type === 'string' && file.type.startsWith('image/');

export const pickImageFromFileList = (files: FileList | null): ImageImportSelection => {
  if (!files || files.length === 0) {
    return {
      file: null,
      reason: 'empty'
    };
  }

  const file = typeof files.item === 'function'
    ? files.item(0)
    : (files[0] ?? null);
  if (!isImageFile(file)) {
    return {
      file: null,
      reason: 'not-image'
    };
  }

  return {
    file,
    reason: null
  };
};

const pickImageFromDataTransferItems = (items: DataTransferItemList | null): ImageImportSelection => {
  if (!items || items.length === 0) {
    return {
      file: null,
      reason: 'empty'
    };
  }

  for (const item of Array.from(items)) {
    if (item.kind !== 'file') {
      continue;
    }

    const file = item.getAsFile();
    if (isImageFile(file)) {
      return {
        file,
        reason: null
      };
    }
  }

  return {
    file: null,
    reason: 'not-image'
  };
};

export const pickImageFromDataTransfer = (dataTransfer: DataTransfer | null): ImageImportSelection => {
  if (!dataTransfer) {
    return {
      file: null,
      reason: 'empty'
    };
  }

  const fromItems = pickImageFromDataTransferItems(dataTransfer.items ?? null);
  if (fromItems.file) {
    return fromItems;
  }

  if (fromItems.reason === 'not-image') {
    return fromItems;
  }

  return pickImageFromFileList(dataTransfer.files ?? null);
};

export const pickImageFromClipboard = (clipboardData: DataTransfer | null): ImageImportSelection =>
  pickImageFromDataTransfer(clipboardData);
