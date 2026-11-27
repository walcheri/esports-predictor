import { z } from "zod";
const team = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  logo: z.string().url().nullable(),
});
export const matchSchema = z.object({
  id: z.string().regex(/^pandascore:[1-9]\d*$/),
  providerId: z.string(),
  game: z.enum(["cs2", "dota2", "lol", "valorant"]),
  team1: team.nullable(),
  team2: team.nullable(),
  tournament: z.string().nullable(),
  tournamentId: z.string().nullable(),
  startsAt: z.string().datetime().nullable(),
  endedAt: z.string().datetime().nullable(),
  bestOf: z.union([z.literal(1), z.literal(3), z.literal(5)]).nullable(),
  status: z.enum(["upcoming", "live", "finished", "cancelled", "unknown"]),
  winnerId: z.string().nullable(),
  games: z.array(
    z.object({
      id: z.string(),
      map: z.string().nullable(),
      winnerId: z.string(),
      endedAt: z.string().datetime(),
    }),
  ),
  provenance: z.object({
    provider: z.enum(["pandascore", "opendota", "grid"]),
    sourceId: z.string(),
    obtainedAt: z.string().datetime(),
    availableAt: z.string().datetime(),
    verification: z.enum(["provider_observed", "synthetic", "conflict"]),
    completeness: z.enum(["complete", "partial"]),
    sampleSize: z.number().int().nonnegative(),
  }),
});
export const catalogueSchema = z.object({
  matches: z.array(matchSchema),
  partial: z.literal(true),
  rejected: z.number(),
  conflicts: z.number(),
  obtainedAt: z.string().datetime(),
});
export type DisplayMatch = z.infer<typeof matchSchema>;
export const displayTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Moscow",
      }).format(new Date(value)) + " МСК"
    : "Время не подтверждено";
export const statusLabel = {
  upcoming: "Предстоящий",
  live: "Live",
  finished: "Завершён",
  cancelled: "Отменён",
  unknown: "Статус не подтверждён",
};
