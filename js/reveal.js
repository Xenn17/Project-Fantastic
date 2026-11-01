(() => {
  "use strict";
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const reveal = () => {
    const items = [...document.querySelectorAll(".reveal")];
    if (reduced || !("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    items.filter((item) => !item.classList.contains("is-visible"))
      .forEach((item) => observer.observe(item));
  };
  window.F4Reveal = { refresh: reveal };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", reveal, { once: true });
  else reveal();
})();
