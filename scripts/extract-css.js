const fs = require('fs');
const path = require('path');


function findFiles(dir, files = []) {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            findFiles(fullPath, files);
        } else if (file.endsWith('.ejs') || file.endsWith('.html')) {
            files.push(fullPath);
        }
    });
    return files;
}

const viewsDir = path.join(__dirname, '..', 'view');
const targetCssFile = path.join(__dirname, '..', 'public', 'css', 'legacy-inline.css');

const files = findFiles(viewsDir);
let globalCss = '';

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Extract <style>...</style>
    const styleRegex = /<style>([\s\S]*?)<\/style>/g;
    let match;
    let hasStyle = false;
    
    while ((match = styleRegex.exec(content)) !== null) {
        globalCss += `\n/* Extracted from ${path.basename(file)} */\n`;
        globalCss += match[1] + '\n';
        hasStyle = true;
    }
    
    if (hasStyle) {
        // Remove <style> tags
        content = content.replace(/<style>[\s\S]*?<\/style>/g, '');
        
        // Ensure <link rel="stylesheet" href="/css/style.css"> is present in <head>
        const linkTag = '<link rel="stylesheet" href="/css/style.css">';
        if (!content.includes(linkTag) && !content.includes('href="/css/style.css"')) {
            // Find </head> or <head> and insert before
            if (content.includes('</head>')) {
                content = content.replace('</head>', `    ${linkTag}\n</head>`);
            } else if (content.includes('<meta charset="UTF-8">')) {
                content = content.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n    ${linkTag}`);
            }
        }
        
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Processed ${file}`);
    }
});

fs.writeFileSync(targetCssFile, globalCss, 'utf8');
console.log(`Extracted CSS written to ${targetCssFile}`);
