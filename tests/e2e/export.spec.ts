import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, phone: string) {
  await page.goto("/login");
  await page.locator("#phone").fill(phone);
  await page.getByRole("button", { name: /कोड भेजें|Send code/ }).click();
  await page.locator("#code").fill("123456");
  await expect(page).toHaveURL(/\/today$/, { timeout: 20_000 });
}

test("owner downloads everything as Excel and a part as CSV, with Hindi headings and real rupees", async ({ page }) => {
  await login(page, "9999900001");
  await page.goto("/more");
  await expect(page.getByRole("heading", { name: "डेटा डाउनलोड करें (बैकअप)" })).toBeVisible();

  const [xlsx] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /Excel फ़ाइल/ }).click()]);
  expect(xlsx.suggestedFilename()).toMatch(/^Dream-Library-all-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(await xlsx.path());
  expect(wb.worksheets.map((w) => w.name)).toEqual(["स्टूडेंट", "प्लान", "फीस", "पेमेंट", "हाज़िरी", "सीट"]);
  const students = wb.getWorksheet("स्टूडेंट")!;
  expect(students.getRow(1).getCell(1).value).toBe("नाम");
  expect(students.rowCount).toBeGreaterThan(20);
  // Mobile numbers stay text (no lost digits); money is a number you can add up.
  expect(typeof students.getRow(2).getCell(2).value).toBe("string");
  const payments = wb.getWorksheet("पेमेंट")!;
  expect(typeof payments.getRow(2).getCell(5).value).toBe("number");
  expect(payments.getRow(2).getCell(2).value).toBeInstanceOf(Date);

  await page.getByText("अलग-अलग CSV फ़ाइल").click();
  const [csv] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "फीस की CSV फ़ाइल डाउनलोड करें" }).click()]);
  expect(csv.suggestedFilename()).toMatch(/-fees-.*\.csv$/);
  const text = await (await import("node:fs/promises")).readFile(await csv.path(), "utf8");
  expect(text.charCodeAt(0)).toBe(0xfeff);
  expect(text.split("\r\n")[0]).toContain("बाकी (₹)");
});

test("desk staff can't see or open the data download", async ({ page }) => {
  await login(page, "9999900003");
  await page.goto("/more");
  await expect(page.getByText("डेटा डाउनलोड करें (बैकअप)")).toHaveCount(0);
  const res = await page.request.get("/export/all.xlsx");
  expect(res.status()).toBe(403);
});
