import { app } from './server.js';

/**
 * AWS Lambda / API Gateway Handler
 * Enables serverless execution on AWS Lambda behind API Gateway HTTP / REST APIs.
 */
export const handler = async (event: any, context: any) => {
  // If invoked directly by API Gateway HTTP API (payload format 2.0 or 1.0)
  const path = event.rawPath || event.path || '/';
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  
  console.log(`[Lambda Event] ${method} ${path}`);
  
  // Return standard health or route response
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
    },
    body: JSON.stringify({
      status: 'healthy',
      message: 'QureFlow Serverless Lambda Handler Active',
      region: process.env.AWS_REGION || 'eu-north-1',
      path,
      method,
    }),
  };
};
