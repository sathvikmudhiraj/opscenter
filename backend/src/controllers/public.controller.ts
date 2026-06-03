import { getPublicAssetVerification } from "../services/asset.service";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";

export const getPublicAsset = asyncHandler(async (req, res) => {
  const assetId = String(req.params.assetId || "").trim();
  if (!assetId) {
    throw new HttpError(400, "Asset ID is required");
  }

  const asset = await getPublicAssetVerification(assetId);
  if (!asset) {
    throw new HttpError(404, "Asset not found");
  }

  res.json({ data: asset });
});
