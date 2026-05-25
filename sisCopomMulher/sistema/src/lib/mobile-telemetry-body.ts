import { z } from "zod";

export const mobileTelemetryBodySchema = z.object({
  kind: z.enum(["LOCATION", "PANIC"]),
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  accuracyM: z.number().finite().optional().nullable(),
  altitude: z.number().finite().optional().nullable(),
  speed: z.number().finite().optional().nullable(),
  heading: z.number().finite().optional().nullable(),
});
