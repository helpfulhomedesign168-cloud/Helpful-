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
  await expect(dialog).toContainText("AI 抽取尚未接駁");
  await dialog.getByRole("button", { name: "關閉", exact: true }).click();
  await expect(page.locator(".handwritten-source")).toContainText(
    "手寫單已上載",
  );
  await expect(
    page.locator(".handwritten-source").getByAltText("已上載的手寫報價單"),
  ).toBeVisible();
});
