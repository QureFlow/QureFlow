import { app } from './server.js';
import serverless from 'serverless-http';

/**
 * AWS Lambda / API Gateway Handler
 * Enables serverless execution on AWS Lambda behind API Gateway HTTP / REST APIs.
 */
export const handler = serverless(app);
