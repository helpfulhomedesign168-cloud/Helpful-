import { expect, test } from "@playwright/test";

test("報價Step 2可以真正上載及預覽手寫單", async ({ page }) => {
  await page.goto("/quotes/new?step=2");
  await expect(
    page.getByRole("button", { name: "上載手寫單", exact: true }).first(),
  ).toBeVisible();
  const input = page.locator('input[type="file"]');
  await input.setInputFiles(
    "docs/design/screens/global/extra-works-multiple.png",
  );
  const dialog = page.getByRole("dialog", { name: "核對手寫單" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByAltText("已上載的手寫報價單"),
  ).toBeVisible();
  await expect(dialog).toContainText("貼上 AI 結果");
  await expect(dialog).toContainText("未接 Vision API");
  await dialog.getByRole("button", { name: "關閉", exact: true }).click();
  await expect(page.locator(".handwritten-source")).toContainText(
    "手寫單已上載",
  );
  await expect(
    page.locator(".handwritten-source").getByAltText("已上載的手寫報價單"),
  ).toBeVisible();
});

test("貼上 AI JSON 可核對並加入手動工程項目", async ({ page }) => {
  await page.goto("/quotes/new?step=2");
  await page.locator('input[type="file"]').setInputFiles(
    "docs/design/screens/global/extra-works-multiple.png",
  );
  const dialog = page.getByRole("dialog", { name: "核對手寫單" });
  await dialog.getByLabel("貼上 AI JSON").fill(
    JSON.stringify({
      rawTotal: 23500,
      items: [
        { name: "石屎剷落（大廳）", quantity: 1, unit: "項", amount: 21000 },
        { name: "抽氣扇", quantity: 1, unit: "項", amount: 2500 },
      ],
    }),
  );
  await dialog.getByRole("button", { name: "核對 AI 結果", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "AI 核對結果", exact: true }),
  ).toBeVisible();
  await expect(dialog).toContainText("已對賬");
  await dialog.getByRole("button", { name: "加入報價", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".line-card")).toHaveCount(2);
  await expect(page.locator(".line-card").first()).toContainText("石屎剷落");
  await expect(page.locator(".quote-step2-summary")).toContainText("HK$23,500.00");
  await page.getByRole("button", { name: "儲為草稿", exact: true }).click();
  await expect(page).toHaveURL(/\/quotes\?tab=draft/);
});
