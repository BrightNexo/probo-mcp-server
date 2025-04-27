/**
 * server.js
 * MCP server implementation for Probo API
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import dotenv from 'dotenv';
import { z } from 'zod';

// Import Probo API client
import {
  cancelOrder,
  configureProduct,
  getAllOrders,
  getOrderStatus,
  getProducts,
  placeOrder,
} from './proboClient.js';

// Load environment variables
dotenv.config();

// Define validation schemas for common objects
const AddressSchema = z.object({
  address_company_name: z.string().optional(),
  address_first_name: z.string(),
  address_last_name: z.string(),
  address_street: z.string(),
  address_house_number: z.string(),
  address_addition: z.string().optional(),
  address_postal_code: z.string(),
  address_city: z.string(),
  address_country: z.string(),
  address_telephone_number: z.string().optional(),
  address_email: z.string().email().optional(),
}).describe('Delivery address details');

const ProductOptionSchema = z.object({
  code: z.string().describe('Option code'),
  value: z.union([z.string(), z.number(), z.boolean()]).describe('Option value'),
}).describe('Product configuration option');

// Create MCP server instance
const server = new McpServer({
  name: process.env.MCP_SERVER_NAME || 'probo-mcp-server',
  version: process.env.MCP_SERVER_VERSION || '0.1.0',
});

// Helper function to format results in a consistent way
function formatResult(message, data, isError = false) {
  // For errors, check if the data contains error details
  let formattedData = data;
  if (isError && data.error && data.error instanceof Error && data.error.data) {
    // Include the original error data for better debugging
    formattedData = {
      error: data.error.message,
      details: data.error.data
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: message,
      },
      {
        type: 'text',
        text: JSON.stringify(formattedData, null, 2),
      },
    ],
    isError,
  };
}

// Add MCP tools

/**
 * Search Products Tool
 * Allows searching for Probo products
 */
server.tool(
  'searchProducts',
  {
    query: z.string().optional().describe('Search query to filter products'),
    language: z.string().length(2).optional().describe('Language code (e.g., "en", "nl")'),
    page: z.number().optional().describe('Page number for pagination'),
    per_page: z.number().optional().describe('Items per page (max 50)'),
  },
  async ({ query, language, page, per_page }) => {
    try {
      // Pass pagination options to getProducts
      const options = {
        page: page || 1,
        per_page: per_page || 20
      };
      
      const result = await getProducts(query, options);
      return formatResult(
        `Found ${result.products?.length || 0} products`, 
        result
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return formatResult(
        `Error: ${errorMessage}`,
        { error: errorMessage },
        true
      );
    }
  }
);

/**
 * Configure Product Tool
 * Configures a product with selected options
 */
server.tool(
  'configureProduct',
  {
    productCode: z.string().describe('Product code to configure'),
    options: z.array(ProductOptionSchema).optional().describe('Product options'),
    address: AddressSchema.optional().describe('Delivery address'),
    language: z.string().length(2).optional().describe('Language code (e.g., "en", "nl")'),
  },
  async ({ productCode, options, address, language }) => {
    try {
      const result = await configureProduct(productCode, options || [], address, language);
      return formatResult(
        `Product ${productCode} configured successfully`,
        result
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return formatResult(
        `Error: ${errorMessage}`,
        { error: errorMessage },
        true
      );
    }
  }
);

/**
 * Place Order Tool
 * Places an order with Probo
 */
server.tool(
  'placeOrder',
  {
    configuration: z.object({
      products: z.array(z.any()),
      language: z.string().optional(),
    }).describe('Complete product configuration'),
    address: AddressSchema.describe('Delivery address'),
    reference: z.string().describe('Customer reference for the order'),
    isTest: z.boolean().optional().describe('Whether this is a test order (default: based on env)'),
    additionalOptions: z.object({
      orderId: z.string().optional().describe('Custom order ID'),
      contactEmail: z.string().email().optional().describe('Contact email for the order'),
      callbackUrl: z.union([z.string(), z.array(z.string())]).optional().describe('Callback URL(s) for order status updates'),
      errorEmails: z.union([z.string().email(), z.array(z.string().email())]).optional().describe('Email address(es) to receive error notifications'),
      shippingMethodPreset: z.string().optional().describe('Shipping method preset (default: "cheapest")'),
      deliveryDatePreset: z.string().optional().describe('Delivery date preset (default: "cheapest")'),
    }).optional().describe('Additional order options')
  },
  async ({ configuration, address, reference, isTest, additionalOptions }) => {
    try {
      const result = await placeOrder(configuration, address, reference, isTest, additionalOptions || {});
      return formatResult(
        `Order placed successfully: ${result.order?.id || 'ID not available'}`,
        result
      );
    } catch (error) {
      console.error('[placeOrder] Error details:', error);
      return formatResult(
        `Error: ${error.message}`,
        { error },
        true
      );
    }
  }
);

/**
 * Get Order Status Tool
 * Gets status for specific orders
 */
server.tool(
  'getOrderStatus',
  {
    orderIds: z.array(z.string()).describe('Array of order IDs to check'),
  },
  async ({ orderIds }) => {
    try {
      const result = await getOrderStatus(orderIds);
      return formatResult(
        `Retrieved status for ${result.orders?.length || 0} orders`,
        result
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return formatResult(
        `Error: ${errorMessage}`,
        { error: errorMessage },
        true
      );
    }
  }
);

/**
 * Get All Orders Tool
 * Gets all orders with optional filtering
 */
server.tool(
  'getAllOrders',
  {
    filters: z.object({
      page: z.number().optional(),
      per_page: z.number().optional(),
      status: z.string().optional(),
      customer_order_id: z.string().optional(),
      order_date_from: z.string().optional(),
      order_date_to: z.string().optional(),
    }).optional().describe('Filters for the orders query'),
  },
  async ({ filters }) => {
    try {
      const result = await getAllOrders(filters || {});
      return formatResult(
        `Retrieved ${result.orders?.length || 0} orders`,
        result
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return formatResult(
        `Error: ${errorMessage}`,
        { error: errorMessage },
        true
      );
    }
  }
);

/**
 * Cancel Order Tool
 * Cancels a specific order
 */
server.tool(
  'cancelOrder',
  {
    orderId: z.string().describe('Order ID to cancel'),
  },
  async ({ orderId }) => {
    try {
      const result = await cancelOrder(orderId);
      return formatResult(
        `Order ${orderId} cancellation result: ${result.status}`,
        result
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return formatResult(
        `Error: ${errorMessage}`,
        { error: errorMessage },
        true
      );
    }
  }
);

// Start the MCP server
const transport = new StdioServerTransport();
server.connect(transport).catch((error) => {
  console.error('[MCP Error]', error);
  process.exit(1);
});

console.error('Probo MCP server running on stdio'); 