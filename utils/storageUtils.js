import { bucket } from "../src/config/firebase.js";

export async function uploadFile(path, content) {
  const file = bucket.file(path);
  await file.save(content);
  return `gs://${bucket.name}/${path}`;
}
