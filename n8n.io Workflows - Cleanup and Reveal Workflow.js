/*
========================================
N8N.io Page Modifier Script - Final Complete Version
Includes:
✔ Page load detection with user feedback
✔ Auto-scroll to load dynamic content
✔ CSS modifications for full viewport
✔ HTML class changes
✔ Element removal with proper timing
✔ Shadow DOM overlay and iframe fixes
✔ Persistent monitoring for component updates
✔ SPA navigation handling
========================================
*/

// --------------------------
// Step 1: Create user feedback notification
// --------------------------
function createNotification() {
    const notification = document.createElement('div');
    notification.id = 'n8n-modifier-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #1e293b;
        color: #fff;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-family: Arial, sans-serif;
        font-size: 14px;
        max-width: 300px;
        border-left: 4px solid #3b82f6;
    `;
    document.body.appendChild(notification);
    return notification;
}

function updateNotification(message) {
    const notification = document.getElementById('n8n-modifier-notification');
    if (notification) {
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 12px; height: 12px; border: 2px solid #3b82f6; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                ${message}
            </div>
            <style>
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        `;
    }
}

function removeNotification() {
    const notification = document.getElementById('n8n-modifier-notification');
    if (notification) {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        notification.style.transition = 'all 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }
}

// --------------------------
// Step 2: Smart page scrolling to load dynamic content
// --------------------------
function scrollToLoadContent() {
    return new Promise((resolve) => {
        updateNotification('Loading dynamic content...');
        
        let scrollCount = 0;
        const maxScrolls = 10;
        const scrollStep = window.innerHeight;
        
        function scrollNext() {
            if (scrollCount >= maxScrolls) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setTimeout(resolve, 1000);
                return;
            }
            
            const currentScroll = window.scrollY;
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            
            if (currentScroll >= maxScroll - 50) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setTimeout(resolve, 1000);
                return;
            }
            
            window.scrollBy({ top: scrollStep, behavior: 'smooth' });
            scrollCount++;
            
            setTimeout(scrollNext, 500);
        }
        
        scrollNext();
    });
}

// --------------------------
// Step 3: Apply custom CSS modifications
// --------------------------
function applyCustomCSS() {
    const style = document.createElement('style');
    style.id = 'n8n-modifier-styles';
    style.innerText = `
        /* Make max-width sections full viewport */
        .max-w-section-default {
            width: 100vw !important;
            height: 100vh !important;
            max-width: 100% !important;
        }
        
        /* Make embedded workflow iframe full viewport */
        .embedded_workflow_iframe {
            width: 100vw !important;
            height: 100vh !important;
            border: 0px !important;
            border-radius: var(--n8n-iframe-border-radius, 0px) !important;
        }
        
        /* Target the n8n-demo element specifically */
        n8n-demo {
            width: 100vw !important;
            height: 100vh !important;
            display: block !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            z-index: 9999 !important;
        }
        
        /* Remove any container constraints */
        .base-frame, .base-frame-inner {
            width: 100% !important;
            height: 100% !important;
        }
        
        /* Hide body overflow to prevent scrollbars */
        body {
            overflow: hidden !important;
        }
        
        /* Reduce padding for hero section */
        @media (min-width: 1024px) {
            .lg\\:pt-section-hero-gap-y-lg {
                padding-top: 10px !important;
            }
        }
        
        /* Reduce horizontal padding */
        @media (min-width: 1024px) {
            .lg\\:px-section-gap-x-lg {
                padding-left: 10px !important;
                padding-right: 10px !important;
            }
        }
    `;
    document.head.appendChild(style);
    console.log('✅ Custom CSS applied to n8n.io page.');
}

// --------------------------
// Step 4: Modify HTML classes
// --------------------------
function modifyHTMLClasses() {
    // Change lg:w-8/12 to lg:w-full
    const elements = document.querySelectorAll('[class*="lg:w-8/12"]');
    elements.forEach(element => {
        element.className = element.className.replace('lg:w-8/12', 'lg:w-full');
        console.log('✅ Changed class from lg:w-8/12 to lg:w-full');
    });
}

