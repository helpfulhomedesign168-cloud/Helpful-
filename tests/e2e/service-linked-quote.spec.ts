import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("有連貫工程的項目在Sales報價會詢問是否加入", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (event) => errors.push(event.message));
  await page.goto("/");
  await switchRole(page, "SuperAdmin");
  await page.getByRole("button", { name: "新增工程項目", exact: true }).click();
  const form = page.getByRole("dialog", { name: "新增工程項目" });
  await form.getByLabel("工程名稱", { exact: false }).fill("E2E 連貫主項");
  await form.getByLabel("工程分類", { exact: false }).selectOption("水喉");
  await form.getByLabel("工程範圍", { exact: false }).selectOption("廚房");
  await form.getByLabel("工程詳細", { exact: false }).fill("主項詳細");
  await form.getByRole("radio", { name: "固定價", exact: true }).check();
  await form.getByLabel(/零售價/, { exact: false }).fill("900");
  await form.getByRole("button", { name: "新增連貫工程", exact: true }).click();
  const linkDialog = page.getByRole("dialog", { name: "新增連貫工程" });
  await linkDialog.getByLabel(/廚房牆身/).check();
  await linkDialog.getByRole("button", { name: "完成", exact: true }).click();
  await form.getByRole("button", { name: "儲存工程項目", exact: true }).click();

  await switchRole(page, "文文B MM");
  await page.getByRole("button", { name: "建立報價", exact: true }).click();
  await page.getByRole("button", { name: "選擇現有客戶", exact: true }).click();
  await page.locator(".customer-option").filter({ hasText: "陳小強" }).first().click();
  await page.getByRole("button", { name: "選擇工程", exact: true }).click();
  await page.locator(".service-option").filter({ hasText: "E2E 連貫主項" }).click();
  const line = page.locator(".line-card").filter({ hasText: "E2E 連貫主項" });
  await expect(
    line.getByRole("button", { name: "需要加連貫工程？", exact: true }),
  ).toBeVisible();
  await line.getByRole("button", { name: "需要加連貫工程？", exact: true }).click();
  const linkedDialog = page.getByRole("dialog", { name: "連貫工程" });
  await expect(linkedDialog).toContainText("廚房牆身/地台 清拆打鑿");
  await linkedDialog.getByRole("button", { name: "加入連貫工程", exact: true }).click();
  await expect(page.locator(".line-card")).toHaveCount(2);
  await expect(
    page.locator(".line-card").filter({ hasText: "廚房牆身/地台 清拆打鑿" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
