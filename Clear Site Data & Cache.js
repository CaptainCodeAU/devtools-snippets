(() => {
  try {
    // Open the Clear Browsing Data panel
    window.open('brave://settings/clearBrowserData', '_blank');
    console.log("Opened Clear Browsing Data panel. Please select 'Cookies and other site data' and 'Cached images and files', set time range to 'All time', and confirm.");
    // Prompt hard reload after manual clearing
    setTimeout(() => {
      if (confirm("Have you cleared the data? Click OK to perform a hard reload.")) {
        window.location.reload(true);
      }
    }, 5000); // Delay to allow user to clear data
  } catch (error) {
    console.error("Error opening Clear Browsing Data panel:", error);
    alert("Failed to open Clear Browsing Data panel. Please navigate to Settings > Privacy and security > Clear browsing data manually.");
  }
})();

// (async () => {
//   try {
//     // Clear cookies and site data for the current origin
//     await chrome.runtime.sendMessage({
//       message: "clear_site_data",
//       url: window.location.origin
//     });

//     // Clear cache for the current origin
//     await caches.delete(window.location.origin);

//     // Log success and prompt reload
//     console.log("Site data and cache cleared for", window.location.origin);
//     alert("Site data and cache cleared! Reloading page...");
//     window.location.reload(true); // Hard reload to bypass cache
//   } catch (error) {
//     console.error("Error clearing site data and cache:", error);
//     alert("Failed to clear site data and cache. Please try manually via Settings > Privacy and security > Clear browsing data.");
//   }
// })();