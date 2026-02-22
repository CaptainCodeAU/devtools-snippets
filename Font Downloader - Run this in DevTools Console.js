// Font Downloader - Run this in DevTools Console
(async function downloadFonts() {
  // Get the Google Fonts CSS URL from the page
  const fontCssUrl = 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap';

  console.log('📥 Fetching Google Fonts CSS...');
  const response = await fetch(fontCssUrl);
  const css = await response.text();

  // Extract all font URLs
  const fontUrls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/g)]
    .map(m => m[1]);

  console.log(`Found ${fontUrls.length} font files`);

  // Filter to just latin (most sites only need these)
  // Comment out these lines if you need all character sets
  const latinFonts = fontUrls.filter(url =>
    css.split(url)[0].split('@font-face').pop().includes('latin') &&
    !css.split(url)[0].split('@font-face').pop().includes('latin-ext')
  );

  console.log(`\n🔤 Font URLs to download (${fontUrls.length} total, showing all):\n`);
  fontUrls.forEach((url, i) => console.log(`${i + 1}. ${url}`));

  console.log('\n\n📋 WGET COMMANDS (copy and run in terminal):\n');
  console.log('mkdir -p fonts && cd fonts');
  fontUrls.forEach(url => {
    const filename = url.split('/').pop();
    console.log(`wget "${url}" -O "${filename}"`);
  });

  console.log('\n\n📋 OR USE CURL:\n');
  console.log('mkdir -p fonts && cd fonts');
  fontUrls.forEach(url => {
    const filename = url.split('/').pop();
    console.log(`curl -o "${filename}" "${url}"`);
  });
})();