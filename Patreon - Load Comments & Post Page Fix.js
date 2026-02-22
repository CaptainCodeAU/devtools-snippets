/*
========================================
Patreon Page Helper Script - Enhanced Version
Includes:
✔ Auto-scroll and load replies
✔ Custom CSS injection
✔ Append YouTube links under videos
✔ Replace iframes with thumbnails in PDF
✔ Append source URL at bottom
✔ Generate dynamic PDF filename
========================================
*/

// --------------------------
// Utility: Generate Dynamic PDF File Name
// --------------------------
function generateDynamicFilename() {
    const currentYear = new Date().getFullYear();
    let dateText = document.querySelector('p.cm-VzrHRj span span')?.textContent.trim() || 'Unknown-Date';
    dateText = dateText.replace(/ (\d{1})$/, '-0$1').replace(/ (\d{2})$/, '-$1');

    const url = window.location.href;
    const slugMatch = url.match(/\/posts\/(.+)$/);
    const slug = slugMatch ? slugMatch[1] : 'unknown-post';

    return `[${currentYear}-${dateText}] - ${slug}.pdf`;
}

// --------------------------
// Utility: Append Source URL at the Bottom of the Page
// --------------------------
function appendSourceURLAtBottom() {
    // const commentsContainer = document.getElementById('content-card-comment-thread-container');
    const commentsContainer = document.querySelector('.sc-cd6b1d01-0.dKiySl');
    if (commentsContainer) {
        const urlDiv = document.createElement('div');
        urlDiv.style.marginTop = '0px';
        urlDiv.style.paddingTop = '0px';
        urlDiv.style.marginBottom = '0px';
        urlDiv.style.paddingBottom = '0px';
        urlDiv.style.textAlign = 'left';
        urlDiv.style.color = '#666';
        urlDiv.style.fontSize = '14px';
        urlDiv.style.fontFamily = 'Arial, sans-serif';
        urlDiv.textContent = `Source: ${window.location.href}`;

        // Instead of inserting after, append inside at the end
        // Append at the end inside the comments wrapper
        commentsContainer.appendChild(urlDiv);

        console.log('Appended source URL inside the Comments container.');
    } else {
        console.warn('⚠ Comments container not found!');
    }
}


// --------------------------
// Enhanced Step: Click all 'Load more comments' buttons recursively
// --------------------------
function clickAllLoadMoreComments(callback) {
    const buttons = Array.from(document.querySelectorAll('button[data-tag="loadMoreCommentsCta"]'));

    if (buttons.length === 0) {
        console.log('✅ All "Load more comments" buttons have been clicked.');
        if (callback) callback();
        return;
    }

    console.log(`🔄 Found ${buttons.length} "Load more comments" button(s). Clicking...`);

    buttons.forEach((btn, index) => {
        setTimeout(() => {
            btn.click();
            console.log(`Clicked 'Load more comments' button #${index + 1}`);
        }, index * 300);
    });

    // After clicking, scroll down and wait for AJAX to load comments
    setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        console.log('Waiting 500ms for comments to load...');
        setTimeout(() => {
            clickAllLoadMoreComments(callback);  // Recursively check again
        }, 500);
    }, buttons.length * 300 + 500);
}


// --------------------------
// Step 1: Click all 'Load replies' buttons
// --------------------------
function clickLoadReplies() {
    const buttons = Array.from(document.querySelectorAll('button'))
        .filter(btn => btn.textContent.trim() === 'Load replies');

    buttons.forEach((btn, index) => {
        setTimeout(() => {
            btn.click();
            console.log('Clicked:', btn);
        }, index * 170);
    });
}


