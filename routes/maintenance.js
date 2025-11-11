import express from "express";
import { handleMaintenanceAction } from "../controllers/maintenanceController.js";

const router = express.Router();

// POST /maintenance
router.post("/", handleMaintenanceAction);

export default router;
