// N8N Component Inspector - Run this to understand the component structure
function inspectN8NComponent() {
    const n8nDemo = document.querySelector('n8n-demo');
    if (!n8nDemo) {
        console.log('❌ n8n-demo element not found');
        return;
    }
    
    console.log('🔍 N8N Component Analysis');
    console.log('=========================');
    
    // Basic element info
    console.log('📋 Basic Info:');
    console.log('- Tag name:', n8nDemo.tagName);
    console.log('- Class list:', [...n8nDemo.classList]);
    console.log('- Attributes:', [...n8nDemo.attributes].map(attr => `${attr.name}="${attr.value}"`));
    
    // Shadow DOM inspection
    console.log('\n🌑 Shadow DOM:');
    if (n8nDemo.shadowRoot) {
        console.log('- Has shadow root: YES');
        console.log('- Shadow children count:', n8nDemo.shadowRoot.children.length);
        console.log('- Shadow HTML preview:', n8nDemo.shadowRoot.innerHTML.substring(0, 500));
        
        // Look for overlays in shadow DOM
        const shadowOverlays = n8nDemo.shadowRoot.querySelectorAll('.overlay, [class*="overlay"]');
        console.log('- Overlays in shadow DOM:', shadowOverlays.length);
        shadowOverlays.forEach((overlay, i) => {
            console.log(`  Overlay ${i + 1}:`, overlay.outerHTML.substring(0, 200));
        });
        
        // Look for iframes in shadow DOM
        const shadowIframes = n8nDemo.shadowRoot.querySelectorAll('iframe');
        console.log('- Iframes in shadow DOM:', shadowIframes.length);
        shadowIframes.forEach((iframe, i) => {
            console.log(`  Iframe ${i + 1} classes:`, iframe.className);
            console.log(`  Iframe ${i + 1} src:`, iframe.src);
        });
    } else {
        console.log('- Has shadow root: NO');
        console.log('- Inner HTML preview:', n8nDemo.innerHTML.substring(0, 500));
    }
    
    // Custom element properties
    console.log('\n⚙️ Custom Element Properties:');
    const props = Object.getOwnPropertyNames(n8nDemo);
    const customProps = props.filter(prop => !prop.startsWith('_') && typeof n8nDemo[prop] !== 'function');
    console.log('- Custom properties:', customProps);
    
    // Methods
    const methods = props.filter(prop => typeof n8nDemo[prop] === 'function' && !prop.startsWith('_'));
    console.log('- Available methods:', methods);
    
    // Event listeners
    console.log('\n📡 Events:');
    console.log('- Event listeners keys:', Object.keys(n8nDemo).filter(key => key.startsWith('on')));
    
    // Style inspection
    console.log('\n🎨 Computed Styles:');
    const computedStyle = getComputedStyle(n8nDemo);
    console.log('- Display:', computedStyle.display);
    console.log('- Position:', computedStyle.position);
    console.log('- Width:', computedStyle.width);
    console.log('- Height:', computedStyle.height);
    console.log('- Z-index:', computedStyle.zIndex);
    
    // Look for data attributes
    console.log('\n📊 Data Attributes:');
    [...n8nDemo.attributes].forEach(attr => {
        if (attr.name.startsWith('data-') || attr.name === 'workflow') {
            console.log(`- ${attr.name}:`, attr.value.substring(0, 100));
        }
    });
    
    return n8nDemo;
}

// Monitor for changes
function monitorN8NComponent() {
    const n8nDemo = document.querySelector('n8n-demo');
    if (!n8nDemo) return;
    
    console.log('👀 Starting component monitoring...');
    
    // Monitor attribute changes
    const attributeObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.type === 'attributes') {
                console.log(`🔄 Attribute changed: ${mutation.attributeName} = ${mutation.target.getAttribute(mutation.attributeName)}`);
            }
        });
    });
    
    attributeObserver.observe(n8nDemo, { 
        attributes: true, 
        attributeOldValue: true 
    });
    
    // Monitor child changes
    const childObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    console.log('➕ Child added:', node.tagName, node.className);
                    if (node.tagName === 'IFRAME') {
                        console.log('🖼️ New iframe detected:', node.className, node.src);
                    }
                    if (node.className && node.className.includes('overlay')) {
                        console.log('⚠️ New overlay detected:', node.outerHTML.substring(0, 100));
                    }
                }
            });
            
            mutation.removedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    console.log('➖ Child removed:', node.tagName, node.className);
                }
            });
        });
    });
    
    childObserver.observe(n8nDemo, { 
        childList: true, 
        subtree: true 
    });
    
    // Monitor shadow DOM if it exists
    if (n8nDemo.shadowRoot) {
        const shadowObserver = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                console.log('🌑 Shadow DOM change detected:', mutation.type);
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE && node.className) {
                            console.log('🌑➕ Shadow child added:', node.tagName, node.className);
                        }
                    });
                }
            });
        });
        
        shadowObserver.observe(n8nDemo.shadowRoot, {
            childList: true,
            subtree: true,
            attributes: true
        });
    }
    
    // Auto-cleanup after 30 seconds
    setTimeout(() => {
        attributeObserver.disconnect();
        childObserver.disconnect();
        console.log('⏹️ Component monitoring stopped');
    }, 30000);
}

// Run both functions
console.log('🚀 Running N8N Component Analysis...');
inspectN8NComponent();
setTimeout(monitorN8NComponent, 1000);
