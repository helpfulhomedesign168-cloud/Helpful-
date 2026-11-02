import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

async function openDay(page: import("@playwright/test").Page, date: string) {
  await page.getByRole("button", { name: `${date} 排班`, exact: true }).click();
  return page.getByRole("dialog", { name: /排班$/ });
}

test("Sales阿頭可用月曆編排全部Team、月度Team及Team地點", async ({
  page,
}) => {
  await page.goto("/");
  await switchRole(page, "Don A DN（測試碼）");
  await page
    .locator("nav")
    .getByRole("link", { name: "Sales排班", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sales排班", exact: true }),
  ).toBeVisible();

  const monthlyTeam = page.getByLabel("文文B MM 本月Team");
  await monthlyTeam.selectOption("A");
  await expect(monthlyTeam).toHaveValue("A");
  await page
    .locator(".monthly-team-row")
    .filter({ hasText: "文文B MM" })
    .getByRole("button", { name: "套用", exact: true })
    .click();

  const dayOne = await openDay(page, "2026-10-01");
  await expect(
    dayOne.getByLabel("文文B MM 2026-10-01 排班"),
  ).toHaveValue("A");
  await dayOne.getByRole("button", { name: "關閉對話框" }).click();

  const dayFive = await openDay(page, "2026-10-05");
  await dayFive.getByLabel("文文B MM 2026-10-05 排班").selectOption("A");
  await dayFive.getByLabel("文文B MM 2026-10-05 更份").selectOption("early");
  await dayFive.getByRole("button", { name: "關閉對話框" }).click();

  const dayEight = await openDay(page, "2026-10-08");
  await dayEight.getByLabel("文文B MM 2026-10-08 排班").selectOption("PH");
  await dayEight.getByRole("button", { name: "關閉對話框" }).click();

  await page.getByRole("button", { name: "新增", exact: true }).click();
  const locationDialog = page.getByRole("dialog", { name: "新增Team地點" });
  await locationDialog.locator("select").selectOption("A");
  await locationDialog.getByLabel("工作地點", { exact: false }).fill("恒安");
  await locationDialog.getByLabel("開始日期", { exact: false }).fill("2026-10-01");
  await locationDialog.getByLabel("結束日期", { exact: false }).fill("2026-10-03");
  await locationDialog
    .getByRole("button", { name: "儲存地點", exact: true })
    .click();
  await expect(page.locator(".schedule-location-item")).toContainText("恒安");
  await expect(
    page.getByRole("button", { name: "2026-10-02 排班", exact: true }),
  ).toContainText("恒安");

  await page.reload();
  await expect(page.getByLabel("文文B MM 本月Team")).toHaveValue("A");
  const reloadedDayFive = await openDay(page, "2026-10-05");
  await expect(
    reloadedDayFive.getByLabel("文文B MM 2026-10-05 排班"),
  ).toHaveValue("A");
  await expect(
    reloadedDayFive.getByLabel("文文B MM 2026-10-05 更份"),
  ).toHaveValue("early");
  await reloadedDayFive.getByRole("button", { name: "關閉對話框" }).click();
  await expect(page.locator(".schedule-location-item")).toContainText("恒安");

  await switchRole(page, "嘉嘉B KK");
  await page
    .locator("nav")
    .getByRole("link", { name: "我的排班", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "我的排班", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".schedule-day select")).toHaveCount(0);
  const ownDay = await openDay(page, "2026-10-05");
  await expect(ownDay.locator("select")).toHaveCount(0);
});

test("舊localStorage未有排班欄位仍可自動migration，不會爆filter錯誤", async ({
  page,
}) => {
  await page.goto("/");
  await switchRole(page, "Don A DN（測試碼）");
  await page
    .locator("nav")
    .getByRole("link", { name: "Sales排班", exact: true })
    .click();
  const day = await openDay(page, "2026-10-05");
  await day.getByLabel("文文B MM 2026-10-05 排班").selectOption("A");
  await day.getByRole("button", { name: "關閉對話框" }).click();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("homeflow-state-v1")!),
  );
  delete state.salesMonthlyTeams;
  delete state.salesTeamLocations;
  delete state.salesShifts;
  await page.evaluate((next) => {
    localStorage.setItem("homeflow-state-v1", JSON.stringify(next));
  }, state);
  await page.reload();
  await expect(
    page.getByText("原型遇到問題", { exact: false }),
  ).toHaveCount(0);
  await page
    .locator("nav")
    .getByRole("link", { name: "Sales排班", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sales排班", exact: true }),
  ).toBeVisible();
});
