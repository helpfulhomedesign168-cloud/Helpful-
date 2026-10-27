import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("工程分類可以用編輯button新增及刪除tag", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (event) => errors.push(event.message));
  await page.goto("/");
  await switchRole(page, "SuperAdmin");
  await page.getByRole("link", { name: "工程價目", exact: true }).click();
  await page.getByRole("button", { name: "編輯", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "編輯工程分類" });
  await editor.getByLabel("新增分類名稱").fill("測試分類");
  await editor.getByRole("button", { name: "新增", exact: true }).click();
  await expect(page.getByRole("tab", { name: "測試分類項目", exact: true })).toBeVisible();
  await editor.getByRole("checkbox", { name: "測試分類項目", exact: true }).check();
  await editor.getByRole("button", { name: "刪除", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "確認刪除" });
  await expect(confirm).toContainText(
    "是否確定真的要刪除測試分類項目？一旦刪除，工程項目入面的工程全部都會一齊刪除掉。",
  );
  await confirm.getByRole("button", { name: "確定刪除", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "測試分類項目", exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
