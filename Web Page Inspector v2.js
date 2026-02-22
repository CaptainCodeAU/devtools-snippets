/*
========================================
Advanced Web Page Inspector & Diagnostic Tool
A comprehensive analysis tool for modern web pages
Designed to reveal DOM structure, frameworks, components, and technical details
========================================
*/

class WebPageInspector {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            analysis: {}
        };

        this.startTime = performance.now();
    }

    // Main analysis orchestrator
    async runFullAnalysis() {
        console.log('🚀 Starting Advanced Web Page Analysis...');
        console.log('================================================');

        try {
            // Core DOM analysis
            await this.analyzePageStructure();
            await this.analyzeFrameworks();
            await this.analyzeWebComponents();
            await this.analyzeShadowDOM();
            await this.analyzeIframes();
            await this.analyzeScripts();
            await this.analyzeStylesheets();
            await this.analyzeMetadata();
            await this.analyzeSecurity();
            await this.analyzePerformance();
            await this.analyzeAccessibility();
            await this.analyzeDynamicContent();
            await this.analyzeEventListeners();
            await this.analyzeStorage();
            await this.analyzeNetwork();

            // Summary and recommendations
            this.generateSummary();
            this.generateRecommendations();

            const endTime = performance.now();
            console.log(`\n⏱️ Analysis completed in ${(endTime - this.startTime).toFixed(2)}ms`);

            return this.results;

        } catch (error) {
            console.error('❌ Analysis failed:', error);
            return { error: error.message, partialResults: this.results };
        }
    }

    // 1. Page Structure Analysis
    async analyzePageStructure() {
        console.log('\n📋 ANALYZING PAGE STRUCTURE');
        console.log('============================');

        const structure = {
            doctype: document.doctype ? document.doctype.name : 'None',
            documentElement: document.documentElement.tagName,
            head: {
                title: document.title || 'No title',
                metaCount: document.querySelectorAll('meta').length,
                linkCount: document.querySelectorAll('link').length,
                scriptCount: document.querySelectorAll('head script').length
            },
            body: {
                id: document.body.id || 'No ID',
                classes: [...document.body.classList],
                childElementCount: document.body.childElementCount,
                totalElements: document.querySelectorAll('*').length
            },
            semanticElements: this.countSemanticElements(),
            customElements: this.findCustomElements(),
            dataAttributes: this.analyzeDataAttributes()
        };

        console.log('Document Type:', structure.doctype);
        console.log('Total Elements:', structure.body.totalElements);
        console.log('Body Classes:', structure.body.classes);
        console.log('Custom Elements Found:', structure.customElements.length);
        console.log('Semantic Elements:', structure.semanticElements);

        this.results.analysis.structure = structure;
    }

    countSemanticElements() {
        const semanticTags = ['header', 'nav', 'main', 'article', 'section', 'aside', 'footer', 'figure', 'figcaption', 'details', 'summary'];
        const counts = {};

        semanticTags.forEach(tag => {
            counts[tag] = document.querySelectorAll(tag).length;
        });

        return counts;
    }

    findCustomElements() {
        const allElements = document.querySelectorAll('*');
        const customElements = [];
        const standardTags = new Set(['DIV', 'SPAN', 'P', 'A', 'IMG', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'HEADER', 'FOOTER', 'NAV', 'MAIN', 'SECTION', 'ARTICLE', 'ASIDE', 'BUTTON', 'INPUT', 'FORM', 'TABLE', 'TR', 'TD', 'TH', 'TBODY', 'THEAD', 'SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'HTML', 'HEAD', 'BODY']);

        allElements.forEach(el => {
            if (!standardTags.has(el.tagName) && el.tagName.includes('-')) {
                customElements.push({
                    tagName: el.tagName,
                    id: el.id,
                    classes: [...el.classList],
                    attributes: [...el.attributes].map(attr => `${attr.name}="${attr.value.substring(0, 50)}${attr.value.length > 50 ? '...' : ''}"`),
                    hasShadowRoot: !!el.shadowRoot,
                    innerHTML: el.innerHTML.substring(0, 200) + (el.innerHTML.length > 200 ? '...' : '')
                });
            }
        });

        return customElements;
    }

    analyzeDataAttributes() {
        const allElements = document.querySelectorAll('*');
        const dataAttributes = new Set();

        allElements.forEach(el => {
            [...el.attributes].forEach(attr => {
                if (attr.name.startsWith('data-')) {
                    dataAttributes.add(attr.name);
                }
            });
        });

        return {
            uniqueDataAttributes: [...dataAttributes],
            count: dataAttributes.size
        };
    }

    // 2. Framework Detection
    async analyzeFrameworks() {
        console.log('\n🏗️ ANALYZING FRAMEWORKS & LIBRARIES');
        console.log('===================================');

        const frameworks = {
            detected: [],
            indicators: {},
            globalObjects: this.checkGlobalObjects(),
            cssFrameworks: this.detectCSSFrameworks(),
            buildTools: this.detectBuildTools()
        };

        // Framework detection patterns
        const detectionPatterns = {
            'React': () => window.React || document.querySelector('[data-reactroot]') || document.querySelector('[data-react-helmet]'),
            'Vue.js': () => window.Vue || document.querySelector('[data-v-]') || document.querySelector('[v-]'),
            'Angular': () => window.ng || document.querySelector('[ng-]') || document.querySelector('[data-ng-]'),
            'Nuxt.js': () => window.__NUXT__ || document.querySelector('#__nuxt'),
            'Next.js': () => window.__NEXT_DATA__ || document.querySelector('#__next'),
            'jQuery': () => window.jQuery || window.$,
            'Lit': () => window.lit || document.querySelector('[data-lit]'),
            'Alpine.js': () => window.Alpine || document.querySelector('[x-data]'),
            'Svelte': () => document.querySelector('[svelte-]'),
            'Ember.js': () => window.Ember || document.querySelector('[data-ember-]'),
            'Backbone.js': () => window.Backbone,
            'D3.js': () => window.d3,
            'Three.js': () => window.THREE,
            'GSAP': () => window.gsap || window.TweenMax,
            'Chart.js': () => window.Chart,
            'Lodash': () => window._ && window._.VERSION,
            'Moment.js': () => window.moment,
            'Bootstrap': () => window.bootstrap || document.querySelector('.bootstrap') || document.querySelector('[class*="bs-"]'),
            'Tailwind CSS': () => document.querySelector('[class*="bg-"]') && document.querySelector('[class*="text-"]'),
            'Material-UI': () => window.MaterialUI || document.querySelector('[class*="Mui"]'),
            'Ant Design': () => window.antd || document.querySelector('[class*="ant-"]')
        };

        Object.entries(detectionPatterns).forEach(([name, detector]) => {
            try {
                const detected = detector();
                if (detected) {
                    frameworks.detected.push(name);
                    frameworks.indicators[name] = typeof detected === 'object' ? 'Object detected' : detected.toString().substring(0, 100);
                }
            } catch (e) {
                // Silent fail for framework detection
            }
        });

        console.log('Detected Frameworks:', frameworks.detected);
        console.log('CSS Frameworks:', frameworks.cssFrameworks);
        console.log('Global Objects:', Object.keys(frameworks.globalObjects));

        this.results.analysis.frameworks = frameworks;
    }

    checkGlobalObjects() {
        const commonGlobals = ['React', 'Vue', 'Angular', 'jQuery', '$', 'gsap', 'd3', 'THREE', 'Chart', '_', 'moment', 'axios', 'fetch'];
        const detected = {};

        commonGlobals.forEach(obj => {
            if (window[obj]) {
                detected[obj] = {
                    type: typeof window[obj],
                    version: window[obj].version || window[obj].VERSION || 'Unknown',
                    properties: Object.keys(window[obj]).slice(0, 10)
                };
            }
        });

        return detected;
    }

    detectCSSFrameworks() {
        const frameworks = [];
        const stylesheets = [...document.styleSheets];

        // Check for CSS framework indicators in classes
        const allElements = document.querySelectorAll('*');
        const classPatterns = {
            'Bootstrap': /\b(container|row|col-|btn-|card-|navbar-|modal-)\w*/,
            'Tailwind CSS': /\b(bg-|text-|p-|m-|flex|grid|w-|h-)\w*/,
            'Bulma': /\b(is-|has-|column|level|hero|navbar)\w*/,
            'Foundation': /\b(foundation|grid-|cell|callout)\w*/,
            'Materialize': /\b(materialize|btn|card|collection)\w*/,
            'Semantic UI': /\b(ui |semantic|button|menu|dropdown)\w*/,
            'Material-UI': /\b(Mui|makeStyles|withStyles)\w*/,
            'Ant Design': /\bant-\w*/
        };

        Object.entries(classPatterns).forEach(([framework, pattern]) => {
            let found = false;
            for (let el of allElements) {
                if (pattern.test(el.className)) {
                    found = true;
                    break;
                }
            }
            if (found) frameworks.push(framework);
        });

        return frameworks;
    }

    detectBuildTools() {
        const indicators = [];

        // Check for build tool indicators
        if (document.querySelector('script[src*="webpack"]')) indicators.push('Webpack');
        if (document.querySelector('script[src*="vite"]')) indicators.push('Vite');
        if (document.querySelector('script[src*="parcel"]')) indicators.push('Parcel');
        if (window.__webpack_require__) indicators.push('Webpack (runtime)');
        if (window.__vite__) indicators.push('Vite (runtime)');

        return indicators;
    }

    // 3. Web Components Analysis
    async analyzeWebComponents() {
        console.log('\n🧩 ANALYZING WEB COMPONENTS');
        console.log('============================');

        const components = {
            customElements: [],
            shadowRoots: [],
            autonomousElements: [],
            customizedBuiltIns: []
        };

        // Find all custom elements
        const allElements = document.querySelectorAll('*');

        allElements.forEach(el => {
            // Check if it's a custom element (contains hyphen)
            if (el.tagName.includes('-')) {
                const componentInfo = {
                    tagName: el.tagName,
                    id: el.id,
                    classes: [...el.classList],
                    attributes: [...el.attributes].map(attr => ({
                        name: attr.name,
                        value: attr.value.length > 100 ? attr.value.substring(0, 100) + '...' : attr.value
                    })),
                    hasShadowRoot: !!el.shadowRoot,
                    shadowRootMode: el.shadowRoot ? el.shadowRoot.mode : null,
                    innerHTML: el.innerHTML.substring(0, 300) + (el.innerHTML.length > 300 ? '...' : ''),
                    computedStyle: {
                        display: getComputedStyle(el).display,
                        position: getComputedStyle(el).position,
                        width: getComputedStyle(el).width,
                        height: getComputedStyle(el).height
                    },
                    customProperties: this.getCustomElementProperties(el),
                    events: this.getElementEventListeners(el)
                };

                components.customElements.push(componentInfo);

                // Analyze shadow root if present
                if (el.shadowRoot) {
                    components.shadowRoots.push(this.analyzeShadowRoot(el, el.shadowRoot));
                }
            }
        });

        console.log('Custom Elements Found:', components.customElements.length);
        console.log('Shadow Roots Found:', components.shadowRoots.length);

        components.customElements.forEach(comp => {
            console.log(`  - ${comp.tagName}: ${comp.hasShadowRoot ? 'Has Shadow DOM' : 'No Shadow DOM'}`);
        });

        this.results.analysis.webComponents = components;
    }

    getCustomElementProperties(element) {
        const props = {};
        const allProps = Object.getOwnPropertyNames(element);

        // Filter out standard DOM properties
        const standardProps = ['id', 'className', 'innerHTML', 'outerHTML', 'tagName', 'nodeName', 'nodeType'];
        const customProps = allProps.filter(prop =>
            !prop.startsWith('_') &&
            !standardProps.includes(prop) &&
            typeof element[prop] !== 'function'
        );

        customProps.forEach(prop => {
            try {
                const value = element[prop];
                props[prop] = {
                    type: typeof value,
                    value: typeof value === 'object' ? '[Object]' : String(value).substring(0, 100)
                };
            } catch (e) {
                props[prop] = { type: 'unknown', value: 'Access denied' };
            }
        });

        return props;
    }

    // 4. Shadow DOM Deep Analysis
    async analyzeShadowDOM() {
        console.log('\n🌑 ANALYZING SHADOW DOM');
        console.log('=======================');

        const shadowAnalysis = {
            shadowRoots: [],
            totalShadowElements: 0,
            shadowStyles: [],
            shadowScripts: []
        };

        // Find all elements with shadow roots
        const allElements = document.querySelectorAll('*');

        allElements.forEach(el => {
            if (el.shadowRoot) {
                const analysis = this.analyzeShadowRoot(el, el.shadowRoot);
                shadowAnalysis.shadowRoots.push(analysis);
                shadowAnalysis.totalShadowElements += analysis.elementCount;
            }
        });

        console.log('Shadow Roots Found:', shadowAnalysis.shadowRoots.length);
        console.log('Total Shadow Elements:', shadowAnalysis.totalShadowElements);

        this.results.analysis.shadowDOM = shadowAnalysis;
    }

    analyzeShadowRoot(hostElement, shadowRoot) {
        const analysis = {
            host: {
                tagName: hostElement.tagName,
                id: hostElement.id,
                classes: [...hostElement.classList]
            },
            mode: shadowRoot.mode,
            elementCount: shadowRoot.querySelectorAll('*').length,
            innerHTML: shadowRoot.innerHTML.substring(0, 500) + (shadowRoot.innerHTML.length > 500 ? '...' : ''),
            styles: [],
            scripts: [],
            elements: {},
            customElements: [],
            eventListeners: []
        };

        // Analyze styles in shadow DOM
        const shadowStyles = shadowRoot.querySelectorAll('style');
        shadowStyles.forEach((style, index) => {
            analysis.styles.push({
                index,
                content: style.textContent.substring(0, 200) + (style.textContent.length > 200 ? '...' : ''),
                length: style.textContent.length
            });
        });

        // Analyze scripts in shadow DOM
        const shadowScripts = shadowRoot.querySelectorAll('script');
        shadowScripts.forEach((script, index) => {
            analysis.scripts.push({
                index,
                src: script.src || 'inline',
                content: script.textContent.substring(0, 200) + (script.textContent.length > 200 ? '...' : ''),
                length: script.textContent.length
            });
        });

        // Count element types in shadow DOM
        const shadowElements = shadowRoot.querySelectorAll('*');
        shadowElements.forEach(el => {
            const tagName = el.tagName.toLowerCase();
            analysis.elements[tagName] = (analysis.elements[tagName] || 0) + 1;

            // Check for nested custom elements
            if (tagName.includes('-')) {
                analysis.customElements.push({
                    tagName: el.tagName,
                    classes: [...el.classList],
                    attributes: [...el.attributes].map(attr => `${attr.name}="${attr.value}"`)
                });
            }
        });

        return analysis;
    }

    // 5. Iframe Analysis
    async analyzeIframes() {
        console.log('\n🖼️ ANALYZING IFRAMES');
        console.log('====================');

        const iframes = [...document.querySelectorAll('iframe')];
        const analysis = {
            count: iframes.length,
            details: []
        };

        iframes.forEach((iframe, index) => {
            const detail = {
                index,
                src: iframe.src,
                id: iframe.id,
                name: iframe.name,
                classes: [...iframe.classList],
                attributes: [...iframe.attributes].map(attr => `${attr.name}="${attr.value}"`),
                dimensions: {
                    width: iframe.width || getComputedStyle(iframe).width,
                    height: iframe.height || getComputedStyle(iframe).height
                },
                loading: iframe.loading,
                sandbox: iframe.sandbox.toString(),
                allowfullscreen: iframe.allowFullscreen,
                contentAccessible: false
            };

            // Try to access iframe content (will fail for cross-origin)
            try {
                detail.contentDocument = !!iframe.contentDocument;
                detail.contentWindow = !!iframe.contentWindow;
                if (iframe.contentDocument) {
                    detail.contentTitle = iframe.contentDocument.title;
                    detail.contentURL = iframe.contentDocument.location.href;
                    detail.contentAccessible = true;
                }
            } catch (e) {
                detail.crossOrigin = true;
                detail.accessError = e.message;
            }

            analysis.details.push(detail);
        });

        console.log('Iframes Found:', analysis.count);
        analysis.details.forEach(detail => {
            console.log(`  - ${detail.src || 'No src'}: ${detail.classes.join(' ')} (${detail.contentAccessible ? 'Accessible' : 'Cross-origin'})`);
        });

        this.results.analysis.iframes = analysis;
    }

    // 6. Scripts Analysis
    async analyzeScripts() {
        console.log('\n📜 ANALYZING SCRIPTS');
        console.log('====================');

        const scripts = [...document.querySelectorAll('script')];
        const analysis = {
            total: scripts.length,
            inline: 0,
            external: 0,
            modules: 0,
            details: [],
            sources: new Set(),
            content: {
                totalSize: 0,
                patterns: {}
            }
        };

        scripts.forEach((script, index) => {
            const detail = {
                index,
                src: script.src,
                type: script.type || 'text/javascript',
                async: script.async,
                defer: script.defer,
                module: script.type === 'module',
                crossorigin: script.crossOrigin,
                integrity: script.integrity,
                nomodule: script.noModule,
                contentLength: script.textContent.length,
                contentPreview: script.textContent.substring(0, 200) + (script.textContent.length > 200 ? '...' : '')
            };

            if (script.src) {
                analysis.external++;
                analysis.sources.add(new URL(script.src, window.location.href).hostname);
            } else {
                analysis.inline++;
                analysis.content.totalSize += script.textContent.length;
            }

            if (script.type === 'module') {
                analysis.modules++;
            }

            analysis.details.push(detail);
        });

        // Convert Set to Array for serialization
        analysis.sources = [...analysis.sources];

        console.log('Total Scripts:', analysis.total);
        console.log('External:', analysis.external, '| Inline:', analysis.inline, '| Modules:', analysis.modules);
        console.log('External Sources:', analysis.sources);

        this.results.analysis.scripts = analysis;
    }

    // 7. Stylesheets Analysis
    async analyzeStylesheets() {
        console.log('\n🎨 ANALYZING STYLESHEETS');
        console.log('========================');

        const analysis = {
            links: [],
            inline: [],
            computed: {},
            cssVariables: this.extractCSSVariables(),
            animations: this.extractAnimations(),
            mediaQueries: this.extractMediaQueries()
        };

        // Analyze link stylesheets
        const linkElements = [...document.querySelectorAll('link[rel="stylesheet"]')];
        linkElements.forEach((link, index) => {
            analysis.links.push({
                index,
                href: link.href,
                media: link.media,
                crossorigin: link.crossOrigin,
                integrity: link.integrity,
                disabled: link.disabled
            });
        });

        // Analyze inline styles
        const styleElements = [...document.querySelectorAll('style')];
        styleElements.forEach((style, index) => {
            analysis.inline.push({
                index,
                content: style.textContent.substring(0, 300) + (style.textContent.length > 300 ? '...' : ''),
                length: style.textContent.length,
                media: style.media,
                disabled: style.disabled
            });
        });

        console.log('External Stylesheets:', analysis.links.length);
        console.log('Inline Styles:', analysis.inline.length);
        console.log('CSS Variables Found:', Object.keys(analysis.cssVariables).length);
        console.log('Animations Found:', analysis.animations.length);

        this.results.analysis.stylesheets = analysis;
    }

    extractCSSVariables() {
        const variables = {};
        const computedStyle = getComputedStyle(document.documentElement);

        // Get CSS custom properties from document element
        for (let property of computedStyle) {
            if (property.startsWith('--')) {
                variables[property] = computedStyle.getPropertyValue(property).trim();
            }
        }

        return variables;
    }

    extractAnimations() {
        const animations = [];

        // Check for CSS animations on all elements
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
            const computedStyle = getComputedStyle(el);
            const animationName = computedStyle.animationName;
            const transitionProperty = computedStyle.transitionProperty;

            if (animationName && animationName !== 'none') {
                animations.push({
                    element: el.tagName + (el.id ? `#${el.id}` : '') + (el.className ? `.${[...el.classList].join('.')}` : ''),
                    animationName,
                    duration: computedStyle.animationDuration,
                    timing: computedStyle.animationTimingFunction,
                    delay: computedStyle.animationDelay,
                    iterationCount: computedStyle.animationIterationCount
                });
            }

            if (transitionProperty && transitionProperty !== 'none') {
                animations.push({
                    element: el.tagName + (el.id ? `#${el.id}` : '') + (el.className ? `.${[...el.classList].join('.')}` : ''),
                    type: 'transition',
                    property: transitionProperty,
                    duration: computedStyle.transitionDuration,
                    timing: computedStyle.transitionTimingFunction,
                    delay: computedStyle.transitionDelay
                });
            }
        });

        return animations.slice(0, 20); // Limit to first 20 to prevent overwhelming output
    }

    extractMediaQueries() {
        const mediaQueries = [];

        [...document.styleSheets].forEach(sheet => {
            try {
                [...sheet.cssRules || sheet.rules].forEach(rule => {
                    if (rule.type === CSSRule.MEDIA_RULE) {
                        mediaQueries.push({
                            media: rule.media.mediaText,
                            rules: rule.cssRules.length
                        });
                    }
                });
            } catch (e) {
                // Cross-origin stylesheets can't be accessed
            }
        });

        return mediaQueries;
    }

    // 8. Metadata Analysis
    async analyzeMetadata() {
        console.log('\n📊 ANALYZING METADATA');
        console.log('======================');

        const metadata = {
            title: document.title,
            description: this.getMetaContent('description'),
            keywords: this.getMetaContent('keywords'),
            author: this.getMetaContent('author'),
            viewport: this.getMetaContent('viewport'),
            charset: document.characterSet,
            lang: document.documentElement.lang,
            dir: document.documentElement.dir,
            openGraph: this.getOpenGraphData(),
            twitterCard: this.getTwitterCardData(),
            structuredData: this.getStructuredData(),
            canonicalURL: this.getCanonicalURL(),
            alternateLanguages: this.getAlternateLanguages(),
            icons: this.getIcons()
        };

        console.log('Title:', metadata.title);
        console.log('Description:', metadata.description);
        console.log('Language:', metadata.lang);
        console.log('Charset:', metadata.charset);
        console.log('Open Graph Tags:', Object.keys(metadata.openGraph).length);
        console.log('Structured Data:', metadata.structuredData.length, 'items');

        this.results.analysis.metadata = metadata;
    }

    getMetaContent(name) {
        const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
        return meta ? meta.content : null;
    }

    getOpenGraphData() {
        const ogData = {};
        const ogMetas = document.querySelectorAll('meta[property^="og:"]');

        ogMetas.forEach(meta => {
            const property = meta.getAttribute('property');
            ogData[property] = meta.content;
        });

        return ogData;
    }

    getTwitterCardData() {
        const twitterData = {};
        const twitterMetas = document.querySelectorAll('meta[name^="twitter:"]');

        twitterMetas.forEach(meta => {
            const name = meta.getAttribute('name');
            twitterData[name] = meta.content;
        });

        return twitterData;
    }

    getStructuredData() {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        const structuredData = [];

        scripts.forEach(script => {
            try {
                const data = JSON.parse(script.textContent);
                structuredData.push(data);
            } catch (e) {
                structuredData.push({ error: 'Invalid JSON', content: script.textContent.substring(0, 100) });
            }
        });

        return structuredData;
    }

    getCanonicalURL() {
        const canonical = document.querySelector('link[rel="canonical"]');
        return canonical ? canonical.href : null;
    }

    getAlternateLanguages() {
        const alternates = document.querySelectorAll('link[rel="alternate"][hreflang]');
        return [...alternates].map(link => ({
            hreflang: link.hreflang,
            href: link.href
        }));
    }

    getIcons() {
        const iconLinks = document.querySelectorAll('link[rel*="icon"]');
        return [...iconLinks].map(link => ({
            rel: link.rel,
            href: link.href,
            type: link.type,
            sizes: link.sizes.toString()
        }));
    }

    // 9. Security Analysis
    async analyzeSecurity() {
        console.log('\n🔒 ANALYZING SECURITY');
        console.log('=====================');

        const security = {
            https: location.protocol === 'https:',
            csp: this.getCSP(),
            mixedContent: this.checkMixedContent(),
            externalResources: this.getExternalResources(),
            cookies: this.analyzeCookies(),
            localStorage: this.analyzeLocalStorage(),
            sessionStorage: this.analyzeSessionStorage(),
            permissions: this.checkPermissions()
        };

        console.log('HTTPS:', security.https);
        console.log('CSP Enabled:', !!security.csp);
        console.log('Mixed Content Issues:', security.mixedContent.length);
        console.log('External Domains:', security.externalResources.domains.length);

        this.results.analysis.security = security;
    }

    getCSP() {
        const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        return cspMeta ? cspMeta.content : null;
    }

    checkMixedContent() {
        const issues = [];

        if (location.protocol === 'https:') {
            // Check for HTTP resources
            const allResources = [
                ...document.querySelectorAll('img[src^="http:"]'),
                ...document.querySelectorAll('script[src^="http:"]'),
                ...document.querySelectorAll('link[href^="http:"]'),
                ...document.querySelectorAll('iframe[src^="http:"]')
            ];

            allResources.forEach(resource => {
                issues.push({
                    type: resource.tagName,
                    url: resource.src || resource.href,
                    id: resource.id,
                    classes: [...resource.classList]
                });
            });
        }

        return issues;
    }

    getExternalResources() {
        const currentDomain = location.hostname;
        const domains = new Set();
        const resources = [];

        // Check all resources with src/href attributes
        const resourceElements = [
            ...document.querySelectorAll('[src]'),
            ...document.querySelectorAll('[href]')
        ];

        resourceElements.forEach(element => {
            const url = element.src || element.href;
            try {
                const urlObj = new URL(url);
                if (urlObj.hostname !== currentDomain && urlObj.protocol.startsWith('http')) {
                    domains.add(urlObj.hostname);
                    resources.push({
                        type: element.tagName,
                        url,
                        domain: urlObj.hostname
                    });
                }
            } catch (e) {
                // Invalid URL, skip
            }
        });

        return {
            domains: [...domains],
            resources: resources.slice(0, 50) // Limit output
        };
    }

    analyzeCookies() {
        const cookies = document.cookie.split(';').filter(c => c.trim());
        return {
            count: cookies.length,
            names: cookies.map(c => c.trim().split('=')[0]),
            hasSecure: document.cookie.includes('Secure'),
            hasHttpOnly: document.cookie.includes('HttpOnly'),
            hasSameSite: document.cookie.includes('SameSite')
        };
    }

    analyzeLocalStorage() {
        try {
            return {
                available: true,
                itemCount: localStorage.length,
                keys: [...Array(localStorage.length)].map((_, i) => localStorage.key(i)),
                estimatedSize: JSON.stringify(localStorage).length
            };
        } catch (e) {
            return { available: false, error: e.message };
        }
    }

    analyzeSessionStorage() {
        try {
            return {
                available: true,
                itemCount: sessionStorage.length,
                keys: [...Array(sessionStorage.length)].map((_, i) => sessionStorage.key(i)),
                estimatedSize: JSON.stringify(sessionStorage).length
            };
        } catch (e) {
            return { available: false, error: e.message };
        }
    }

    checkPermissions() {
        const permissions = {};

        // Check for common permission-requiring APIs
        permissions.geolocation = 'geolocation' in navigator;
        permissions.notifications = 'Notification' in window;
        permissions.camera = 'mediaDevices' in navigator;
        permissions.serviceWorker = 'serviceWorker' in navigator;
        permissions.pushManager = 'PushManager' in window;

        return permissions;
    }

    // 10. Performance Analysis
    async analyzePerformance() {
        console.log('\n⚡ ANALYZING PERFORMANCE');
        console.log('========================');

        const performance = {
            timing: this.getPerformanceTiming(),
            resources: this.getResourceTiming(),
            vitals: await this.getWebVitals(),
            memory: this.getMemoryInfo(),
            observers: this.getPerformanceObservers()
        };

        console.log('Page Load Time:', performance.timing.loadComplete, 'ms');
        console.log('DOM Content Loaded:', performance.timing.domContentLoaded, 'ms');
        console.log('Resource Count:', performance.resources.length);

        this.results.analysis.performance = performance;
    }

    getPerformanceTiming() {
        const perfTiming = performance.timing;
        const navigationStart = perfTiming.navigationStart;

        return {
            domLoading: perfTiming.domLoading - navigationStart,
            domInteractive: perfTiming.domInteractive - navigationStart,
            domContentLoaded: perfTiming.domContentLoadedEventEnd - navigationStart,
            loadComplete: perfTiming.loadEventEnd - navigationStart,
            firstPaint: this.getFirstPaint(),
            firstContentfulPaint: this.getFirstContentfulPaint()
        };
    }

    getFirstPaint() {
        const paintEntries = performance.getEntriesByType('paint');
        const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
        return firstPaint ? firstPaint.startTime : null;
    }

    getFirstContentfulPaint() {
        const paintEntries = performance.getEntriesByType('paint');
        const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        return firstContentfulPaint ? firstContentfulPaint.startTime : null;
    }

    getResourceTiming() {
        const resources = performance.getEntriesByType('resource');
        return resources.map(resource => ({
            name: resource.name,
            type: this.getResourceType(resource.name),
            duration: resource.duration,
            size: resource.transferSize,
            cached: resource.transferSize === 0 && resource.decodedBodySize > 0
        })).slice(0, 30); // Limit output
    }

    getResourceType(url) {
        if (url.includes('.css')) return 'stylesheet';
        if (url.includes('.js')) return 'script';
        if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return 'image';
        if (url.includes('.woff') || url.includes('.ttf')) return 'font';
        return 'other';
    }

    async getWebVitals() {
        // Simplified web vitals - in a real implementation, you'd use the web-vitals library
        return {
            note: 'Use web-vitals library for accurate measurements',
            cls: 'Not measured',
            fid: 'Not measured',
            lcp: 'Not measured'
        };
    }

    getMemoryInfo() {
        if ('memory' in performance) {
            return {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
            };
        }
        return { available: false };
    }

    getPerformanceObservers() {
        const observers = [];

        // Check if PerformanceObserver is supported
        if ('PerformanceObserver' in window) {
            observers.push('PerformanceObserver supported');

            // List supported entry types
            if (PerformanceObserver.supportedEntryTypes) {
                observers.push(...PerformanceObserver.supportedEntryTypes);
            }
        }

        return observers;
    }

    // 11. Accessibility Analysis
    async analyzeAccessibility() {
        console.log('\n♿ ANALYZING ACCESSIBILITY');
        console.log('=========================');

        const accessibility = {
            images: this.checkImageAccessibility(),
            headings: this.checkHeadingStructure(),
            forms: this.checkFormAccessibility(),
            links: this.checkLinkAccessibility(),
            aria: this.checkARIAUsage(),
            colorContrast: this.checkColorContrast(),
            landmarks: this.checkLandmarks(),
            focusable: this.checkFocusableElements()
        };

        console.log('Images without alt:', accessibility.images.withoutAlt);
        console.log('Form inputs without labels:', accessibility.forms.withoutLabels);
        console.log('Links without text:', accessibility.links.withoutText);
        console.log('ARIA attributes used:', Object.keys(accessibility.aria.attributes).length);

        this.results.analysis.accessibility = accessibility;
    }

    checkImageAccessibility() {
        const images = [...document.querySelectorAll('img')];
        let withoutAlt = 0;
        let decorative = 0;

        const details = images.map(img => {
            const hasAlt = img.hasAttribute('alt');
            const altText = img.alt;
            const isDecorative = altText === '';

            if (!hasAlt) withoutAlt++;
            if (isDecorative) decorative++;

            return {
                src: img.src,
                alt: altText,
                hasAlt,
                isDecorative,
                ariaHidden: img.getAttribute('aria-hidden') === 'true'
            };
        });

        return {
            total: images.length,
            withoutAlt,
            decorative,
            details: details.slice(0, 20)
        };
    }

    checkHeadingStructure() {
        const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')];
        const structure = {};

        headings.forEach(heading => {
            const level = heading.tagName;
            structure[level] = (structure[level] || 0) + 1;
        });

        return {
            total: headings.length,
            structure,
            hasH1: !!document.querySelector('h1'),
            multipleH1: document.querySelectorAll('h1').length > 1
        };
    }

    checkFormAccessibility() {
        const inputs = [...document.querySelectorAll('input, textarea, select')];
        let withoutLabels = 0;

        const details = inputs.map(input => {
            const hasLabel = this.hasLabel(input);
            const hasAriaLabel = input.hasAttribute('aria-label');
            const hasAriaLabelledby = input.hasAttribute('aria-labelledby');

            if (!hasLabel && !hasAriaLabel && !hasAriaLabelledby) {
                withoutLabels++;
            }

            return {
                type: input.type || input.tagName,
                id: input.id,
                hasLabel,
                hasAriaLabel,
                hasAriaLabelledby,
                required: input.required
            };
        });

        return {
            total: inputs.length,
            withoutLabels,
            details: details.slice(0, 20)
        };
    }

    hasLabel(input) {
        // Check for explicit label
        if (input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) return true;
        }

        // Check for wrapping label
        const parent = input.closest('label');
        return !!parent;
    }

    checkLinkAccessibility() {
        const links = [...document.querySelectorAll('a[href]')];
        let withoutText = 0;

        const details = links.map(link => {
            const hasText = link.textContent.trim().length > 0;
            const hasAriaLabel = link.hasAttribute('aria-label');
            const hasTitle = link.hasAttribute('title');

            if (!hasText && !hasAriaLabel && !hasTitle) {
                withoutText++;
            }

            return {
                href: link.href,
                text: link.textContent.trim(),
                hasText,
                hasAriaLabel,
                hasTitle
            };
        });

        return {
            total: links.length,
            withoutText,
            details: details.slice(0, 20)
        };
    }

    checkARIAUsage() {
        const allElements = [...document.querySelectorAll('*')];
        const ariaAttributes = {};
        const roles = {};

        allElements.forEach(el => {
            [...el.attributes].forEach(attr => {
                if (attr.name.startsWith('aria-')) {
                    ariaAttributes[attr.name] = (ariaAttributes[attr.name] || 0) + 1;
                }
            });

            if (el.hasAttribute('role')) {
                const role = el.getAttribute('role');
                roles[role] = (roles[role] || 0) + 1;
            }
        });

        return {
            attributes: ariaAttributes,
            roles,
            totalElements: Object.values(ariaAttributes).reduce((sum, count) => sum + count, 0)
        };
    }

    checkColorContrast() {
        // This is a simplified check - real contrast checking requires color parsing and WCAG calculations
        const elements = [...document.querySelectorAll('*')].slice(0, 100);
        let analyzed = 0;

        elements.forEach(el => {
            const style = getComputedStyle(el);
            const color = style.color;
            const backgroundColor = style.backgroundColor;

            if (color !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'rgba(0, 0, 0, 0)') {
                analyzed++;
            }
        });

        return {
            note: 'Full contrast analysis requires specialized tools',
            elementsAnalyzed: analyzed
        };
    }

    checkLandmarks() {
        const landmarks = [
            'header', 'nav', 'main', 'article', 'section', 'aside', 'footer',
            '[role="banner"]', '[role="navigation"]', '[role="main"]',
            '[role="article"]', '[role="complementary"]', '[role="contentinfo"]'
        ];

        const found = {};
        landmarks.forEach(landmark => {
            const elements = document.querySelectorAll(landmark);
            if (elements.length > 0) {
                found[landmark] = elements.length;
            }
        });

        return found;
    }

    checkFocusableElements() {
        const focusableSelectors = [
            'a[href]', 'button', 'input', 'textarea', 'select',
            '[tabindex]:not([tabindex="-1"])', '[contenteditable="true"]'
        ];

        const focusable = [];
        focusableSelectors.forEach(selector => {
            const elements = [...document.querySelectorAll(selector)];
            elements.forEach(el => {
                focusable.push({
                    tagName: el.tagName,
                    type: el.type || null,
                    tabIndex: el.tabIndex,
                    disabled: el.disabled || false
                });
            });
        });

        return {
            total: focusable.length,
            elements: focusable.slice(0, 30)
        };
    }

    // 12. Dynamic Content Analysis
    async analyzeDynamicContent() {
        console.log('\n🔄 ANALYZING DYNAMIC CONTENT');
        console.log('============================');

        const dynamic = {
            mutationObservers: this.checkMutationObservers(),
            intersectionObservers: this.checkIntersectionObservers(),
            resizeObservers: this.checkResizeObservers(),
            lazyLoading: this.checkLazyLoading(),
            infiniteScroll: this.checkInfiniteScroll(),
            dynamicImports: this.checkDynamicImports()
        };

        console.log('Lazy loading elements:', dynamic.lazyLoading.count);
        console.log('Elements with loading attribute:', dynamic.lazyLoading.withLoadingAttr);

        this.results.analysis.dynamicContent = dynamic;
    }

    checkMutationObservers() {
        // We can't directly detect MutationObservers, but we can check for patterns
        return {
            note: 'MutationObserver usage cannot be directly detected',
            supported: 'MutationObserver' in window
        };
    }

    checkIntersectionObservers() {
        return {
            supported: 'IntersectionObserver' in window,
            note: 'Observer instances cannot be directly detected'
        };
    }

    checkResizeObservers() {
        return {
            supported: 'ResizeObserver' in window,
            note: 'Observer instances cannot be directly detected'
        };
    }

    checkLazyLoading() {
        const lazyImages = [...document.querySelectorAll('img[loading="lazy"]')];
        const lazyIframes = [...document.querySelectorAll('iframe[loading="lazy"]')];
        const intersectionImages = [...document.querySelectorAll('img[data-src]')];

        return {
            count: lazyImages.length + lazyIframes.length + intersectionImages.length,
            withLoadingAttr: lazyImages.length + lazyIframes.length,
            withDataSrc: intersectionImages.length,
            nativeSupported: 'loading' in HTMLImageElement.prototype
        };
    }

    checkInfiniteScroll() {
        // Look for common infinite scroll patterns
        const indicators = [];

        if (document.querySelector('[class*="infinite"], [id*="infinite"]')) {
            indicators.push('Elements with "infinite" in class/id');
        }

        if (document.querySelector('[class*="scroll"], [id*="scroll"]')) {
            indicators.push('Elements with "scroll" in class/id');
        }

        return {
            indicators,
            likely: indicators.length > 0
        };
    }

    checkDynamicImports() {
        // Check for signs of dynamic imports in scripts
        const scripts = [...document.querySelectorAll('script')];
        let dynamicImportSigns = 0;

        scripts.forEach(script => {
            if (script.textContent.includes('import(') || script.textContent.includes('loadash')) {
                dynamicImportSigns++;
            }
        });

        return {
            scriptsWithDynamicImports: dynamicImportSigns,
            moduleSupported: 'import' in document.createElement('script')
        };
    }

    // 13. Event Listeners Analysis
    async analyzeEventListeners() {
        console.log('\n🎧 ANALYZING EVENT LISTENERS');
        console.log('============================');

        const events = {
            globalListeners: this.getGlobalEventListeners(),
            commonEvents: this.checkCommonEvents(),
            customEvents: this.checkCustomEvents(),
            touchEvents: this.checkTouchEvents()
        };

        console.log('Elements with onclick:', events.commonEvents.onclick);
        console.log('Touch event support:', events.touchEvents.supported);

        this.results.analysis.eventListeners = events;
    }

    getGlobalEventListeners() {
        // This is limited - we can't access all event listeners directly
        const globalEvents = {};

        ['click', 'scroll', 'resize', 'load', 'DOMContentLoaded'].forEach(event => {
            globalEvents[event] = 'Cannot directly detect';
        });

        return globalEvents;
    }

    checkCommonEvents() {
        const events = {
            onclick: document.querySelectorAll('[onclick]').length,
            onchange: document.querySelectorAll('[onchange]').length,
            onsubmit: document.querySelectorAll('[onsubmit]').length,
            onload: document.querySelectorAll('[onload]').length
        };

        return events;
    }

    checkCustomEvents() {
        // Look for custom event patterns in scripts
        const scripts = [...document.querySelectorAll('script')];
        let customEventSigns = 0;

        scripts.forEach(script => {
            if (script.textContent.includes('CustomEvent') ||
                script.textContent.includes('dispatchEvent') ||
                script.textContent.includes('createEvent')) {
                customEventSigns++;
            }
        });

        return {
            scriptsWithCustomEvents: customEventSigns,
            customEventSupported: 'CustomEvent' in window
        };
    }

    checkTouchEvents() {
        return {
            supported: 'TouchEvent' in window,
            maxTouchPoints: navigator.maxTouchPoints || 0,
            touchEventsInDOM: [
                document.querySelectorAll('[ontouchstart]').length,
                document.querySelectorAll('[ontouchmove]').length,
                document.querySelectorAll('[ontouchend]').length
            ]
        };
    }

    getElementEventListeners(element) {
        // Limited - can only check inline event handlers
        const events = {};

        [...element.attributes].forEach(attr => {
            if (attr.name.startsWith('on')) {
                events[attr.name] = attr.value.substring(0, 100);
            }
        });

        return events;
    }

    // 14. Storage Analysis
    async analyzeStorage() {
        console.log('\n💾 ANALYZING STORAGE');
        console.log('====================');

        const storage = {
            localStorage: this.analyzeLocalStorage(),
            sessionStorage: this.analyzeSessionStorage(),
            cookies: this.analyzeCookies(),
            indexedDB: await this.analyzeIndexedDB(),
            webSQL: this.analyzeWebSQL(),
            cacheAPI: await this.analyzeCacheAPI()
        };

        console.log('LocalStorage items:', storage.localStorage.itemCount);
        console.log('SessionStorage items:', storage.sessionStorage.itemCount);
        console.log('Cookies:', storage.cookies.count);

        this.results.analysis.storage = storage;
    }

    async analyzeIndexedDB() {
        if (!('indexedDB' in window)) {
            return { supported: false };
        }

        try {
            const databases = await indexedDB.databases();
            return {
                supported: true,
                databases: databases.map(db => ({
                    name: db.name,
                    version: db.version
                }))
            };
        } catch (e) {
            return {
                supported: true,
                error: e.message,
                databases: []
            };
        }
    }

    analyzeWebSQL() {
        return {
            supported: 'openDatabase' in window,
            deprecated: true
        };
    }

    async analyzeCacheAPI() {
        if (!('caches' in window)) {
            return { supported: false };
        }

        try {
            const cacheNames = await caches.keys();
            return {
                supported: true,
                caches: cacheNames
            };
        } catch (e) {
            return {
                supported: true,
                error: e.message,
                caches: []
            };
        }
    }

    // 15. Network Analysis
    async analyzeNetwork() {
        console.log('\n🌐 ANALYZING NETWORK');
        console.log('====================');

        const network = {
            connection: this.getConnectionInfo(),
            serviceWorker: this.analyzeServiceWorker(),
            fetch: this.analyzeFetchAPI(),
            xhr: this.analyzeXHR(),
            websockets: this.analyzeWebSockets(),
            webRTC: this.analyzeWebRTC()
        };

        console.log('Connection type:', network.connection.effectiveType);
        console.log('Service Worker registered:', network.serviceWorker.registered);

        this.results.analysis.network = network;
    }

    getConnectionInfo() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

        if (connection) {
            return {
                effectiveType: connection.effectiveType,
                downlink: connection.downlink,
                rtt: connection.rtt,
                saveData: connection.saveData
            };
        }

        return { supported: false };
    }

    analyzeServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            return { supported: false };
        }

        return {
            supported: true,
            registered: navigator.serviceWorker.controller !== null,
            ready: 'ready' in navigator.serviceWorker
        };
    }

    analyzeFetchAPI() {
        return {
            supported: 'fetch' in window,
            abortController: 'AbortController' in window
        };
    }

    analyzeXHR() {
        return {
            supported: 'XMLHttpRequest' in window,
            level2: 'FormData' in window && 'upload' in new XMLHttpRequest()
        };
    }

    analyzeWebSockets() {
        return {
            supported: 'WebSocket' in window,
            binaryType: WebSocket.prototype.binaryType !== undefined
        };
    }

    analyzeWebRTC() {
        return {
            rtcPeerConnection: 'RTCPeerConnection' in window,
            getUserMedia: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
            rtcDataChannel: 'RTCDataChannel' in window
        };
    }

    // 16. Generate Summary
    generateSummary() {
        console.log('\n📊 GENERATING SUMMARY');
        console.log('=====================');

        const summary = {
            pageType: this.determinePageType(),
            complexity: this.assessComplexity(),
            technologies: this.summarizeTechnologies(),
            issues: this.identifyIssues(),
            opportunities: this.identifyOpportunities()
        };

        console.log('Page Type:', summary.pageType);
        console.log('Complexity Level:', summary.complexity);
        console.log('Main Technologies:', summary.technologies.slice(0, 5));
        console.log('Potential Issues:', summary.issues.length);

        this.results.summary = summary;
    }

    determinePageType() {
        const { frameworks, webComponents, structure } = this.results.analysis;

        if (webComponents.customElements.length > 0) return 'Web Components Application';
        if (frameworks.detected.includes('React')) return 'React Application';
        if (frameworks.detected.includes('Vue.js')) return 'Vue.js Application';
        if (frameworks.detected.includes('Angular')) return 'Angular Application';
        if (structure.customElements.length > 0) return 'Custom Elements Application';
        if (frameworks.detected.includes('jQuery')) return 'jQuery-based Website';

        return 'Standard HTML Website';
    }

    assessComplexity() {
        const { structure, scripts, webComponents, shadowDOM } = this.results.analysis;

        let score = 0;

        if (structure.body.totalElements > 1000) score += 2;
        else if (structure.body.totalElements > 500) score += 1;

        if (scripts.total > 20) score += 2;
        else if (scripts.total > 10) score += 1;

        if (webComponents.customElements.length > 5) score += 2;
        else if (webComponents.customElements.length > 0) score += 1;

        if (shadowDOM.shadowRoots.length > 0) score += 2;

        if (score >= 6) return 'High';
        if (score >= 3) return 'Medium';
        return 'Low';
    }

    summarizeTechnologies() {
        const { frameworks } = this.results.analysis;
        return frameworks.detected;
    }

    identifyIssues() {
        const issues = [];
        const { accessibility, security, performance } = this.results.analysis;

        if (accessibility.images.withoutAlt > 0) {
            issues.push(`${accessibility.images.withoutAlt} images without alt text`);
        }

        if (accessibility.forms.withoutLabels > 0) {
            issues.push(`${accessibility.forms.withoutLabels} form inputs without labels`);
        }

        if (!security.https) {
            issues.push('Not using HTTPS');
        }

        if (security.mixedContent.length > 0) {
            issues.push(`${security.mixedContent.length} mixed content issues`);
        }

        if (performance.resources.length > 100) {
            issues.push('High number of resource requests');
        }

        return issues;
    }

    identifyOpportunities() {
        const opportunities = [];
        const { dynamicContent, performance, accessibility } = this.results.analysis;

        if (!dynamicContent.lazyLoading.nativeSupported) {
            opportunities.push('Consider implementing native lazy loading');
        }

        if (performance.resources.filter(r => r.cached).length < performance.resources.length * 0.5) {
            opportunities.push('Improve resource caching');
        }

        if (Object.keys(accessibility.landmarks).length < 3) {
            opportunities.push('Add more semantic landmarks');
        }

        return opportunities;
    }

    // 17. Generate Recommendations
    generateRecommendations() {
        console.log('\n💡 GENERATING RECOMMENDATIONS');
        console.log('=============================');

        const recommendations = {
            performance: this.getPerformanceRecommendations(),
            accessibility: this.getAccessibilityRecommendations(),
            security: this.getSecurityRecommendations(),
            seo: this.getSEORecommendations(),
            development: this.getDevelopmentRecommendations()
        };

        Object.entries(recommendations).forEach(([category, recs]) => {
            if (recs.length > 0) {
                console.log(`${category.toUpperCase()}:`, recs.slice(0, 3));
            }
        });

        this.results.recommendations = recommendations;
    }

    getPerformanceRecommendations() {
        const recs = [];
        const { performance, scripts } = this.results.analysis;

        if (performance.resources.length > 50) {
            recs.push('Consider resource bundling to reduce HTTP requests');
        }

        if (scripts.external > 10) {
            recs.push('Optimize external script loading with async/defer');
        }

        return recs;
    }

    getAccessibilityRecommendations() {
        const recs = [];
        const { accessibility } = this.results.analysis;

        if (accessibility.images.withoutAlt > 0) {
            recs.push('Add alt text to all images');
        }

        if (accessibility.forms.withoutLabels > 0) {
            recs.push('Associate all form inputs with labels');
        }

        if (!accessibility.headings.hasH1) {
            recs.push('Add an H1 heading to the page');
        }

        return recs;
    }

    getSecurityRecommendations() {
        const recs = [];
        const { security } = this.results.analysis;

        if (!security.https) {
            recs.push('Implement HTTPS');
        }

        if (!security.csp) {
            recs.push('Implement Content Security Policy');
        }

        if (security.mixedContent.length > 0) {
            recs.push('Fix mixed content issues');
        }

        return recs;
    }

    getSEORecommendations() {
        const recs = [];
        const { metadata, structure } = this.results.analysis;

        if (!metadata.description) {
            recs.push('Add meta description');
        }

        if (Object.keys(metadata.openGraph).length === 0) {
            recs.push('Add Open Graph tags');
        }

        if (!structure.semanticElements.header) {
            recs.push('Use semantic HTML5 elements');
        }

        return recs;
    }

    getDevelopmentRecommendations() {
        const recs = [];
        const { webComponents, shadowDOM, frameworks } = this.results.analysis;

        if (webComponents.customElements.length > 0 && shadowDOM.shadowRoots.length === 0) {
            recs.push('Consider using Shadow DOM for better encapsulation');
        }

        if (frameworks.detected.length < 2) {
            recs.push('Consider modern framework adoption for better maintainability');
        }

        return recs;
    }

    // 18. Export Results
    exportResults(format = 'json') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `web-analysis-${timestamp}`;

        if (format === 'json') {
            const dataStr = JSON.stringify(this.results, null, 2);
            this.downloadFile(dataStr, `${filename}.json`, 'application/json');
        } else if (format === 'html') {
            const htmlContent = this.generateHTMLReport();
            this.downloadFile(htmlContent, `${filename}.html`, 'text/html');
        }
    }

    downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    generateHTMLReport() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Web Page Analysis Report</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 20px; }
        .header { background: #333; color: white; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; padding: 15px; border-left: 4px solid #007cba; background: #f9f9f9; }
        .subsection { margin: 10px 0; padding: 10px; background: white; border-radius: 3px; }
        .metric { display: inline-block; margin: 5px 10px 5px 0; padding: 5px 10px; background: #e7f3ff; border-radius: 3px; }
        .issue { color: #d63384; font-weight: bold; }
        .success { color: #198754; font-weight: bold; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 3px; overflow-x: auto; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Web Page Analysis Report</h1>
        <p>URL: ${this.results.url}</p>
        <p>Generated: ${this.results.timestamp}</p>
        <p>User Agent: ${this.results.userAgent}</p>
    </div>

    <div class="section">
        <h2>Summary</h2>
        <div class="grid">
            <div class="subsection">
                <h3>Page Overview</h3>
                <div class="metric">Type: ${this.results.summary?.pageType || 'Unknown'}</div>
                <div class="metric">Complexity: ${this.results.summary?.complexity || 'Unknown'}</div>
                <div class="metric">Elements: ${this.results.analysis.structure?.body.totalElements || 0}</div>
            </div>
            <div class="subsection">
                <h3>Technologies</h3>
                ${this.results.summary?.technologies.map(tech => `<div class="metric">${tech}</div>`).join('') || 'None detected'}
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Issues Found</h2>
        ${this.results.summary?.issues.length > 0 ?
            this.results.summary.issues.map(issue => `<div class="issue">• ${issue}</div>`).join('') :
            '<div class="success">No major issues detected</div>'
        }
    </div>

    <div class="section">
        <h2>Recommendations</h2>
        <div class="grid">
            ${Object.entries(this.results.recommendations || {}).map(([category, recs]) => `
                <div class="subsection">
                    <h3>${category.charAt(0).toUpperCase() + category.slice(1)}</h3>
                    ${recs.length > 0 ? recs.map(rec => `<div>• ${rec}</div>`).join('') : 'No recommendations'}
                </div>
            `).join('')}
        </div>
    </div>

    <div class="section">
        <h2>Detailed Analysis</h2>
        <pre>${JSON.stringify(this.results.analysis, null, 2)}</pre>
    </div>
</body>
</html>`;
    }
}

// Usage Instructions and Helper Functions
const WebPageInspectorUtils = {
    // Quick analysis runner
    quickAnalysis: async () => {
        const inspector = new WebPageInspector();
        return await inspector.runFullAnalysis();
    },

    // Component-specific analysis
    analyzeComponent: (selector) => {
        const inspector = new WebPageInspector();
        const element = document.querySelector(selector);

        if (!element) {
            console.log(`Element not found: ${selector}`);
            return null;
        }

        return {
            element: {
                tagName: element.tagName,
                id: element.id,
                classes: [...element.classList],
                attributes: [...element.attributes].map(attr => `${attr.name}="${attr.value}"`),
                innerHTML: element.innerHTML.substring(0, 500) + (element.innerHTML.length > 500 ? '...' : '')
            },
            shadowDOM: element.shadowRoot ? inspector.analyzeShadowRoot(element, element.shadowRoot) : null,
            styles: getComputedStyle(element),
            customProperties: inspector.getCustomElementProperties(element),
            events: inspector.getElementEventListeners(element)
        };
    },

    // Monitor page changes
    startMonitoring: (callback, options = {}) => {
        const observer = new MutationObserver(callback);
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
            ...options
        });
        return observer;
    },

    // Performance monitoring
    monitorPerformance: (duration = 10000) => {
        const startTime = performance.now();
        const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : null;

        setTimeout(() => {
            const endTime = performance.now();
            const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : null;

            console.log('Performance Monitoring Results:');
            console.log('Duration:', endTime - startTime, 'ms');
            console.log('Memory change:', finalMemory - initialMemory, 'bytes');
            console.log('Resource count:', performance.getEntriesByType('resource').length);
        }, duration);
    }
};

// Auto-run on console paste
console.log(`
🔍 ADVANCED WEB PAGE INSPECTOR LOADED
====================================

Usage:
1. Run full analysis:
   const results = await new WebPageInspector().runFullAnalysis();

2. Quick analysis:
   WebPageInspectorUtils.quickAnalysis();

3. Analyze specific component:
   WebPageInspectorUtils.analyzeComponent('n8n-demo');

4. Export results:
   inspector.exportResults('html'); // or 'json'

5. Start monitoring:
   const observer = WebPageInspectorUtils.startMonitoring((mutations) => {
       console.log('Page changed:', mutations.length, 'mutations');
   });

Ready to analyze! Run any of the above commands to start.
`);

// Return the main class for use
window.WebPageInspector = WebPageInspector;
window.WebPageInspectorUtils = WebPageInspectorUtils;
