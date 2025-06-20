import { eruda, mockWebxdc } from "@webxdc/vite-plugins";
import preact from "@preact/preset-vite";
import Icons from "unplugin-icons/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

import { defineConfig } from "vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    preact(),
    viteSingleFile(),
    Icons({ compiler: "jsx", jsx: "react" }),
    eruda(),
    mockWebxdc(),
  ],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
});
