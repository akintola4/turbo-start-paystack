const BY_REGION: Record<string, string> = {
  NG: "NGN",
  GH: "GHS",
  ZA: "ZAR",
  KE: "KES",
};

/**
 * The currency a visitor most likely pays in, from Accept-Language
 * ("en-NG,en;q=0.9" → NGN). The first listed region Paystack settles in
 * wins; anyone else gets dollars.
 */
export function currencyFromAcceptLanguage(header: string | null) {
  for (const part of (header ?? "").split(",")) {
    const region = part.split(";")[0]?.trim().split("-")[1]?.toUpperCase();
    const currency = region ? BY_REGION[region] : undefined;
    if (currency) {
      return currency;
    }
  }
  return "USD";
}
