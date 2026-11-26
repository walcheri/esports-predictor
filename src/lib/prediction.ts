import { z } from "zod";
export const predictionSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("INSUFFICIENT_DATA"),
    reason: z.string().min(1),
    probability: z.null(),
  }),
  z.object({
    status: z.literal("PROVIDER_DISABLED"),
    reason: z.string().min(1),
    probability: z.null(),
  }),
]);
// No production OK variant until a reviewed model and server-side immutable history exist.
export const errorLabels: Record<string, string> = {
  EXTERNAL_DATA_DISABLED: "Источник отключён до проверки (PROVIDER_DISABLED).",
  PROVIDER_NOT_CONFIGURED: "Источник не настроен (PROVIDER_DISABLED).",
  BUDGET_EXHAUSTED: "Лимит запросов исчерпан. Повторите позже.",
  AUTH_REQUIRED: "Для этого действия требуется вход.",
  AUTH_INVALID: "Сеанс истёк. Войдите снова.",
  PROVIDER_UNAVAILABLE: "Поставщик временно недоступен.",
};
export async function failureMessage(error: unknown): Promise<string> {
  if (
    error &&
    typeof error === "object" &&
    "context" in error &&
    error.context instanceof Response
  ) {
    try {
      const body = await error.context.clone().json();
      if (
        typeof body?.error === "string" &&
        Object.prototype.hasOwnProperty.call(errorLabels, body.error)
      )
        return errorLabels[body.error];
    } catch {
      /* Fixed safe fallback; never display provider body. */
    }
  }
  return "Данные недоступны: источник отключён, лимит исчерпан или ответ не прошёл проверку.";
}
