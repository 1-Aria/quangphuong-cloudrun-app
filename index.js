import express from "express";
import cors from "cors";
import { verifyApiKey } from "./middlewares/verifyApiKey.js";
import maintenanceRouter from "./routes/maintenance.js";

const app = express();
app.use(cors());
app.use(express.json());

// Check key globally
app.use(verifyApiKey);

// Routes
app.use("/maintenance", maintenanceRouter);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));