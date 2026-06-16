const fs = require('fs');
const path = require('path');

const dirs = {
  routes: './routes',
  controller: './controller',
  model: './model',
  middleware: './middleware',
  utils: './utils'
};

function processRoutes() {
  const dir = dirs.routes;
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Inject swagger docs above router.(get|post|put|delete|patch)
    content = content.replace(/(router\.(get|post|put|delete|patch)\((['"`])([^'"`]+)\3\s*,)/g, (match, full, method, q, routePath) => {
      // Don't add if already documented
      if (content.indexOf(`* @swagger\n * ${routePath}`) !== -1) return match;
      
      const swagger = `
/**
 * @swagger
 * ${routePath}:
 *   ${method}:
 *     summary: ${method.toUpperCase()} request for ${routePath}
 *     description: Automatically generated swagger documentation for ${routePath}
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
`;
      return swagger + full;
    });
    
    fs.writeFileSync(filePath, content);
    console.log(`Updated routes: ${file}`);
  });
}

function processGeneric(dirName) {
  const dir = dirs[dirName];
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Document `const myFunc = (req, res` or `function myFunc`
    content = content.replace(/^(const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(async\s+)?(\([^)]*\)|[a-zA-Z0-9_]+)\s*=>/gm, (match, decl, name) => {
      const doc = `/**
 * @function ${name}
 * @description Automatically generated JSDoc for ${name}
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */\n`;
      // check if already documented
      if (content.includes(`@function ${name}`)) return match;
      return doc + match;
    });

    content = content.replace(/^async\s+function\s+([a-zA-Z0-9_]+)\s*\(/gm, (match, name) => {
        const doc = `/**
 * @function ${name}
 * @description Automatically generated JSDoc for ${name}
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>|void}
 */\n`;
        if (content.includes(`@function ${name}`)) return match;
        return doc + match;
    });

    content = content.replace(/^function\s+([a-zA-Z0-9_]+)\s*\(/gm, (match, name) => {
        const doc = `/**
 * @function ${name}
 * @description Automatically generated JSDoc for ${name}
 * @returns {any}
 */\n`;
        if (content.includes(`@function ${name}`)) return match;
        return doc + match;
    });
    
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${dirName}: ${file}`);
  });
}

function processModels() {
  const dir = dirs.model;
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Document mongoose schemas
    content = content.replace(/^(const|let|var)\s+([a-zA-Z0-9_]+Schema)\s*=\s*new\s+(mongoose\.)?Schema/gm, (match, decl, name) => {
      const doc = `/**
 * @schema ${name}
 * @description Mongoose schema definition for ${name.replace('Schema', '')}.
 */\n`;
      if (content.includes(`@schema ${name}`)) return match;
      return doc + match;
    });

    // Document mongoose models
    content = content.replace(/(module\.exports\s*=\s*|const\s+[a-zA-Z0-9_]+\s*=\s*)(mongoose\.)?model\(/gm, (match) => {
      const doc = `/**
 * @model
 * @description Mongoose model compilation.
 */\n`;
      if (content.includes(`@model`)) return match;
      return doc + match;
    });

    fs.writeFileSync(filePath, content);
    console.log(`Updated models: ${file}`);
  });
}

processRoutes();
processGeneric('controller');
processGeneric('middleware');
processGeneric('utils');
processModels();

console.log('Documentation injected successfully.');
