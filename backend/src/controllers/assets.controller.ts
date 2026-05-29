import { asyncHandler } from "../utils/asyncHandler";
import { assignAsset as assignAssetService, createAsset as createAssetService, createAssetRequest, decideAssetRequest as decideAssetRequestService, deleteAsset as deleteAssetService, listAssetRequests, listAssets, updateAsset as updateAssetService } from "../services/asset.service";
import { z } from "zod";

const assetSchema = z.object({
  assetTag: z.string().min(2),
  assetName: z.string().min(2),
  category: z.string().min(2),
  type: z.string().min(2),
  status: z.string().min(2),
  lifecycleState: z.enum(["Available", "Assigned", "Under Repair", "Retired"]).optional(),
  brand: z.string().min(2),
  model: z.string().min(2),
  serialNumber: z.string().min(2),
  purchaseDate: z.string().optional(),
  warrantyExpiry: z.string().optional(),
  department: z.string().min(1),
  block: z.string().min(1),
  room: z.string().min(1),
  assignedTo: z.coerce.number().nullable().optional(),
  processor: z.string().optional(),
  ram: z.string().optional(),
  storage: z.string().optional(),
  operatingSystem: z.string().optional()
});

const assetUpdateSchema = assetSchema.partial();
const assetAssignSchema = z.object({ employeeId: z.coerce.number().int().positive() });
const requestDecisionSchema = z.object({ status: z.enum(["approved", "rejected"]) });

export const getAssets = asyncHandler(async (_req, res) => {
  res.json({ data: await listAssets() });
});

export const requestAsset = asyncHandler(async (req, res) => {
  await createAssetRequest({ requesterId: req.user!.sub, assetType: req.body.assetType, justification: req.body.justification });
  res.status(201).json({ message: "Asset request accepted" });
});

export const createAsset = asyncHandler(async (req, res) => {
  const input = assetSchema.parse(req.body);
  res.status(201).json({ message: "Asset created", data: await createAssetService({ ...input, actorId: req.user!.sub }) });
});

export const updateAsset = asyncHandler(async (req, res) => {
  const input = assetUpdateSchema.parse(req.body);
  await updateAssetService({ id: Number(req.params.id), ...input, actorId: req.user!.sub });
  res.json({ message: "Asset updated" });
});

export const assignAsset = asyncHandler(async (req, res) => {
  const input = assetAssignSchema.parse(req.body);
  await assignAssetService({ id: Number(req.params.id), employeeId: input.employeeId, actorId: req.user!.sub });
  res.json({ message: "Asset assigned" });
});

export const deleteAsset = asyncHandler(async (req, res) => {
  await deleteAssetService({ id: Number(req.params.id), actorId: req.user!.sub });
  res.json({ message: "Asset deleted" });
});

export const getAssetRequests = asyncHandler(async (_req, res) => {
  res.json({ data: await listAssetRequests() });
});

export const decideAssetRequest = asyncHandler(async (req, res) => {
  const input = requestDecisionSchema.parse(req.body);
  await decideAssetRequestService({ id: Number(req.params.id), status: input.status, actorId: req.user!.sub });
  res.json({ message: `Asset request ${input.status}` });
});
