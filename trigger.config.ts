import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_wprkfwzuaonbokhfsktk",
  dirs: ["./trigger"],
  maxDuration: 1800
});
