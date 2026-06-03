import { asyncHandler } from "../utils/asyncHandler";
import {
  createInfrastructureService,
  deleteInfrastructureService,
  getInfrastructureServices,
  updateInfrastructureService
} from "../services/infrastructureServices.service";

export const listInfrastructureServices = asyncHandler(async (_req, res) => {
  res.json(await getInfrastructureServices());
});

export const postInfrastructureService = asyncHandler(async (req, res) => {
  res.status(201).json(await createInfrastructureService({ actorId: req.user!.sub, values: req.body }));
});

export const putInfrastructureService = asyncHandler(async (req, res) => {
  res.json(await updateInfrastructureService({ actorId: req.user!.sub, id: String(req.params.id), values: req.body }));
});

export const removeInfrastructureService = asyncHandler(async (req, res) => {
  res.json(await deleteInfrastructureService({ actorId: req.user!.sub, id: String(req.params.id) }));
});
