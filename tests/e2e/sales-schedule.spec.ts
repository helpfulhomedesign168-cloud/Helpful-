import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("Sales阿頭可編排全部Team月度更表，普通Sales只讀自己排班", async ({
  page,
}) => {
  await page.goto("/");
  await switchRole(page, "Don A DN（測試碼）");
  await expect(
    page.locator("nav").getByRole("link", { name: "Sales排班", exact: true }),
  ).toBeVisible();
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
    .locator(".monthly-team-table tr")
    .filter({ hasText: "文文B MM" })
    .getByRole("button", { name: "套用全月", exact: true })
    .click();
  await expect(page.getByLabel("文文B MM 2026-10-01 排班")).toHaveValue("A");
  const shift = page.getByLabel("文文B MM 2026-10-05 排班");
  await shift.selectOption("A");
  await expect(shift).toHaveValue("A");
  await page.getByLabel("文文B MM 2026-10-05 更份").selectOption("early");
  await expect(page.getByLabel("文文B MM 2026-10-05 更份")).toHaveValue(
    "early",
  );
  await page.getByLabel("文文B MM 2026-10-08 排班").selectOption("PH");

  await page.getByRole("button", { name: "新增地點", exact: true }).click();
  const locationDialog = page.getByRole("dialog", { name: "新增Team地點" });
  await locationDialog.locator("select").selectOption("A");
  await locationDialog.getByLabel("工作地點", { exact: false }).fill("恒安");
  await locationDialog.getByLabel("開始日期", { exact: false }).fill("2026-10-01");
  await locationDialog.getByLabel("結束日期", { exact: false }).fill("2026-10-03");
  await locationDialog.getByRole("button", { name: "儲存地點", exact: true }).click();
  await expect(
    page.locator(".team-location-row").filter({ hasText: "Team A 地點" }),
  ).toContainText("恒安");
  await expect(
    page.locator(".roster-coverage td").nth(4),
  ).toContainText("1");

  await page.reload();
  await expect(page.getByLabel("文文B MM 2026-10-05 排班")).toHaveValue(
    "A",
  );
  await expect(page.getByLabel("文文B MM 本月Team")).toHaveValue("A");
  await expect(
    page.locator(".team-location-row").filter({ hasText: "Team A 地點" }),
  ).toContainText("恒安");

  await switchRole(page, "嘉嘉B KK");
  await expect(
    page.locator("nav").getByRole("link", { name: "我的排班", exact: true }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("link", { name: "我的排班", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "我的排班", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".sales-roster-table select")).toHaveCount(0);
  await expect(page.locator(".roster-person")).toHaveCount(1);
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
  await page.getByLabel("文文B MM 2026-10-05 排班").selectOption("A");
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
