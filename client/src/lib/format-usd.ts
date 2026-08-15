/** Matches `numeric(14, 8)` on cost columns. */
export const USD_MAX_SCALE = 8;

export const USD_GRANULARITIES = [2, 4, 6, 8] as const;

export type UsdGranularity = (typeof USD_GRANULARITIES)[number];

export const isUsdGranularity = (value: unknown): value is UsdGranularity =>
  typeof value === "number" &&
  (USD_GRANULARITIES as readonly number[]).includes(value);

/** True when a real charge would print as $0 at this many decimal places. */
export const wouldRoundToZero = (amount: number, digits: number) =>
  amount !== 0 && Number(Math.abs(amount).toFixed(digits)) === 0;

const formatSigned = (amount: number, body: string) =>
  `${amount < 0 ? "-" : ""}${body}`;

const formatFixedUsd = (amount: number, digits: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);

/**
 * Fixed-precision USD. A non-zero amount that rounds away at `digits`
 * renders as `~$0.00` (tilde = approximately zero at this scale).
 */
export const formatUsd = (amount: number, digits: UsdGranularity = 2) => {
  if (!Number.isFinite(amount) || amount === 0) {
    return formatFixedUsd(0, digits);
  }

  if (wouldRoundToZero(amount, digits)) {
    const zero = formatFixedUsd(0, digits);
    return amount < 0 ? `~-${zero}` : `~${zero}`;
  }

  return formatFixedUsd(amount, digits);
};

/** Full stored scale, never `~$0`. Used when the display was rounded away. */
export const formatUsdExact = (amount: number) => {
  if (!Number.isFinite(amount) || amount === 0) {
    return "$0.00";
  }

  const abs = Math.abs(amount);
  const fixed = abs.toFixed(USD_MAX_SCALE);
  if (Number(fixed) === 0) {
    return formatSigned(amount, "$<0.00000001");
  }

  const trimmed = fixed.replace(/0+$/, "").replace(/\.$/, "");
  const fracLen = trimmed.split(".")[1]?.length ?? 0;
  const digits = Math.max(2, fracLen);
  const body = abs.toFixed(digits).replace(/(\.\d*?[1-9])0+$/, "$1");
  return formatSigned(amount, `$${body}`);
};
