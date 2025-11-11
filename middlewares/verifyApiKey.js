// middlewares/verifyApiKey.js
export function verifyApiKey(req, res, next) {
  const clientKey = req.header("x-api-key");
  const serverKey = process.env.API_KEY;

  if (!clientKey || clientKey !== serverKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}
