import { test, expect, type BrowserContext } from "@playwright/test";
import { normalizePanda } from "../supabase/functions/_shared/data.ts";
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "test@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  email_confirmed_at: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
  app_metadata: {},
  user_metadata: {},
};
const match = normalizePanda(
  {
    id: 1,
    videogame: { slug: "csgo" },
    opponents: [
      { opponent: { id: 1, name: "Fixture A" } },
      { opponent: { id: 2, name: "Fixture B" } },
    ],
    status: "not_started",
    scheduled_at: "2027-01-01T00:00:00Z",
    number_of_games: 3,
  },
  "2026-11-26T00:00:00Z",
);
test.beforeEach(async ({ context }) => {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" && url.port === "8080")
      return route.continue();
    if (url.hostname !== "offline.invalid") return route.abort();
    let body: unknown = {};
    if (url.pathname.includes("/auth/v1/user")) body = user;
    else if (url.pathname.includes("/rest/v1/profiles"))
      body = {
        ...user,
        username: "Fixture",
        avatar_url: null,
        predictions_count: 0,
      };
    else if (url.pathname.endsWith("/fetch-matches"))
      body = {
        matches: [match],
        partial: true,
        rejected: 0,
        conflicts: 0,
        obtainedAt: match.provenance.obtainedAt,
      };
    else if (url.pathname.endsWith("/fetch-match-details")) body = { match };
    else if (url.pathname.endsWith("/generate-prediction"))
      body = {
        status: "INSUFFICIENT_DATA",
        reason: "VERIFIED_HISTORICAL_DATASET_AND_MODEL_REQUIRED",
        probability: null,
      };
    else if (url.pathname.includes("/rest/v1/predictions")) body = [];
    else
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "OFFLINE_ONLY" }),
      });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
      headers: { "access-control-allow-origin": "*" },
    });
  });
});
async function login(context: BrowserContext) {
  await context.addInitScript(
    ({ user }) => {
      const payload = btoa(
        JSON.stringify({
          sub: user.id,
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      );
      localStorage.setItem(
        "sb-offline-auth-token",
        JSON.stringify({
          access_token: `e30.${payload}.offline`,
          refresh_token: "offline-only",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: "bearer",
          user,
        }),
      );
    },
    { user },
  );
}
test("guest sees honest catalogue gate and no fabricated counts", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Каталог и проверяемость данных")).toHaveCount(4);
  await page.getByRole("link", { name: "Матчи", exact: true }).click();
  await expect(page.getByText("Войдите для доступа к каталогу.")).toBeVisible();
});
test("authenticated partial catalogue, details and mobile layout", async ({
  page,
  context,
}) => {
  await login(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/matches");
  await expect(page.getByText(/Частичная выборка/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Fixture A — Fixture B" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Данные матча →" }).click();
  await expect(page.getByText(/INSUFFICIENT_DATA/)).toBeVisible();
  await expect(page.getByText(/2027/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Почему нет вероятности?" }).click();
  await expect(page.getByText(/Прогноз не сформирован:/)).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/mobile-match.png",
    fullPage: true,
  });
});
test("provider error is visible instead of a zero-match success", async ({
  page,
  context,
}) => {
  await login(context);
  await page.route("**/functions/v1/fetch-matches", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"error":"BUDGET_EXHAUSTED"}',
    }),
  );
  await page.goto("/matches");
  await expect(page.getByText(/Лимит запросов исчерпан/)).toBeVisible();
});

test("late match response cannot replace a different selected event", async ({
  page,
  context,
}) => {
  await login(context);
  let release: () => void = () => {};
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started: () => void = () => {};
  const requested = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route("**/functions/v1/fetch-match-details", async (route) => {
    const id = route.request().postDataJSON().matchId;
    if (id === "pandascore:1") {
      started();
      await hold;
    }
    const selected =
      id === "pandascore:1"
        ? match
        : {
            ...match,
            id: "pandascore:2",
            providerId: "2",
            team1: { ...match.team1!, name: "New event" },
          };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ match: selected }),
    });
  });
  await page.goto("/match/pandascore:1");
  await requested;
  await page.evaluate(() => {
    history.pushState({}, "", "/match/pandascore:2");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(
    page.getByRole("heading", { name: "New event — Fixture B" }),
  ).toBeVisible();
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/fetch-match-details") &&
      r.request().postDataJSON().matchId === "pandascore:1",
  );
  release();
  await response;
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await expect(
    page.getByRole("heading", { name: "New event — Fixture B" }),
  ).toBeVisible();
});
test("logout ignores late profile fetch and clears private view", async ({
  page,
  context,
}) => {
  await login(context);
  let release: () => void = () => {};
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started: () => void = () => {};
  const requested = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route("**/rest/v1/profiles*", async (route) => {
    started();
    await hold;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...user, username: "Late private profile" }),
    });
  });
  await page.route("**/auth/v1/logout*", (route) =>
    route.fulfill({ status: 204 }),
  );
  await page.goto("/");
  await requested;
  await page.getByRole("button", { name: "Открыть профиль" }).click();
  await page.getByRole("menuitem", { name: "Выйти" }).click();
  const profileResponse = page.waitForResponse((r) =>
    r.url().includes("/rest/v1/profiles"),
  );
  release();
  await profileResponse;
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await expect(
    page.getByRole("button", { name: "Войти", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Late private profile")).toHaveCount(0);
});
test("Premium is a waitlist, not an active paid offer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Premium", exact: true }).click();
  await expect(page.getByText(/Premium пока не продаётся/)).toBeVisible();
  await expect(page.getByText(/скидку 50%/)).toHaveCount(0);
});

test("registration confirmation uses mocked Auth and never sends real email", async ({
  page,
}) => {
  await page.route("**/auth/v1/signup*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...user, email_confirmed_at: null }),
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page
    .getByRole("button", { name: "Нет аккаунта? Зарегистрируйтесь" })
    .click();
  await page.getByLabel("Email", { exact: true }).fill("test@example.invalid");
  await page
    .getByLabel("Пароль", { exact: true })
    .fill("offline-test-password");
  await page
    .getByRole("button", { name: "Зарегистрироваться", exact: true })
    .click();
  await expect(
    page.getByText("Перейдите по ссылке в письме, чтобы активировать аккаунт"),
  ).toBeVisible();
});
test("private history shows an explicitly unverified empty archive", async ({
  page,
  context,
}) => {
  await login(context);
  await page.goto("/profile?tab=history");
  await expect(page.getByText(/Архив прежних LLM-прогнозов/)).toBeVisible();
  await expect(
    page.getByText(/достоверность процентов не подтверждена/),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/desktop-profile.png",
    fullPage: true,
  });
});
test("guest waitlist submits only validated email to non-enumerating RPC", async ({
  page,
}) => {
  let submitted: unknown;
  await page.route("**/rest/v1/rpc/join_waitlist", (route) => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ status: 204 });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Premium", exact: true }).click();
  await page.getByPlaceholder("Введите email").fill("guest@example.invalid");
  await page.getByRole("button", { name: "Хочу Premium первым!" }).click();
  await expect(page.getByText("Вы в списке!", { exact: true })).toBeVisible();
  expect(submitted).toEqual({ p_email: "guest@example.invalid" });
});
