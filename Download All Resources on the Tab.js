// Get all images and resources linked in the page
const resources = [];
const links = document.querySelectorAll('img, link, script, source, iframe');  // Add more elements as needed

links.forEach(link => {
    if (link.src) resources.push(link.src);  // For img, iframe, source, etc.
    if (link.href) resources.push(link.href);  // For link tags (stylesheets, etc.)
});

// Download all the resources
resources.forEach(url => {
    const link = document.createElement('a');
    link.href = url;
    link.download = url.split('/').pop();  // Get file name from URL
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});
