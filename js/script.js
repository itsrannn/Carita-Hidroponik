document.addEventListener("DOMContentLoaded", () => {
  feather.replace();

  // Mobile menu toggle logic might be added here later if needed

  // Manually start Alpine.js after all stores and components are registered.
  Alpine.start();
});
