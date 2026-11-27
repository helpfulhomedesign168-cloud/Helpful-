import type { InvoiceDetailData } from "./api/client";

const moneyFormat = '"HK$"#,##0.00';

export async function exportLiveInvoiceExcel(invoice: InvoiceDetailData) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "好幫手家居裝修設計有限公司";
  const sheet = workbook.addWorksheet("Invoice");
  sheet.columns = [
    { width: 6 },
    { width: 34 },
    { width: 18 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 16 },
  ];
  sheet.mergeCells("A1:G1");
  sheet.getCell("A1").value = "好幫手家居裝修設計有限公司";
  sheet.getCell("A1").font = { size: 18, bold: true, color: { argb: "FF0D1F3A" } };
  sheet.mergeCells("A2:G2");
  sheet.getCell("A2").value = "INVOICE";
  sheet.getCell("A2").font = { size: 16, bold: true, color: { argb: "FFF26B21" } };
  sheet.getCell("A4").value = "Invoice No.";
  sheet.getCell("B4").value = invoice.number;
  sheet.getCell("A5").value = "日期";
  sheet.getCell("B5").value = invoice.createdAt.slice(0, 10);
  sheet.getCell("A6").value = "客戶";
  sheet.getCell("B6").value = invoice.customer.name;
  sheet.getCell("A7").value = "電話";
  sheet.getCell("B7").value = invoice.customer.phone;
  sheet.getCell("A8").value = "地址";
  sheet.getCell("B8").value = invoice.customer.address || invoice.customer.district || "";
  const header = sheet.getRow(10);
  header.values = ["#", "工程項目", "位置", "數量", "單位", "單價", "金額"];
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D1F3A" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  invoice.lines.forEach((line, index) => {
    const row = sheet.addRow([
      index + 1,
      line.name,
      line.position || "",
      Number(line.quantity),
      line.unit,
      line.unitPriceCents / 100,
      line.amountCents / 100,
    ]);
    row.getCell(6).numFmt = moneyFormat;
    row.getCell(7).numFmt = moneyFormat;
  });
  const totalRow = sheet.addRow(["", "", "", "", "", "總額", invoice.totalCents / 100]);
  totalRow.font = { bold: true };
  totalRow.getCell(7).numFmt = moneyFormat;
  const paidRow = sheet.addRow(["", "", "", "", "", "已核收款", invoice.validPaidCents / 100]);
  paidRow.getCell(7).numFmt = moneyFormat;
  sheet.getRow(10).eachCell((cell) => {
    cell.border = { bottom: { style: "thin", color: { argb: "FF0D1F3A" } } };
  });
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `好幫手_Invoice_${invoice.number}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
