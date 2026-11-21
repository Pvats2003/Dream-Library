import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, phone: string) {
  await page.goto("/login");
  await page.locator("#phone").fill(phone);
  await page.getByRole("button", { name: /कोड भेजें|Send code/ }).click();
  await page.locator("#code").fill("123456");
  await expect(page).toHaveURL(/\/today$/, { timeout: 20_000 });
}

function randomMobile() {
  return `7${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;
}

test("desk admits a new student, assigns the best seat and collects the fee in under 60 seconds", async ({ page }) => {
  await login(page, "9999900003");
  const started = Date.now();

  await page.getByRole("button", { name: "नया स्टूडेंट" }).filter({ visible: true }).click();
  const sheet = page.getByRole("dialog");
  await sheet.locator("#admit-phone").fill(randomMobile());
  await sheet.getByRole("button", { name: "आगे बढ़ें" }).click();

  await sheet.locator("#admit-name").fill("Test Student");
  await sheet.getByRole("radio", { name: "लड़का" }).click();
  await sheet.getByRole("button", { name: "BPSC" }).click();
  await sheet.getByRole("button", { name: "आगे बढ़ें" }).click();

  await sheet.getByRole("radio", { name: /Morning Monthly/ }).click();
  await sheet.getByRole("button", { name: "आगे बढ़ें" }).click();

  await expect(sheet.getByText("सबसे अच्छी खाली सीट")).toBeVisible();
  await sheet.getByRole("button", { name: "आगे बढ़ें" }).click();

  await sheet.getByRole("radio", { name: /पूरी फीस मिल गई/ }).click();
  await sheet.getByRole("button", { name: "भर्ती पक्की करें" }).click();

  await expect(sheet.getByText("Test Student जुड़ गए!")).toBeVisible({ timeout: 15_000 });
  await expect(sheet.getByText(/रसीद .+-\d{4}-\d{5}/)).toBeVisible();
  const seconds = (Date.now() - started) / 1000;
  console.log(`admit took ${seconds.toFixed(1)}s (automated)`);
  expect(seconds).toBeLessThan(60);
  await expect(sheet.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", /^https:\/\/wa\.me\/91\d{10}\?text=/);
});

test("an existing student's number offers renewal instead of a duplicate", async ({ page }) => {
  await login(page, "9999900001");
  await page.goto("/students");
  // Take a real, active student's number from the list.
  const phoneText = await page.locator("main ul li").first().locator("p.tabular").textContent() ?? "";
  const digits = phoneText.replace(/\D/g, "").slice(-10);

  await page.getByRole("button", { name: "नया स्टूडेंट" }).filter({ visible: true }).click();
  const sheet = page.getByRole("dialog");
  await sheet.locator("#admit-phone").fill(digits);
  await sheet.getByRole("button", { name: "आगे बढ़ें" }).click();
  await expect(sheet.getByText("ये स्टूडेंट पहले से जुड़ा है")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "इनका प्लान आगे बढ़ाएँ" })).toBeVisible();
});
