import express from "express";
import cors from "cors";
import { verifyApiKey } from "./middlewares/verifyApiKey.js";

const app = express();
app.use(cors());
app.use(express.json());

// Check key globally
app.use(verifyApiKey);

// Routes
app.use("/maintenance", maintenanceRouter);
app.use("/report", reportRouter);

app.use("/maintenance", maintenanceRoutes);

app.listen(8080, () => console.log("Server running on port 8080"));