// --------------------------
// Step 2: Inject custom CSS into the page
// --------------------------
function applyCustomCSS() {
    var style = document.createElement('style');
    style.innerText = `
        @media (min-width: 61.125rem) {
            .IVxBC { margin-left: 0px !important; margin-right: 0px !important; }
        }
        @media (min-width: 36.75rem) {
            .IVxBC { margin-left: 0px !important; margin-right: 0px !important; }
        }
        .IVxBC { margin-left: 0px !important; margin-right: 0px !important; }
        @media (min-width: 796px) {
            .cm-SGFdqH { grid-column-end: span 4 !important; }
        }
        .cm-SGFdqH { grid-column-end: span 4 !important; }
        .cTkLIR { -webkit-box-flex: 1; flex-grow: 1; padding: 0px !important; }
        @media (min-width: 61.125rem) {
            .jrAvmO { display: none !important; }
        }
        @media (min-width: 49.75rem) {
            .jrAvmO { display: none !important; }
        }
        .jrAvmO { display: none !important; }
        @media (min-width: 978px) {
            .cm-bklBuQ.cm-bklBuQ { width: 248px; }
        }
        .cm-bklBuQ.cm-bklBuQ { display: none !important; }
        .cm-WQyvHS, .hUdgkT, .DHcbG, .cgnjmc, .bmOift, .jCzoQM { display: none !important; }
        .cZIQtp { marginBottom: 0px !important; }
        .jqNqNk.jqNqNk.jqNqNk { display: none !important; }
    `;
    document.head.appendChild(style);
    console.log('Custom CSS applied.');

    // Append source URL at bottom
    appendSourceURLAtBottom();
}


// --------------------------
// Step 3: Append YouTube video links under embedded videos
// --------------------------
function appendYouTubeLinks() {
    document.querySelectorAll('iframe[src*="youtube.com/embed/"]').forEach(iframe => {
        const src = iframe.getAttribute('src');
        const match = src.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
        if (match) {
            const videoId = match[1];
            const ytLink = `https://www.youtube.com/watch?v=${videoId}`;

            const wrapper = document.createElement('div');
            wrapper.style.background = '#584104';
            wrapper.style.padding = '10px';
            wrapper.style.marginTop = '8px';
            wrapper.style.borderRadius = '6px';
            wrapper.style.textAlign = 'center';
            wrapper.style.fontFamily = 'Arial, sans-serif';

            const label = document.createElement('span');
            label.textContent = 'Source Video: ';
            label.style.fontWeight = '600';
            label.style.marginRight = '8px';
            label.style.color = '#fff';

            const link = document.createElement('a');
            link.href = ytLink;
            link.textContent = ytLink;
            link.target = '_blank';
            link.style.fontSize = '16px';
            link.style.fontWeight = 'bold';
            link.style.color = '#ffeb3b';
            link.style.textDecoration = 'none';

            wrapper.appendChild(label);
            wrapper.appendChild(link);

            iframe.parentNode.insertAdjacentElement('afterend', wrapper);
            console.log('Appended YouTube link:', ytLink);
        }
    });
}


async function getAvailableThumbnail(videoId) {
    const resolutions = ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault', 'default'];

    for (const res of resolutions) {
        const url = `https://img.youtube.com/vi/${videoId}/${res}.jpg`;
        try {
            const response = await fetch(url, { method: 'HEAD' });
            if (response.ok) {
                console.log(`✅ Found available thumbnail: ${url}`);
                return url;
            } else {
                console.log(`❌ Not found: ${url}`);
            }
        } catch (error) {
            console.warn(`⚠ Error checking thumbnail: ${url}`, error);
        }
    }

    console.warn(`⚠ No thumbnails available for videoId: ${videoId}`);
    return 'https://placehold.co/640x360?text=No+Thumbnail';
}

async function replaceIframesWithBestThumbnail() {
    const iframes = document.querySelectorAll('iframe[src*="youtube.com/embed/"]');

    for (const iframe of iframes) {
        const src = iframe.getAttribute('src');
        const match = src.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
        if (match) {
            const videoId = match[1];
            const bestThumbnail = await getAvailableThumbnail(videoId);

            const img = document.createElement('img');
            img.src = bestThumbnail;
            img.style.maxWidth = '100%';
            img.style.borderRadius = '8px';
            img.style.display = 'block';

            const link = document.createElement('a');
            link.href = `https://www.youtube.com/watch?v=${videoId}`;
            link.target = '_blank';
            link.appendChild(img);

            iframe.parentNode.replaceChild(link, iframe);
            console.log('✅ Replaced iframe with best available thumbnail:', bestThumbnail);
        }
    }
}



