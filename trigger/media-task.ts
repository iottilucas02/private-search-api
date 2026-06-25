import { logger, task } from "@trigger.dev/sdk";

import { processMediaTask } from "@/lib/media-processor";
import { createServiceRoleClient } from "@/lib/supabase";

export const processMediaSearchTask = task({
  id: "process-media-search-task",
  queue: {
    concurrencyLimit: 3
  },
  retry: {
    maxAttempts: 2
  },
  run: async (payload: { taskId: string }) => {
    logger.info("Processing media search task", { taskId: payload.taskId });
    return processMediaTask(createServiceRoleClient(), payload.taskId);
  }
});
