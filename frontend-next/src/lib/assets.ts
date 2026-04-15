export const blobToDataUri = async (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo convertir archivo a Data URI."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(blob);
  });

export const loadAssetDataUri = async (assetPath: string): Promise<string> => {
  const response = await fetch(assetPath, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`No se pudo cargar asset: ${assetPath}`);
  }

  const blob = await response.blob();
  return blobToDataUri(blob);
};
