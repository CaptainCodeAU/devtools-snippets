(function () {
    // === Dynamic Filename Generation ===
    function generateDynamicFilename() {
        const now = new Date();
        const currentYear = now.getFullYear();
        let dateText;

        try {
            // Try to extract date from the target selector
            dateText = document.querySelector('p.cm-VzrHRj span span')?.textContent?.trim();
        } catch (e) {
            console.warn('Error querying date element:', e);
        }

        // If not found or empty, fallback to MM-DD
        if (!dateText) {
            dateText = `${now.getMonth() + 1}-${now.getDate()}`;
        }

        // Try to normalize formats like "6 1" → "6-01"
        dateText = dateText.replace(/ (\d{1})$/, '-0$1').replace(/ (\d{2})$/, '-$1');

        let slug = 'unknown-post';
        try {
            const match = window.location.pathname.match(/\/posts\/([^/?#]+)/);
            if (match && match[1]) slug = match[1];
        } catch (e) {
            // Just stick to fallback
        }

        return `[${currentYear}-${dateText}] - ${slug}.pdf`;
    }

    // === PDF Generation Attempt ===
    function tryHtml2Pdf() {
        console.log('Attempting PDF generation using html2pdf.js...');
        let script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.3/html2pdf.bundle.min.js';
        script.onload = function () {
            try {
                let filename = generateDynamicFilename();
                let content = document.querySelector('#main-content') || document.body;
                let opts = {
                    margin: [20, 15, 20, 15],
                    filename: filename,
                    image: { type: 'jpeg', quality: 1 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
                    pagebreak: { mode: ['css', 'legacy'], avoid: ['img', 'p'] }
                };
                window.html2pdf()
                    .set(opts)
                    .from(content)
                    .toContainer()
                    .toCanvas()
                    .toPdf()
                    .save()
                    .then(() => console.log('PDF generated and saved:', filename))
                    .catch(e => console.error('html2pdf.js error:', e));
            } catch (e) {
                console.error('Exception in PDF generation:', e);
            }
        };
        script.onerror = function () {
            console.error('Could not load html2pdf.js. CSP may be blocking the request.');
        };
        try {
            document.body.appendChild(script);
        } catch (e) {
            console.error('Could not append html2pdf.js script tag:', e);
        }
    }

    // === Main Execution ===
    try {
        tryHtml2Pdf();
    } catch (e) {
        console.error('Fatal error in script:', e);
    }
})();