// --------------------------
// Step 4: Generate PDF with replaced YouTube thumbnails
// --------------------------
async function generateHtml2PDF_v103() {
    console.log('Preparing to generate PDF using html2pdf.js v0.10.3...');

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.3/html2pdf.bundle.min.js';
    script.onload = async () => {
        setTimeout(async () => {

            // Replace YouTube iframes with thumbnails using proper await in for...of loop
            const iframes = document.querySelectorAll('iframe[src*="youtube.com/embed/"]');
            for (const iframe of iframes) {
                const src = iframe.getAttribute('src');
                const match = src.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
                if (match) {
                    const videoId = match[1];
        
                    const bestThumbnailUrl = await getAvailableThumbnail(videoId);
            
                    const img = document.createElement('img');
                    img.src = bestThumbnailUrl;
                    img.style.maxWidth = '100%';
                    img.style.borderRadius = '8px';
                    img.style.display = 'block';
            
                    const link = document.createElement('a');
                    link.href = `https://www.youtube.com/watch?v=${videoId}`;
                    link.target = '_blank';
                    link.appendChild(img);
            
                    iframe.parentNode.replaceChild(link, iframe);
                    console.log('✅ Replaced iframe with best available thumbnail:', bestThumbnailUrl);
                }
            }

            // Generate PDF with dynamic filename
            const opt = {
                margin: [20, 15, 20, 15],
                filename: generateDynamicFilename(),
                image: { type: 'jpeg', quality: 1 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    allowTaint: false,
                    foreignObjectRendering: false,
                    backgroundColor: '#000',
                    logging: true
                },
                jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['css', 'legacy'], avoid: ['img', 'iframe', 'p'] }
            };

            const contentToCapture = document.querySelector('#main-content') || document.body;
            html2pdf().set(opt).from(contentToCapture).toContainer().toCanvas().toPdf().save().then(() => {
                console.log('PDF generated and downloaded successfully.');
            }).catch(err => {
                console.error('Error generating PDF:', err);
            });

        }, 1500);
    };
    document.body.appendChild(script);
}



// --------------------------
// Initial Step: Auto-scroll the page, then trigger main functions
// --------------------------
function autoScrollToBottom(callback) {
    console.log('🔽 Starting smart auto-scroll to bottom...');

    const scrollStep = window.innerHeight;
    const scrollDelay = 200;

    function scrollNext() {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight;
        const viewportHeight = window.innerHeight;

        if (scrollTop + viewportHeight >= scrollHeight - 50) {
            console.log('✅ Reached bottom of the page.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            if (callback) setTimeout(callback, 500);
            return;
        }

        window.scrollBy(0, scrollStep);
        console.log(`Scrolled to ${scrollTop + scrollStep}...`);
        setTimeout(scrollNext, scrollDelay);
    }

    scrollNext();
}


async function convertImageToBase64(url) {
    try {
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error('Network response was not OK');
        const blob = await response.blob();
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.warn(`⚠ CORS blocked or failed to fetch: ${url}. Using placeholder.`);
        return 'https://placehold.co/600x400?text=Blocked+Image';
    }
}

async function replaceImagesWithBase64() {
    const images = Array.from(document.querySelectorAll('img[src*="c8.patreon.com"]'));
    console.log(`🔍 Found ${images.length} Patreon CDN images to handle.`);

    for (const img of images) {
        const originalSrc = img.src;

        // Optional - try proxy first
        // const proxyUrl = 'https://cors-anywhere.herokuapp.com/' + originalSrc;
        // const base64DataUrl = await convertImageToBase64(proxyUrl);

        // For now, fallback directly to placeholder to avoid errors
        img.src = 'https://placehold.co/600x400?text=Blocked+Image';
        console.log(`✅ Replaced Patreon image with placeholder: ${originalSrc}`);
    }

    console.log('🎉 All Patreon images replaced or sanitized.');
}


// --------------------------
// Start the script sequence
// --------------------------
autoScrollToBottom(() => {
    clickAllLoadMoreComments(async () => {
        clickLoadReplies();
        applyCustomCSS();
        appendYouTubeLinks();

        await replaceImagesWithBase64();  // Wait for all images to be sanitized
        generateHtml2PDF_v103();          // Now safe to generate PDF
    });
});
