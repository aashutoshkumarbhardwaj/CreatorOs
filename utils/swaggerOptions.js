const swaggerJsdoc = require('swagger-jsdoc');

/**
 * Swagger/OpenAPI Configuration
 * Generates API documentation based on JSDoc comments in routes.
 */
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'CreatorOS API',
            version: '2.0.0',
            description: 'API documentation for the CreatorOS backend.',
            contact: {
                name: 'Developer Support',
                url: 'https://creatoros.com'
            }
        },
        servers: [
            {
                url: process.env.BASE_URL || process.env.APP_URL || 'http://localhost:3000',
                description: 'API Server'
            },
            {
                url: 'https://titli-link-shortner.vercel.app',
                description: 'Production Server'
            }
        ],
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'token'
                }
            }
        },
        security: [
            {
                cookieAuth: []
            }
        ]
    },
    // Files containing OpenAPI annotations
    apis: ['./routes/*.js', './model/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
