const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("webshelf-theme") || "system";
    var isDark =
      stored === "dark" ||
      (stored === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  } catch (e) {}
})();
`;

/** Applies the persisted theme before first paint to avoid a light/dark flash. */
export function ThemeInit() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
