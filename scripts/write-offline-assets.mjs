import { fileURLToPath } from "node:url";
import { prepareOfflineAssets } from "./offline-assets.mjs";

const { cacheName, assets } = await prepareOfflineAssets(fileURLToPath(new URL("../dist/", import.meta.url)));
console.log(`Prepared ${assets.length} offline assets (${cacheName})`);
