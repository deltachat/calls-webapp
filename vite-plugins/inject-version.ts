import { Plugin } from "vite";
import { execSync } from "child_process";

function getVersion(): string {
  try {
    return execSync("git describe --tags", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

export default function injectVersion(): Plugin {
  const version = getVersion();

  return {
    name: "vite:version-inject",
    apply: "build",
    enforce: "post",
    generateBundle(_, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (fileName === "index.html" || fileName.endsWith("/index.html")) {
          const chunk: any = bundle[fileName];
          if (chunk.type === "asset" && typeof chunk.source === "string") {
            if (chunk.source.includes("<head>")) {
              const script = `<script>console.log("version: ${version}");</script>`;
              chunk.source = chunk.source.replace("<head>", `<head>${script}`);
            } else {
              chunk.source = `<!-- version: ${version} -->` + chunk.source;
            }
          }
        }
      }
    },
  };
}
