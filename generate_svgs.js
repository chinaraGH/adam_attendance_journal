const fs = require('fs');
const path = require('path');

const basePath = 'e:/[____Курсы____]/Нейросети/[ZerocoderФриланс]/FGI02 Кейс 1. Лендинг под ключ с формой заявок (сборка, хостинг, домен)/L3/public/catalog';
const spreadsPath = path.join(basePath, 'spreads');
const imagesPath = path.join(basePath, 'images');
const catalogFinalPath = path.join(basePath, 'catalog_final.html');

if (!fs.existsSync(imagesPath)) {
  fs.mkdirSync(imagesPath, { recursive: true });
}

// Read all spread files
const files = fs.readdirSync(spreadsPath).filter(f => f.startsWith('spread_') && f.endsWith('.html'));

const getPattern = (index) => {
    const patterns = [
        // Wave
        `<path d="M0,50 Q25,0 50,50 T100,50 T150,50 T200,50 T250,50 T300,50 T350,50 T400,50 T450,50 T500,50 T550,50 T600,50 T650,50 T700,50 T750,50 T800,50 T850,50 T900,50 T950,50 T1000,50" fill="none" stroke="#2a2a2a" stroke-width="2"/>`,
        // Mesh
        `<pattern id="mesh_${index}" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 20 0 L 40 20 L 20 40 L 0 20 Z" fill="none" stroke="#2a2a2a" stroke-width="1"/></pattern><rect width="100%" height="100%" fill="url(#mesh_${index})" />`,
        // Perforation
        `<pattern id="dots_${index}" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="3" fill="#2a2a2a" /></pattern><rect width="100%" height="100%" fill="url(#dots_${index})" />`,
        // Lines
        `<pattern id="lines_${index}" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 0,0 L 10,10 M -2,8 L 2,12 M 8,-2 L 12,2" stroke="#2a2a2a" stroke-width="1"/></pattern><rect width="100%" height="100%" fill="url(#lines_${index})" />`
    ];
    return patterns[index % patterns.length];
};

files.forEach((file, index) => {
    const filePath = path.join(spreadsPath, file);
    let html = fs.readFileSync(filePath, 'utf8');

    let skuMatch = html.match(/<div class="sku">([^<]+)<\/div>/);
    let titleMatch = html.match(/<h1>([^<]+)<\/h1>/);

    let sku = skuMatch ? skuMatch[1].trim() : `ITEM-${index + 1}`;
    let title = titleMatch ? titleMatch[1].trim() : `Product ${index + 1}`;
    
    // Some SVGs might break if text has weird chars, but basic html text is usually fine.
    // Encode XML entities just in case
    sku = sku.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    title = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const svgFileName = file.replace('.html', '.svg');
    const svgPath = path.join(imagesPath, svgFileName);

    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
        <rect width="800" height="600" fill="#181818" />
        <!-- background pattern -->
        <g opacity="0.5">
            ${getPattern(index)}
            ${index % 4 === 0 ? `<g transform="translate(0, 100)">${getPattern(index)}</g>
            <g transform="translate(0, 200)">${getPattern(index)}</g>
            <g transform="translate(0, 300)">${getPattern(index)}</g>
            <g transform="translate(0, 400)">${getPattern(index)}</g>
            <g transform="translate(0, 500)">${getPattern(index)}</g>` : ''}
        </g>
        
        <text x="400" y="270" font-family="monospace" font-size="72" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${sku}</text>
        <text x="400" y="340" font-family="sans-serif" font-size="24" fill="#888888" text-anchor="middle">${title}</text>
        
        <text x="400" y="550" font-family="monospace" font-size="14" fill="#444444" letter-spacing="4" text-anchor="middle">PROTOTYPE RENDER // FOR REVIEW ONLY</text>
        
        <rect x="20" y="20" width="760" height="560" fill="none" stroke="#333333" stroke-width="2" />
        <!-- Corner markers -->
        <path d="M20 40 L40 40 M40 20 L40 40" stroke="#555" stroke-width="2" fill="none"/>
        <path d="M780 40 L760 40 M760 20 L760 40" stroke="#555" stroke-width="2" fill="none"/>
        <path d="M20 560 L40 560 M40 580 L40 560" stroke="#555" stroke-width="2" fill="none"/>
        <path d="M780 560 L760 560 M760 580 L760 560" stroke="#555" stroke-width="2" fill="none"/>
    </svg>`;

    fs.writeFileSync(svgPath, svgContent);

    // Update HTML file to point to .svg
    let updatedHtml = html.replace(/src="\.\.\/images\/spread_(\d+)\.jpg"/g, 'src="../images/spread_$1.svg"');
    if (html !== updatedHtml) {
        fs.writeFileSync(filePath, updatedHtml);
    }
});

// Update catalog_final.html
if (fs.existsSync(catalogFinalPath)) {
    let catalogHtml = fs.readFileSync(catalogFinalPath, 'utf8');
    let updatedCatalog = catalogHtml.replace(/src="images\/spread_(\d+)\.jpg"/g, 'src="images/spread_$1.svg"');
    
    // some might have ../images
    updatedCatalog = updatedCatalog.replace(/src="\.\.\/images\/spread_(\d+)\.jpg"/g, 'src="../images/spread_$1.svg"');

    if (catalogHtml !== updatedCatalog) {
        fs.writeFileSync(catalogFinalPath, updatedCatalog);
    }
}
console.log('Successfully generated SVGs and updated HTML files.');
