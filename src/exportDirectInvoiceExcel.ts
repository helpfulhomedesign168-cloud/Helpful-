import type {
  Customer,
  InvoiceInstallment,
  Pricing,
  QuoteLine,
} from "./domain/types";

type Input = {
  date: string;
  customer: Customer;
  lines: QuoteLine[];
  pricing: Pricing;
  paymentPlan: InvoiceInstallment[];
};

const moneyFormat = '"HK$"#,##0.00';
const hkDate = (value: string) => {
  const [y, m, d] = value.split("-");
  return d && m && y ? `${d}/${m}/${y}` : value;
};
const imageBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};
const rangeText = (line: QuoteLine) => {
  const service = line.itemSnapshot;
  if (service.measure === "area")
    return `${line.length} × ${line.width} ${line.dimensionUnit}`;
  if (service.measure === "length") return `${line.length} ${line.dimensionUnit}`;
  if (service.measure === "fixed") return "一式";
  return `${line.quantity} ${service.unit}`;
};

export async function exportDirectInvoiceExcel(input: Input) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "好幫手家居裝修設計有限公司";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Invoice", {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.35,
        right: 0.35,
        top: 0.45,
        bottom: 0.45,
        header: 0.2,
        footer: 0.2,
      },
    },
  });
  sheet.columns = [
    { width: 6 },
    { width: 42 },
    { width: 20 },
    { width: 16 },
    { width: 20 },
  ];
  const border = {
    top: { style: "thin" as const, color: { argb: "FFD9E1EC" } },
    left: { style: "thin" as const, color: { argb: "FFD9E1EC" } },
    bottom: { style: "thin" as const, color: { argb: "FFD9E1EC" } },
    right: { style: "thin" as const, color: { argb: "FFD9E1EC" } },
  };
  const merge = (row: number, from: number, to: number) => {
    sheet.mergeCells(row, from, row, to);
    return sheet.getCell(row, from);
  };
  // Letterhead
  sheet.getRow(1).height = 30;
  sheet.getRow(2).height = 20;
  sheet.getRow(3).height = 20;
  try {
    const response = await fetch("/company-logo.png");
    if (response.ok) {
      const base64 = imageBase64(await response.arrayBuffer());
      const imageId = workbook.addImage({ base64, extension: "png" });
      sheet.addImage(imageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 185, height: 36 },
      });
    }
  } catch {
    // The workbook remains usable without the optional logo.
  }
  const company = merge(1, 3, 5);
  company.value = "好幫手家居裝修設計有限公司";
  company.font = { name: "Noto Sans TC", size: 12, bold: true };
  company.alignment = { horizontal: "right" };
  const address = merge(2, 3, 5);
  address.value = "九龍荔枝角長義街 2-4 號新昌工業大廈 2 樓 202A 室";
  address.font = { name: "Noto Sans TC", size: 9, color: { argb: "FF667085" } };
  address.alignment = { horizontal: "right" };
  const contact = merge(3, 3, 5);
  contact.value =
    "info@helpfulhomedesign.com.hk  ·  +852 6600 2878 · +852 3615 0180 · 3615 0198";
  contact.font = { name: "Noto Sans TC", size: 8, color: { argb: "FF667085" } };
  contact.alignment = { horizontal: "right" };
  sheet.getRow(4).height = 14;
  // Title
  const title = merge(5, 1, 5);
  title.value = "工程Invoice";
  title.font = { name: "Noto Sans TC", size: 24, bold: true, color: { argb: "FF17253B" } };
  title.alignment = { horizontal: "center" };
  const subtitle = merge(6, 1, 5);
  subtitle.value = "INVOICE";
  subtitle.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF17253B" } };
  subtitle.alignment = { horizontal: "center" };
  sheet.getRow(5).height = 34;
  sheet.getRow(6).height = 24;
  // Meta
  const numberLabel = merge(8, 1, 2);
  numberLabel.value = "No.  待建立";
  numberLabel.font = { name: "Noto Sans TC", size: 11, bold: true };
  const dateCell = merge(8, 4, 5);
  dateCell.value = `日期：${hkDate(input.date)}`;
  dateCell.font = { name: "Noto Sans TC", size: 11, bold: true };
  dateCell.alignment = { horizontal: "right" };
  sheet.getRow(8).height = 22;
  // Customer
  const customer = merge(10, 1, 5);
  customer.value = `客戶姓名：${input.customer.name || "待填客戶"}    聯絡電話：${input.customer.phone || ""}`;
  customer.font = { name: "Noto Sans TC", size: 10 };
  const addressCell = merge(11, 1, 5);
  addressCell.value = `客戶地址：${input.customer.address || "待填地址"}`;
  addressCell.font = { name: "Noto Sans TC", size: 10 };
  sheet.getRow(10).height = 20;
  sheet.getRow(11).height = 20;
  // Table header
  const headerRow = 13;
  const headers = ["#", "工程項目", "實際範圍", "單價", "金額"];
  headers.forEach((value, index) => {
    const cell = sheet.getCell(headerRow, index + 1);
    cell.value = value;
    cell.font = { name: "Noto Sans TC", size: 10, bold: true, color: { argb: "FF17253B" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3C97B" } };
    cell.border = border;
    cell.alignment = {
      vertical: "middle",
      horizontal: index >= 2 ? "right" : "left",
    };
  });
  sheet.getRow(headerRow).height = 25;
  let row = headerRow + 1;
  input.lines.forEach((line, index) => {
    const amount =
      input.pricing.lineAmounts.find((item) => item.id === line.id)?.amount ?? 0;
    const values = [
      index + 1,
      line.itemSnapshot.name,
      rangeText(line),
      line.itemSnapshot.price,
      amount,
    ];
    values.forEach((value, colIndex) => {
      const cell = sheet.getCell(row, colIndex + 1);
      cell.value = value;
      cell.font = { name: "Noto Sans TC", size: 9 };
      cell.border = border;
      if (colIndex === 3 || colIndex === 4) cell.numFmt = moneyFormat;
      cell.alignment = {
        vertical: "middle",
        horizontal: colIndex >= 2 ? "right" : "left",
        wrapText: colIndex === 1,
      };
    });
    if (line.itemSnapshot.measure === "area" && line.position) {
      const sub = sheet.getCell(row, 2);
      sub.value = `${line.itemSnapshot.name}\n${line.position}`;
    }
    sheet.getRow(row).height = 30;
    row += 1;
  });
  // Totals
  row += 1;
  const addTotal = (label: string, value: number | string, total = false) => {
    const labelCell = merge(row, 3, 4);
    labelCell.value = label;
    labelCell.font = {
      name: "Noto Sans TC",
      size: total ? 12 : 10,
      bold: total,
    };
    labelCell.alignment = { horizontal: "right" };
    const valueCell = sheet.getCell(row, 5);
    valueCell.value = value;
    if (typeof value === "number") valueCell.numFmt = moneyFormat;
    valueCell.font = {
      name: "Noto Sans TC",
      size: total ? 13 : 10,
      bold: total,
    };
    valueCell.alignment = { horizontal: "right" };
    if (total) {
      sheet.getRow(row).height = 24;
      labelCell.border = { top: border.top };
      valueCell.border = { top: border.top };
    }
    row += 1;
  };
  addTotal("工程小計", input.pricing.subtotal);
  addTotal("折扣  原價", 0);
  addTotal("成交總額", input.pricing.total, true);
  input.paymentPlan.forEach((stage) =>
    addTotal(
      `第${stage.installment}期 · ${stage.label} ${stage.percentage}%`,
      stage.amount,
    ),
  );
  // Bank + terms
  row += 1;
  const bank = merge(row, 1, 5);
  bank.value =
    "客戶入帳戶口  HELPFUL HOME DESIGN LIMITED      中國銀行 012 866 2028 1718      匯豐銀行 004 521 363952 838      富邦銀行 128 865 02105259";
  bank.font = { name: "Noto Sans TC", size: 8, color: { argb: "FF475467" } };
  bank.alignment = { wrapText: true };
  bank.border = { top: border.top };
  sheet.getRow(row).height = 34;
  row += 1;
  const termsTitle = merge(row, 1, 5);
  termsTitle.value = "付款及收款資料";
  termsTitle.font = { name: "Noto Sans TC", size: 10, bold: true };
  row += 1;
  const terms = merge(row, 1, 5);
  terms.value =
    "此 Invoice 按已確認的報價版本發出；收款計劃及期款以開單員確認的付款安排為準。\n\n此工程單經客戶確認簽署後正式生效，表示客戶同意清楚明白報價單所有維修項目內容不能減少。如客戶要求取消工程，所付之訂金將不獲退還。如需更改工程日期，請於工程前兩星期通知，否則公司將有機會收取客人港幣 $1,500 行政費用。\n\n本報價單不等同收據；收款後將另行發出收據。";
  terms.font = { name: "Noto Sans TC", size: 8, color: { argb: "FF475467" } };
  terms.alignment = { wrapText: true, vertical: "top" };
  sheet.getRow(row).height = 100;
  row += 1;
  const footer = merge(row, 1, 5);
  footer.value = "好幫手家居裝修設計有限公司                                          工程 Invoice · 待建立";
  footer.font = { name: "Noto Sans TC", size: 8, color: { argb: "FF667085" } };
  footer.alignment = { horizontal: "left" };
  footer.border = { top: border.top };
  sheet.getRow(row).height = 22;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `好幫手_Invoice_${input.date}_${input.customer.name || "客戶"}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
