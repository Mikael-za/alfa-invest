(function () {
  "use strict";

  const STORAGE_KEY = "alfa-mascot-look-v1";
  const tabs = Array.from(document.querySelectorAll("[role='tab']"));
  const panels = {
    tasks: document.getElementById("tasks-panel"),
    wardrobe: document.getElementById("wardrobe-panel")
  };
  const mascotImage = document.getElementById("mascot-image");
  const shoeCards = Array.from(document.querySelectorAll("[data-category='shoes']"));
  let imageRequest = 0;

  const shoes = {
    none: {
      src: "assets/mascot-base.png",
      alt: "Маскот Дзынь без обуви"
    },
    black: {
      src: "assets/mascot-previews/mascot-black.png",
      alt: "Маскот Дзынь в черной обуви"
    },
    gold: {
      src: "assets/mascot-previews/mascot-gold.png",
      alt: "Маскот Дзынь в золотой обуви"
    },
    white: {
      src: "assets/mascot-previews/mascot-white.png",
      alt: "Маскот Дзынь в белой обуви"
    }
  };

  function activateTab(name, focus = false) {
    tabs.forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });

    Object.entries(panels).forEach(([panelName, panel]) => {
      panel.hidden = panelName !== name;
    });
  }

  function loadSelectedShoe() {
    try {
      const saved = window.sessionStorage.getItem(STORAGE_KEY);
      return Object.prototype.hasOwnProperty.call(shoes, saved) ? saved : "none";
    } catch (error) {
      return "none";
    }
  }

  function saveSelectedShoe(name) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, name);
    } catch (error) {
      // The wardrobe still works when browser storage is unavailable.
    }
  }

  function selectShoe(name, options = {}) {
    const shoe = shoes[name];
    if (!shoe) return;
    const request = imageRequest + 1;
    imageRequest = request;

    shoeCards.forEach((card) => {
      const selected = card.dataset.item === name;
      card.classList.toggle("is-selected", selected);
      card.setAttribute("aria-pressed", String(selected));
    });

    mascotImage.classList.add("is-changing");
    if (request !== imageRequest) return;
    mascotImage.src = shoe.src;
    mascotImage.alt = shoe.alt;
    if (options.save !== false) saveSelectedShoe(name);
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (index + direction + tabs.length) % tabs.length;
      activateTab(tabs[nextIndex].dataset.tab, true);
    });
  });

  document.querySelectorAll(".wardrobe-card:not(:disabled)").forEach((card) => {
    card.addEventListener("click", () => {
      const category = card.dataset.category;
      document.querySelectorAll(`[data-category='${category}']`).forEach((categoryCard) => {
        const selected = categoryCard === card;
        categoryCard.classList.toggle("is-selected", selected);
        categoryCard.setAttribute("aria-pressed", String(selected));
      });

      if (category === "shoes") selectShoe(card.dataset.item);
    });
  });

  mascotImage.addEventListener("load", () => {
    mascotImage.classList.remove("is-changing");
  });

  selectShoe(loadSelectedShoe(), { save: false });

})();
