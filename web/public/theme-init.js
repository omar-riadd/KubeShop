(function () {
  try {
    var saved = localStorage.getItem('kubeshop.theme');
    var theme = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
    var isDark =
      theme === 'dark' ||
      (theme === 'system' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  } catch (_) {
    // Ignore storage/media errors in restricted environments
  }
})();