// --------------------------
// Step 5: Remove unwanted elements
// --------------------------
function removeUnwantedElements() {
    const selectorsToRemove = [
        '#teleports',
        '.nuxt-loading-indicator',
        'header[data-v-d736b8f1]',
        'footer[data-v-99504dd8]',
        'section.section-similar-workflows',
        'section.section-creator-workflows',
    ];

    selectorsToRemove.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.remove();
                console.log(`✅ Removed element: ${selector}`);
            });
        } catch (error) {
            console.log(`⚠️ Could not find or remove: ${selector}`);
        }
    });

    // More aggressive targeting for the lg:w-4/12 div
    const heroDivs = document.querySelectorAll('div[data-v-7c888842]');
    heroDivs.forEach(div => {
        if (div.className.includes('lg:w-4/12')) {
            div.remove();
            console.log('✅ Removed lg:w-4/12 div');
        }
    });

    // Remove sections that don't contain the workflow viewer
    const generalSections = document.querySelectorAll('section[data-v-7c888842].w-full');
    generalSections.forEach(section => {
        if (!section.querySelector('n8n-demo') && !section.querySelector('#int_iframe')) {
            section.remove();
            console.log('✅ Removed general section without workflow viewer');
        }
    });
}

// --------------------------
// Step 6: Remove interfering scripts
// --------------------------
function removeInterferingScripts() {
    // Remove Nuxt data script
    const nuxtDataScript = document.querySelector('script[data-nuxt-data="nuxt-app"]');
    if (nuxtDataScript) {
        nuxtDataScript.remove();
        console.log('✅ Removed Nuxt data script');
    }
    
    // Remove Nuxt config script
    const configScripts = Array.from(document.querySelectorAll('script')).filter(script => 
        script.textContent && script.textContent.includes('window.__NUXT__')
    );
    configScripts.forEach(script => {
        script.remove();
        console.log('✅ Removed Nuxt config script');
    });
    
    // Remove Cloudflare insights script
    const cfScript = document.querySelector('script[src*="cloudflareinsights.com"]');
    if (cfScript) {
        cfScript.remove();
        console.log('✅ Removed Cloudflare insights script');
    }
}

// --------------------------
// Step 7: Shadow DOM fixes - The critical breakthrough
// --------------------------
function fixN8nShadowDOM() {
    const n8nDemo = document.querySelector('n8n-demo');
    if (!n8nDemo || !n8nDemo.shadowRoot) {
        console.log('❌ n8n-demo element or shadow root not found');
        return false;
    }
    
    console.log('🎯 Applying shadow DOM fixes...');
    
    // Fix 1: Remove the overlay completely from shadow DOM
    const overlay = n8nDemo.shadowRoot.querySelector('.overlay');
    if (overlay) {
        overlay.remove();
        console.log('✅ Overlay removed from shadow DOM');
    }
    
    // Fix 2: Remove non_interactive class from iframe in shadow DOM
    const iframe = n8nDemo.shadowRoot.querySelector('iframe');
    if (iframe) {
        iframe.classList.remove('non_interactive');
        iframe.style.pointerEvents = 'auto';
        console.log('✅ Removed non_interactive class from shadow iframe');
        console.log('📋 New iframe classes:', iframe.className);
    }
    
    // Fix 3: Apply full viewport styling within shadow DOM
    const embeddedWorkflow = n8nDemo.shadowRoot.querySelector('.embedded_workflow');
    if (embeddedWorkflow) {
        embeddedWorkflow.style.cssText = `
            width: 100vw !important;
            height: 100vh !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            z-index: 9999 !important;
        `;
        console.log('✅ Applied full viewport to embedded_workflow container');
    }
    
    const canvasContainer = n8nDemo.shadowRoot.querySelector('.canvas-container');
    if (canvasContainer) {
        canvasContainer.style.cssText = `
            width: 100% !important;
            height: 100% !important;
        `;
        console.log('✅ Applied full size to canvas-container');
    }
    
    // Fix 4: Inject CSS directly into shadow DOM
    const shadowStyle = document.createElement('style');
    shadowStyle.textContent = `
        .embedded_workflow {
            width: 100vw !important;
            height: 100vh !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            z-index: 9999 !important;
        }
        
        .canvas-container {
            width: 100% !important;
            height: 100% !important;
            position: relative !important;
        }
        
        .overlay {
            display: none !important;
            visibility: hidden !important;
        }
        
        .embedded_workflow_iframe {
            width: 100% !important;
            height: 100% !important;
            border: none !important;
            pointer-events: auto !important;
        }
        
        .non_interactive {
            pointer-events: auto !important;
        }
    `;
    n8nDemo.shadowRoot.appendChild(shadowStyle);
    console.log('✅ Injected CSS into shadow DOM');
    
    // Fix 5: Modify component attributes
    n8nDemo.setAttribute('disableinteractivity', 'false');
    n8nDemo.setAttribute('clicktointeract', 'true');
    console.log('✅ Updated component attributes for interactivity');
    
    return true;
}

