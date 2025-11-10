import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Simple environment-based API key (you can store this securely in GCP later)
const API_KEY = process.env.API_KEY || "my-secret-key";
console.log("API_KEY:", API_KEY);

app.post("/maintenance", (req, res) => {
  const requestKey = req.header("x-api-key");
  
  // 1️⃣ Validate API key
  if (requestKey !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // 2️⃣ Extract action and data
  const { action, data } = req.body;

  console.log("Received maintenance request:", { action, data });

  // 3️⃣ Simple handler for now
  switch (action) {
    case "register_incident":
      // later: insert into Firestore or similar
      return res.json({
        message: "Incident registered successfully",
        received: data
      });

    default:
      return res.status(400).json({ error: "Unknown action" });
  }
});

app.get("/", (req, res) => {
  res.send("Cloud Run backend is active ✅");
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
