import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

async function gotoRoster(page: import("@playwright/test").Page) {
  await page
    .locator("nav")
    .getByRole("link", { name: "Sales排班", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sales排班", exact: true }),
  ).toBeVisible();
}

test("Sales阿頭用編輯popup管理Team/Sale，自動排班及每格可改", async ({
  page,
}) => {
  await page.goto("/");
  await switchRole(page, "Don A DN（測試碼）");
  await gotoRoster(page);
  const locationPanel = page.locator(".sales-sheet-panel").first();
  const salesPanel = page.locator(".sales-sheet-panel").nth(1);
  await expect(
    page.locator(".sales-member-row").filter({ hasText: "Don A DN" }),
  ).toHaveCount(0);

  await locationPanel.getByRole("button", { name: "編輯", exact: true }).click();
  const teamDialog = page.getByRole("dialog", { name: "編輯Team" });
  await teamDialog.getByRole("button", { name: "Team", exact: true }).click();
  await expect(
    page.locator(".sales-location-name").filter({ hasText: "D" }),
  ).toHaveCount(1);
  await teamDialog.getByRole("button", { name: "刪除 Team D" }).click();
  await expect(
    page.locator(".sales-location-name").filter({ hasText: "D" }),
  ).toHaveCount(0);
  await teamDialog.getByRole("button", { name: "完成", exact: true }).click();

  const teamARow = page.locator(".sales-location-grid tbody tr").first();
  await teamARow.getByRole("button", { name: "+ 新增地方" }).click();
  const locationDialog = page.getByRole("dialog", {
    name: /新增 Team A 地點/,
  });
  await expect(locationDialog.locator("select")).toHaveCount(0);
  await locationDialog.getByLabel("工作地點").fill("恒安");
  await locationDialog.getByLabel("開始日期").fill("2026-10-01");
  await locationDialog.getByLabel("結束日期").fill("2026-10-03");
  await locationDialog
    .getByRole("button", { name: "儲存地點", exact: true })
    .click();
  await expect(teamARow).toContainText("恒安");
  await expect(
    teamARow.getByRole("button", { name: "恒安", exact: true }),
  ).toHaveCount(1);

  await salesPanel.getByRole("button", { name: "編輯", exact: true }).click();
  const salesDialog = page.getByRole("dialog", { name: "編輯Sales" });
  await salesDialog.getByLabel("新成員名稱").fill("Karen");
  await salesDialog.getByLabel("新成員類型").selectOption("sales");
  await salesDialog.getByLabel("新成員Team").selectOption("A");
  await salesDialog
    .getByRole("button", { name: "新增並自動排班", exact: true })
    .click();
  await salesDialog.getByRole("button", { name: "完成", exact: true }).click();
  const memberRow = page
    .locator(".sales-member-row")
    .filter({ hasText: "Karen" });
  await expect(memberRow).toBeVisible();
  await expect(memberRow.locator('button[data-assignment="OFF"]')).toHaveCount(
    5,
  );
  expect(
    await memberRow.locator('button[data-shift="early"]').count(),
  ).toBeGreaterThanOrEqual(10);

  const firstCell = page.getByRole("button", {
    name: "Karen 2026-10-01 更表",
  });
  await firstCell.click();
  const cellDialog = page.getByRole("dialog", {
    name: "Karen · 2026-10-01 更表",
  });
  await cellDialog.getByLabel("更份").selectOption("ph");
  await cellDialog.getByRole("button", { name: "儲存", exact: true }).click();
  await expect(firstCell).toHaveAttribute("data-assignment", "PH");
  await expect(firstCell).toHaveText("補");

  await page.reload();
  await expect(
    page.locator(".sales-member-row").filter({ hasText: "Karen" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Karen 2026-10-01 更表" }),
  ).toHaveAttribute("data-assignment", "PH");

  await salesPanel.getByRole("button", { name: "編輯", exact: true }).click();
  await salesDialog.getByRole("button", { name: "刪除 Karen" }).click();
  await expect(
    page.locator(".sales-member-row").filter({ hasText: "Karen" }),
  ).toHaveCount(0);
});

test("普通Sales只讀，沒有編輯按鈕", async ({ page }) => {
  await page.goto("/");
  await switchRole(page, "嘉嘉B KK");
  await page
    .locator("nav")
    .getByRole("link", { name: "我的排班", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "我的排班", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".sales-sheet-head").getByRole("button", { name: "編輯" }),
  ).toHaveCount(0);
  await expect(page.locator(".sales-sheet-legend")).toHaveCount(0);
});

test("舊localStorage未有排班欄位仍可自動migration，不會爆filter錯誤", async ({
  page,
}) => {
  await page.goto("/");
  await switchRole(page, "Don A DN（測試碼）");
  await gotoRoster(page);
  const locationPanel = page.locator(".sales-sheet-panel").first();
  await locationPanel.getByRole("button", { name: "編輯", exact: true }).click();
  await page.getByRole("dialog", { name: "編輯Team" })
    .getByRole("button", { name: "Team", exact: true })
    .click();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("homeflow-state-v1")!),
  );
  delete state.salesMonthlyTeams;
  delete state.salesTeamLocations;
  delete state.salesShifts;
  delete state.salesRosterTeams;
  delete state.salesRosterMembers;
  await page.evaluate((next) => {
    localStorage.setItem("homeflow-state-v1", JSON.stringify(next));
  }, state);
  await page.reload();
  await expect(
    page.getByText("原型遇到問題", { exact: false }),
  ).toHaveCount(0);
  await gotoRoster(page);
});
