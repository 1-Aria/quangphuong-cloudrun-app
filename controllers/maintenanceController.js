import { db } from "../src/config/firebase.js";
import { uploadFile } from "../utils/storageUtils.js";

export const handleMaintenanceAction = async (req, res) => {
  const { action, data } = req.body;

  try {
    switch (action) {
      case "register_incident":
        await db.collection("incidents").add({
          ...data,
          createdAt: new Date().toISOString(),
        });
        return res.json({ success: true, message: "Incident registered." });

      case "close_incident":
        // logic example
        return res.json({ success: true, message: "Incident closed." });

      default:
        return res.status(400).json({ error: "Unknown action." });
    }
  } catch (error) {
    console.error("Maintenance error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};
