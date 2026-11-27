type InvoiceCommissionInput = {
  totalCents: number;
  salesName: string | null;
  supervisorName: string | null;
  team: string | null;
  discountRate: string | number | null;
};

export function commissionRates(invoice: InvoiceCommissionInput) {
  const rate = Number(invoice.discountRate ?? 1);
  const low = Number.isFinite(rate) && rate < 0.95;
  return {
    low,
    sales: low ? 0.06 : 0.08,
    supervisor: invoice.team === "A" ? (low ? 0.03 : 0.04) : (low ? 0.02 : 0.03),
    head: invoice.team === "B" ? 0.01 : 0,
  };
}

export function commissionShares(
  invoice: InvoiceCommissionInput,
  headName: string | null,
) {
  const rates = commissionRates(invoice);
  const shares: Array<{ actorName: string; amountCents: number }> = [];
  const add = (name: string | null, rate: number) => {
    if (!name?.trim() || rate <= 0) return;
    shares.push({
      actorName: name.trim(),
      amountCents: Math.round(invoice.totalCents * rate),
    });
  };
  add(invoice.salesName, rates.sales);
  add(invoice.supervisorName, rates.supervisor);
  if (rates.head > 0) add(headName, rates.head);
  return shares;
}

export function commissionTotalCents(
  invoice: InvoiceCommissionInput,
  headName: string | null,
) {
  return commissionShares(invoice, headName).reduce(
    (sum, share) => sum + share.amountCents,
    0,
  );
}
