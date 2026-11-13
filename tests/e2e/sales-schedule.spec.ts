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
  await expect(locationDialog.getByLabel("開始日期")).toHaveCount(1);
  await locationDialog.getByLabel("工作地點").fill("恒安");
  await locationDialog.getByLabel("開始日期").click();
  await locationDialog
    .getByRole("button", { name: "2026-10-01" })
    .click();
  await locationDialog.getByLabel("結束日期").click();
  await locationDialog
    .getByRole("button", { name: "2026-10-03" })
    .click();
  await locationDialog
    .getByRole("button", { name: "儲存地點", exact: true })
    .click();
  await expect(teamARow).toContainText("恒安");
  await expect(
    teamARow.getByRole("button", { name: "恒安", exact: true }),
  ).toHaveCount(1);
  // New location defaults to the first free day after 1-3, and already
  // arranged dates are disabled in the end-date picker.
  await teamARow.getByRole("button", { name: "+ 新增地方" }).click();
  await expect(locationDialog.getByLabel("開始日期")).toContainText(
    "2026/10/04",
  );
  await locationDialog.getByLabel("結束日期").click();
  await expect(
    locationDialog.getByRole("button", { name: "2026-10-01" }),
  ).toBeDisabled();
  await expect(
    locationDialog.getByRole("button", { name: "2026-10-03" }),
  ).toBeDisabled();
  await expect(
    locationDialog.getByRole("button", { name: "2026-10-04" }),
  ).toBeEnabled();
  await expect(
    locationDialog.getByRole("button", { name: "返回", exact: true }),
  ).toBeVisible();
  await expect(
    locationDialog.getByRole("button", { name: "取消地點", exact: true }),
  ).toBeDisabled();
  await locationDialog.getByRole("button", { name: "返回", exact: true }).click();

  await salesPanel.getByRole("button", { name: "編輯", exact: true }).click();
  const salesDialog = page.getByRole("dialog", { name: "編輯Sales" });
  await expect(salesDialog.getByLabel("新成員類型")).toHaveCount(0);
  await salesDialog
    .getByLabel("新成員名稱")
    .selectOption("supervisor-sh");
  await expect(
    salesDialog.getByLabel("新成員名稱").locator("option:checked"),
  ).toHaveText("世雄B SH - Sales主管");
  await salesDialog.getByLabel("新成員Team").selectOption("A");
  await salesDialog
    .getByRole("button", { name: "新增並自動排班", exact: true })
    .click();
  await salesDialog.getByRole("button", { name: "完成", exact: true }).click();
  const memberRow = page
    .locator(".sales-member-row")
    .filter({ hasText: "世雄B SH" });
  await expect(memberRow).toBeVisible();
  await expect(memberRow.locator('button[data-assignment="OFF"]')).toHaveCount(
    5,
  );
  expect(
    await memberRow.locator('button[data-shift="early"]').count(),
  ).toBeGreaterThanOrEqual(10);

  const firstCell = memberRow.getByRole("button", {
    name: "世雄B SH 2026-10-01 更表",
  });
  await firstCell.click();
  const cellDialog = page.getByRole("dialog", {
    name: "世雄B SH · 2026-10-01 更表",
  });
  await cellDialog.getByLabel("更份").selectOption("ph");
  await cellDialog.getByRole("button", { name: "儲存", exact: true }).click();
  await expect(firstCell).toHaveAttribute("data-assignment", "PH");
  await expect(firstCell).toHaveText("補");

  await page.reload();
  await expect(
    page.locator(".sales-member-row").filter({ hasText: "世雄B SH" }),
  ).toBeVisible();
  await expect(
    page
      .locator(".sales-member-row")
      .filter({ hasText: "世雄B SH" })
      .getByRole("button", { name: "世雄B SH 2026-10-01 更表" }),
  ).toHaveAttribute("data-assignment", "PH");

  await salesPanel.getByRole("button", { name: "編輯", exact: true }).click();
  await salesDialog.getByRole("button", { name: "刪除 世雄B SH" }).click();
  await expect(
    page.locator(".sales-member-row").filter({ hasText: "世雄B SH" }),
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

test("Sales阿頭設定開會日會全員上班並以淺紅顯示", async ({ page }) => {
  await page.goto("/");
  await switchRole(page, "Don A DN（測試碼）");
  await gotoRoster(page);
  await expect(
    page.locator(".sales-roster-grid thead").getByText("日期", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("選擇開會日").selectOption("2026-10-02");
  await page.getByRole("button", { name: "設為開會日", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "取消開會日 2026-10-02" }),
  ).toBeVisible();
  await expect(page.locator(".sales-roster-grid th.meeting")).toHaveCount(1);
  const meetingCells = page.locator('.sales-shift-cell[data-meeting="true"]');
  await expect(meetingCells.first()).toBeVisible();
  expect(await meetingCells.count()).toBeGreaterThan(0);
  await expect(meetingCells.first()).toHaveText("會");
  expect(
    await meetingCells.evaluateAll((cells) =>
      cells.every((cell) => cell.textContent === "會"),
    ),
  ).toBe(true);
  await meetingCells.first().click();
  const shiftDialog = page.getByRole("dialog", { name: /更表/ });
  await expect(
    shiftDialog.locator('option[value="off"]'),
  ).toHaveJSProperty("disabled", true);
  await expect(
    shiftDialog.locator('option[value="ph"]'),
  ).toHaveJSProperty("disabled", true);
  await shiftDialog.getByRole("button", { name: "取消", exact: true }).click();
  await page
    .getByRole("button", { name: "取消開會日 2026-10-02" })
    .click();
  await expect(page.locator(".sales-roster-grid th.meeting")).toHaveCount(0);
});

test("Sales阿頭可刪除及重新新增Team", async ({ page }) => {
  await page.goto("/");
  await switchRole(page, "Don A DN（測試碼）");
  await gotoRoster(page);
  await page
    .locator(".sales-sheet-panel")
    .first()
    .getByRole("button", { name: "編輯", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "編輯Team" });
  await dialog.getByRole("button", { name: "刪除 Team C" }).click();
  await expect(
    page.locator(".sales-location-name").filter({ hasText: "C" }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: /Team$/ }).click();
  await expect(
    page.locator(".sales-location-name").filter({ hasText: "C" }),
  ).toHaveCount(1);
});
