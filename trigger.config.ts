import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "replace-with-trigger-project-ref",
  dirs: ["./trigger"],
  maxDuration: 1800
});
