/** Matches `numeric(14, 8)` on cost columns. */
const USD_MAX_SCALE = 8;

/** True when a 4-decimal currency round would print $0.0000 for a real charge. */
export const wouldRoundToZero = (amount: number, digits = 4) =>
  amount > 0 && Number(amount.toFixed(digits)) === 0;

const formatSigned = (amount: number, body: string) =>
  `${amount < 0 ? "-" : ""}${body}`;

/**
 * Currency that never hides a non-zero charge behind `$0.00`.
 * Values ≥ $1 use cents. Values in [$0.01, $1) keep up to 4 decimals.
 * Smaller amounts expand up to 8 decimals (DB scale); crumbs below that
 * render as `$<0.00000001`.
 */
export const formatUsd = (amount: number) => {
  if (!Number.isFinite(amount) || amount === 0) {
    return "$0.00";
  }

  const abs = Math.abs(amount);

  if (abs >= 0.01) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: abs < 1 ? 4 : 2,
    }).format(amount);
  }

  const fixed = abs.toFixed(USD_MAX_SCALE);
  if (Number(fixed) === 0) {
    return formatSigned(amount, "$<0.00000001");
  }

  const trimmed = fixed.replace(/0+$/, "").replace(/\.$/, "");
  const fracLen = trimmed.split(".")[1]?.length ?? 0;
  const digits = Math.max(4, fracLen);
  const body = abs.toFixed(digits).replace(/(\.\d*?[1-9])0+$/, "$1");
  return formatSigned(amount, `$${body}`);
};
