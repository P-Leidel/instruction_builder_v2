import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// Vercel serves this app at the domain root.
export default defineConfig({
  base: "/",
  plugins: [preact()],
  build: {
    // Keep the previous Vite 5 bundle target while upgrading the build tooling.
    target: ["es2020", "edge88", "firefox78", "chrome87", "safari14"],
  },
});
