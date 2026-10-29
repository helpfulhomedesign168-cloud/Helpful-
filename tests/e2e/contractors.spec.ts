import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("工程師傅列表、tabs、新增、收費鎖定及刪除", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (event) => errors.push(event.message));
  await page.goto("/");
  await switchRole(page, "阿花");
  await page.getByRole("link", { name: "工程師傅", exact: true }).click();
  await expect(page.locator(".contractor-table tbody tr")).toHaveCount(12);
  await expect(page.getByText("黃日強 (Danny)", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "工程判頭", exact: true }).click();
  await expect(page.locator(".contractor-table tbody tr")).toHaveCount(4);
  await expect(page.getByText("黎生", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "師傅", exact: true }).click();
  await expect(page.locator(".contractor-table tbody tr")).toHaveCount(8);
  await expect(page.getByText("林仔", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "全部", exact: true }).click();
  await page.getByRole("button", { name: "修改林仔" }).click();
  const seeded = page.getByRole("dialog", { name: "修改師傅" });
  await expect(seeded.getByLabel("日工價錢", { exact: false })).toHaveValue(
    "1600",
  );
  await seeded.getByRole("button", { name: "取消", exact: true }).click();

  await page.getByRole("button", { name: "新增", exact: true }).click();
  const add = page.getByRole("dialog", { name: "新增師傅" });
  await add.getByLabel("師傅名稱", { exact: false }).fill("E2E 油漆師傅");
  await add.getByLabel("聯絡電話", { exact: false }).fill("9000 1234");
  await add.getByRole("radio", { name: "師傅", exact: true }).check();
  await add.getByLabel("主項工程", { exact: false }).selectOption("油漆");
  await add.getByLabel("工程詳細", { exact: false }).fill("E2E 師傅詳細");
  await add.getByRole("radio", { name: "日薪", exact: true }).check();
  await add.getByLabel("日工價錢", { exact: false }).fill("1200");
  await add.getByRole("button", { name: "儲存", exact: true }).click();
  await expect(add).toBeHidden();

  const row = page.locator(".contractor-table tbody tr").filter({
    hasText: "E2E 油漆師傅",
  });
  await expect(row).toContainText("9000 1234");
  await expect(row).toContainText("日薪");
  await expect(row).toContainText("油漆");
  await page.getByRole("button", { name: "修改E2E 油漆師傅" }).click();
  const edit = page.getByRole("dialog", { name: "修改師傅" });
  await expect(
    edit.getByRole("radio", { name: "日薪", exact: true }),
  ).toBeDisabled();
  await edit.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "刪除E2E 油漆師傅" }).click();
  await page
    .getByRole("dialog", { name: "刪除師傅" })
    .getByRole("button", { name: "刪除", exact: true })
    .click();
  await expect(row).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("普通CS只讀工程師傅，沒有新增或編輯", async ({ page }) => {
  await page.goto("/");
  await switchRole(page, "工程CS");
  await page.goto("/contractors");
  await expect(page.locator(".contractor-table tbody tr")).toHaveCount(12);
  await expect(page.getByRole("button", { name: "新增", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^修改/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^刪除/ })).toHaveCount(0);
});
