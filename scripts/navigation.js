(function () {
  "use strict";

  const PROFILE_STORAGE_KEY = "alfa-investment-profile";
  const PROFILE_ROUTE = "investment-profile.html";
  const HOME_ROUTE = "index.html";

  function isProfileComplete(storage) {
    try {
      const profile = JSON.parse(storage.getItem(PROFILE_STORAGE_KEY));
      return Boolean(
        profile
        && typeof profile === "object"
        && !Array.isArray(profile)
        && profile.feedback?.confirmed === true
        && typeof profile.completedAt === "string"
        && profile.completedAt.length > 0
      );
    } catch (error) {
      return false;
    }
  }

  function destinationForRoute(route, storage) {
    const complete = isProfileComplete(storage);

    if (route === "profile") return complete ? HOME_ROUTE : null;
    if (["home", "inner"].includes(route)) return complete ? null : PROFILE_ROUTE;
    return null;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { destinationForRoute, isProfileComplete };
  }

  if (typeof window === "undefined" || typeof document === "undefined") return;

  const root = document.documentElement;
  root.classList.add("page-transition-pending");
  let isNavigating = false;

  function go(destination, options = {}) {
    if (!destination || isNavigating) return;
    isNavigating = true;

    const navigate = () => {
      if (options.replace) {
        window.location.replace(destination);
      } else {
        window.location.assign(destination);
      }
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      navigate();
      return;
    }

    root.classList.remove("page-transition-ready");
    root.classList.add("page-transition-leaving");
    window.setTimeout(navigate, 100);
  }

  window.alfaNavigation = Object.freeze({
    go,
    destinationForRoute,
    isProfileComplete: () => isProfileComplete(window.localStorage)
  });

  const route = document.currentScript?.dataset.route;
  function enforceRoute() {
    const destination = destinationForRoute(route, window.localStorage);
    if (destination) window.location.replace(destination);
    return Boolean(destination);
  }

  window.addEventListener("pageshow", () => {
    if (enforceRoute()) return;
    isNavigating = false;
    root.classList.remove("page-transition-leaving");
    root.classList.add("page-transition-ready");
  });

  if (enforceRoute()) {
    return;
  }

  window.addEventListener("DOMContentLoaded", () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => root.classList.add("page-transition-ready"));
    });

    document.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const control = event.target.closest("a[href]");
      if (!control || control.hasAttribute("download") || (control.target && control.target !== "_self")) return;

      const destination = new URL(control.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return;

      event.preventDefault();
      go(control.hasAttribute("data-back-home") ? HOME_ROUTE : destination.href, {
        replace: control.hasAttribute("data-back-home")
      });
    });
  });
})();