// --------------------------
// Step 8: Persistent monitoring to prevent component regression
// --------------------------
function setupPersistentShadowDOMMonitoring() {
    const n8nDemo = document.querySelector('n8n-demo');
    if (!n8nDemo || !n8nDemo.shadowRoot) return;
    
    console.log('🛡️ Setting up persistent shadow DOM monitoring...');
    
    const observer = new MutationObserver((mutations) => {
        let needsRefix = false;
        
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if overlay was re-added
                        if (node.classList && node.classList.contains('overlay')) {
                            console.log('🔄 Overlay re-added, removing...');
                            node.remove();
                            needsRefix = true;
                        }
                        
                        // Check if iframe was re-added with non_interactive
                        if (node.tagName === 'IFRAME' && node.classList.contains('non_interactive')) {
                            console.log('🔄 Iframe with non_interactive re-added, fixing...');
                            needsRefix = true;
                        }
                    }
                });
            }
            
            if (mutation.type === 'attributes' && mutation.target.tagName === 'IFRAME') {
                if (mutation.target.classList.contains('non_interactive')) {
                    console.log('🔄 non_interactive class re-added to iframe, fixing...');
                    needsRefix = true;
                }
            }
        });
        
        if (needsRefix) {
            setTimeout(fixN8nShadowDOM, 100);
        }
    });
    
    observer.observe(n8nDemo.shadowRoot, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
    });
    
    console.log('✅ Persistent shadow DOM monitoring active');
    
    // Clean up after 5 minutes to prevent memory leaks
    setTimeout(() => {
        observer.disconnect();
        console.log('🔄 Persistent monitoring stopped (5min timeout)');
    }, 300000);
}

// --------------------------
// Step 9: Wait for complete page load
// --------------------------
function waitForCompleteLoad() {
    return new Promise((resolve) => {
        if (document.readyState === 'complete') {
            resolve();
            return;
        }
        
        const checkLoad = () => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                setTimeout(checkLoad, 100);
            }
        };
        
        checkLoad();
    });
}

// --------------------------
// Step 10: Wait for shadow DOM to be ready
// --------------------------
function waitForShadowDOM() {
    return new Promise((resolve) => {
        function checkShadowDOM() {
            const n8nDemo = document.querySelector('n8n-demo');
            if (n8nDemo && n8nDemo.shadowRoot) {
                const iframe = n8nDemo.shadowRoot.querySelector('iframe');
                if (iframe && iframe.src) {
                    console.log('✅ Shadow DOM component fully loaded');
                    resolve();
                    return;
                }
            }
            
            console.log('⏳ Waiting for shadow DOM to be ready...');
            setTimeout(checkShadowDOM, 500);
        }
        
        checkShadowDOM();
    });
}

// --------------------------
// Step 11: Main execution function
// --------------------------
async function executeModifications() {
    const notification = createNotification();
    
    try {
        updateNotification('Waiting for page to load...');
        await waitForCompleteLoad();
        
        updateNotification('Loading dynamic content...');
        await scrollToLoadContent();
        
        updateNotification('Waiting for component to initialize...');
        await waitForShadowDOM();
        
        updateNotification('Applying modifications...');
        
        // Wait a bit more for final loading
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Apply all modifications in the correct order
        applyCustomCSS();
        modifyHTMLClasses();
        removeUnwantedElements();
        removeInterferingScripts();
        
        // Apply the critical shadow DOM fixes
        updateNotification('Fixing shadow DOM components...');
        if (fixN8nShadowDOM()) {
            setupPersistentShadowDOMMonitoring();
            console.log('✅ Shadow DOM fixes applied successfully');
        } else {
            console.log('⚠️ Shadow DOM fixes could not be applied');
        }
        
        updateNotification('Modifications complete!');
        
        // Remove notification after success
        setTimeout(removeNotification, 2000);
        
        console.log('🎉 All n8n.io page modifications completed successfully!');
        
    } catch (error) {
        updateNotification('Error occurred during modifications');
        console.error('❌ Error during modifications:', error);
        setTimeout(removeNotification, 3000);
    }
}

// --------------------------
// Step 12: Initialize the script with SPA navigation handling
// --------------------------
console.log('🚀 Starting complete n8n.io page modifications...');
executeModifications();

// Handle SPA navigation by re-running the script when URL changes
let currentUrl = window.location.href;
setInterval(() => {
    if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        console.log('🔄 URL changed, reapplying modifications...');
        setTimeout(executeModifications, 3000);
    }
}, 1000);
