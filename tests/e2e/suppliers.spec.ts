import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("供應商列表、分類tabs、新增、產品款式及刪除", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (event) => errors.push(event.message));
  await page.goto("/");
  await switchRole(page, "阿花");
  await page.getByRole("link", { name: "供應商", exact: true }).click();
  await expect(page.locator(".supplier-table tbody tr")).toHaveCount(8);
  await expect(page.getByText("安輝傢俬廠", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "生態板傢俬", exact: true }).click();
  await expect(page.locator(".supplier-table tbody tr")).toHaveCount(2);
  await page.getByRole("tab", { name: "PD門", exact: true }).click();
  await expect(page.locator(".supplier-table tbody tr")).toHaveCount(3);
  await page.getByRole("tab", { name: "全部", exact: true }).click();

  await page.getByRole("button", { name: "新增", exact: true }).click();
  const add = page.getByRole("dialog", { name: "新增供應商" });
  await add.getByLabel("供應商名稱", { exact: false }).fill("E2E 玻璃廠");
  await add.getByLabel("聯絡人", { exact: false }).fill("E2E 陳生");
  await add.getByLabel("聯絡電話", { exact: false }).fill("9000 5678");
  await add.getByRole("checkbox", { name: "玻璃", exact: true }).check();
  await add.getByRole("checkbox", { name: "木門", exact: true }).check();
  await add.getByRole("radio", { name: "有", exact: true }).check();
  await add.getByRole("button", { name: "儲存", exact: true }).click();
  await expect(add).toBeHidden();

  const row = page.locator(".supplier-table tbody tr").filter({
    hasText: "E2E 玻璃廠",
  });
  await expect(row).toContainText("E2E 陳生");
  await expect(row).toContainText("玻璃, 木門");
  await page.getByRole("button", { name: "修改E2E 玻璃廠" }).click();
  const edit = page.getByRole("dialog", { name: "修改供應商" });
  await expect(edit.getByRole("radio", { name: "有", exact: true })).toBeChecked();
  await edit.getByRole("radio", { name: "沒有", exact: true }).check();
  await edit.getByRole("button", { name: "儲存", exact: true }).click();
  await page.getByRole("button", { name: "刪除E2E 玻璃廠" }).click();
  await page
    .getByRole("dialog", { name: "刪除供應商" })
    .getByRole("button", { name: "刪除", exact: true })
    .click();
  await expect(row).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("普通CS只讀供應商，沒有新增或編輯", async ({ page }) => {
  await page.goto("/");
  await switchRole(page, "工程CS");
  await page.goto("/suppliers");
  await expect(page.locator(".supplier-table tbody tr")).toHaveCount(8);
  await expect(page.getByRole("button", { name: "新增", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^修改/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^刪除/ })).toHaveCount(0);
});
