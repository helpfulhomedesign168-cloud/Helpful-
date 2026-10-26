import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("Sales客戶表單只顯示核心欄位，街道及座數可以留空", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (event) => errors.push(event.message));
  await page.goto("/");
  await switchRole(page, "文文B MM");
  await page.goto("/customers");
  await page.getByRole("button", { name: "新增客戶", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "新增客戶" });

  await expect(dialog.getByLabel("客戶姓名", { exact: false })).toBeVisible();
  await expect(
    dialog.getByLabel("身份證明姓名", { exact: false }),
  ).toHaveCount(0);
  await expect(
    dialog.getByLabel("業主姓名", { exact: false }),
  ).toHaveCount(0);

  const labelText = await dialog.locator(".field-label").allTextContents();
  expect(labelText.some((text) => text.startsWith("完整地址"))).toBe(true);
  expect(labelText.some((text) => text.startsWith("完整工程地址"))).toBe(
    false,
  );
  expect(labelText).toContain("街道");
  expect(labelText).toContain("座數");
  expect(labelText).toContain("身份證號碼（Demo佔位）");
  expect(labelText).toContain("緊急聯絡人");
  expect(labelText).toContain("緊急聯絡電話");
  const streetLabel = labelText.find((text) => text.startsWith("街道")) ?? "";
  const blockLabel = labelText.find((text) => text.startsWith("座數")) ?? "";
  const nameLabel = labelText.find((text) => text.startsWith("客戶姓名")) ?? "";
  expect(streetLabel).not.toContain("＊");
  expect(blockLabel).not.toContain("＊");
  expect(nameLabel).toContain("＊");

  await dialog.getByLabel("客戶姓名", { exact: false }).fill("UI簡化客戶");
  await dialog.getByLabel(/^聯絡電話/).fill("91237788");
  await dialog.getByLabel(/^WhatsApp電話/).fill("91237788");
  await dialog.getByLabel("工程地區", { exact: false }).selectOption("黃大仙");
  await dialog.getByLabel(/^屋苑／大廈/).fill("測試苑");
  await dialog.getByLabel(/^樓層/).fill("3樓");
  await dialog.getByLabel(/^單位/).fill("C室");
  // 街道、座數、身份證、長者、來源、緊急聯絡人全部留空。
  await dialog.getByRole("button", { name: "儲存客戶", exact: true }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("UI簡化客戶", { exact: true })).toBeVisible();
  await expect(
    page.getByText("黃大仙 測試苑 3樓 C室", { exact: true }).first(),
  ).toBeVisible();

  await page.goto("/quotes/new");
  await expect(
    page.getByRole("heading", { name: /客戶資料/ }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
