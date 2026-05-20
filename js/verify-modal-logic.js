/**
 * Pure decision logic for the verification modal on /account.
 *
 * Dual-published: usable from both a browser <script src> (attaches to
 * window) and a Node CommonJS require() (for unit tests).
 *
 * Inputs:
 *   search   string  // window.location.search, e.g. "?verify=1"
 *   user     object  // { emailVerified: bool, mobileVerified: bool } | null
 *
 * Contract:
 *   shouldOpenVerifyModal  → true when ?verify=1 AND at least one channel unverified.
 *                            Fresh signup (both flags false) MUST return true.
 *   shouldCloseVerifyModal → true when ?verify=1 AND user is already fully verified
 *                            (so we can strip the URL param on next paint).
 */
(function attach() {
  function readVerifyParam(search) {
    try {
      return new URLSearchParams(search || "").get("verify") === "1";
    } catch (_) {
      return false;
    }
  }

  function shouldOpenVerifyModal(search, user) {
    if (!user) return false;
    var wantsVerify = readVerifyParam(search);
    var anyUnverified = !user.emailVerified || !user.mobileVerified;
    return wantsVerify && anyUnverified;
  }

  function shouldCloseVerifyModal(search, user) {
    if (!user) return false;
    var wantsVerify = readVerifyParam(search);
    var allVerified = !!user.emailVerified && !!user.mobileVerified;
    return wantsVerify && allVerified;
  }

  var api = {
    shouldOpenVerifyModal: shouldOpenVerifyModal,
    shouldCloseVerifyModal: shouldCloseVerifyModal,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.JoyrideVerifyModal = api;
  }
})();
