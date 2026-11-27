// Switches the theme of the site between light and dark, and saves the choice.

function isDark(): boolean {
  const root = document.documentElement;
  return (
    root.dataset.theme === 'dark' ||
    (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches)
  );
}

export function switchTheme(): void {
  const root = document.documentElement;
  root.dataset.theme = isDark() ? 'light' : 'dark';
  try {
    localStorage.setItem('theme', root.dataset.theme);
  } catch {
    // Storage can be blocked. The theme still changes for this page.
  }
}
