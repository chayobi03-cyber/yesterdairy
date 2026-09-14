// Runs before paint via a plain inline script (not React) so the saved
// theme applies immediately — no flash of the default accent color.
export function ThemeInit() {
  const script = `
    try {
      var t = localStorage.getItem("haruvel-theme");
      if (t) document.documentElement.setAttribute("data-theme", t);
    } catch (e) {}
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
