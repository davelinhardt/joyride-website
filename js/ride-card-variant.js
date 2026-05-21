/**
 * Pure variant-decision logic for the "My rides & receipts" cards
 * on joyride.cool/rides. Mirrors the in-app Activity tab variants
 * (joiryde-rider/app/(tabs)/activity.tsx renderItem block).
 *
 * Inputs come from `/api/rider/rides`. Returns a flat descriptor the
 * page can consume to render the card without any inline branching.
 *
 * Dual-published — browser global `window.JoyrideRideCardVariant`
 * AND Node CJS so the test file in this same folder can require it.
 */
(function attach() {
  /**
   * Map raw server `status` (+ driverId, bidCount) to a normalized
   * display status the card chooses styling and behavior from.
   *
   * Mirrors the in-app mapping at activity.tsx:127-132:
   *   - "cancelled"           → cancelled
   *   - "completed"           → completed
   *   - "no_match" / "expired" → expired
   *   - driverId set          → scheduled
   *   - else                   → pending
   */
  function displayStatus(row) {
    if (!row) return "pending";
    var s = String(row.status || "").toLowerCase();
    if (s === "cancelled") return "cancelled";
    if (s === "completed") return "completed";
    if (s === "no_match" || s === "expired") return "expired";
    if (row.driverId || (row.driver && row.driver.id)) return "scheduled";
    return "pending";
  }

  /**
   * Card variant — captures everything the page needs to render the
   * row without re-checking statuses. Mirrors what activity.tsx does
   * inside renderItem.
   */
  function cardVariant(row) {
    var status = displayStatus(row);
    var bidCount = Number(row && row.bidCount) || 0;
    var hasBids = status === "pending" && bidCount > 0;
    // The /api/rider/rides response carries the driver either as a
    // nested `row.driver` object (with vehicle + ratings) or just as
    // a raw `row.driverId` if the enrichment fetch missed. Accept
    // either signal — the card still has *something* meaningful to
    // show (or, in the absence of nested data, falls back gracefully).
    var hasDriverId = row && (row.driverId != null || (row.driver && row.driver.id != null));
    var hasDriver = status !== "pending" && !!hasDriverId;

    return {
      status: status,
      bidCount: bidCount,
      hasBids: hasBids,
      hasDriver: hasDriver,
      // Should the card show a fare in the address-trailing slot?
      // App rule: cancelled → no price (rider didn't complete it);
      // pending with bids → "VIEW BIDS" pill instead; pending no bids
      // → nothing trailing; scheduled/completed/expired → price.
      showPrice:
        status === "scheduled" ||
        status === "completed" ||
        status === "expired",
      // Yellow accent border on pending-with-bids only — matches the
      // `highlight={hasBids}` prop on MiniRydeCard in the app.
      highlight: hasBids,
      // Headline-right text for pending rows. App uses:
      //   - "Waiting for driver…" when bidCount === 0
      //   - "{N} offers" when bidCount > 0 (with singular/plural)
      // For non-pending rows this is null (the price moves into
      // address-trailing instead).
      headlineRightText:
        status !== "pending"
          ? null
          : hasBids
            ? bidCount + " " + (bidCount === 1 ? "offer" : "offers")
            : "Waiting for driver…",
    };
  }

  /**
   * Where should a tap go? Mirrors the app's onAddressPress logic.
   * The website doesn't yet have /scheduled-bids, /scheduled-ryde-details,
   * or /active-ryde — those land on /receipt for now (receipt.html
   * gracefully renders what data is available for non-completed rows).
   */
  function tapDestination(row) {
    if (!row || row.id == null) return null;
    return "/receipt?id=" + encodeURIComponent(row.id);
  }

  /**
   * Fare to display in the address-trailing slot. Mirrors the in-app
   * MiniRydePrice computation: subtotal + tax + fees + tip for
   * completed; pre-completion rows fall back to estimatedFare.
   * Returns a string like "$24.50" or null if no fare to show.
   */
  function displayFare(row) {
    if (!row) return null;
    var status = displayStatus(row);
    if (status === "cancelled" || status === "pending") return null;
    var subtotal = parseFloat(String(row.totalFare != null ? row.totalFare : row.estimatedFare || 0)) || 0;
    if (status !== "completed") {
      return subtotal > 0 ? "$" + subtotal.toFixed(2) : null;
    }
    var tax  = parseFloat(String(row.salesTax  || 0)) || 0;
    var fees = parseFloat(String(row.govFees   || 0)) || 0;
    var tip  = parseFloat(String(row.tipAmount || 0)) || 0;
    var total = subtotal + tax + fees + tip;
    return total > 0 ? "$" + total.toFixed(2) : null;
  }

  var api = {
    displayStatus: displayStatus,
    cardVariant: cardVariant,
    tapDestination: tapDestination,
    displayFare: displayFare,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.JoyrideRideCardVariant = api;
  }
})();
