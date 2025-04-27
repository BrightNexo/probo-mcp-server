/**
 * debug.js
 * A debugging script to directly interact with the Probo API
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize API configuration
const PROBO_API_KEY = process.env.PROBO_API_KEY;
const PROBO_API_URL = process.env.PROBO_API_URL || 'https://api.proboprints.com';

if (!PROBO_API_KEY) {
  throw new Error('PROBO_API_KEY environment variable must be set');
}

// Create API client
const client = axios.create({
  baseURL: PROBO_API_URL,
  headers: {
    'Authorization': `Basic ${PROBO_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Search for products in the API
 */
async function searchProducts() {
  console.log(`\n--- Searching for products ---`);
  
  try {
    const response = await client.get(`/products?page=1&per_page=5`);
    console.log(`Found ${response.data.data?.length || 0} products`);
    
    if (response.data.data && response.data.data.length > 0) {
      // Show all product details
      const products = response.data.data;
      console.log('\nFound products:');
      products.forEach((product, index) => {
        console.log(`\nProduct ${index + 1}: ${product.code}`);
        console.log(`- Name: ${product.translations?.en?.title || 'No title'}`);
        console.log(`- Type: ${product.article_group_name || 'Unknown'}`);
      });
      
      // Return first product for testing
      return products[0];
    }
  } catch (error) {
    console.error('Search failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
  
  return null;
}

/**
 * Get order status 
 */
async function getOrderStatus() {
  console.log(`\n--- Getting order status ---`);
  
  try {
    // Using a test order ID (this will likely fail, but shows the expected format)
    const payload = {
      orders: [{ id: "order-test-123" }]
    };
    
    console.log('POST /order/status');
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    const response = await client.post('/order/status', payload);
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Order status request failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

/**
 * Get all orders
 */
async function getAllOrders() {
  console.log(`\n--- Getting all orders ---`);
  
  try {
    const response = await client.get('/orders?page=1&per_page=5');
    console.log(`Found ${response.data.orders?.length || 0} orders`);
    
    if (response.data.orders && response.data.orders.length > 0) {
      console.log('\nOrder details:');
      response.data.orders.forEach((order, index) => {
        console.log(`\nOrder ${index + 1}:`);
        console.log(`- Order Number: ${order.number}`);
        console.log(`- Reference: ${order.customer_reference || 'N/A'}`);
        console.log(`- Status: ${order.external_status_code || 'N/A'}`);
      });
    }
    
    return response.data;
  } catch (error) {
    console.error('Get orders failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return null;
  }
}

/**
 * Test placing a simple order
 */
async function testSimpleOrder() {
  console.log('\n--- Testing simple order placement ---');
  
  try {
    // Bare minimum order payload from the example docs
    const payload = {
      "order_type": "test",
      "id": `test-order-${Date.now()}`,
      "reference": "Test Order",
      "deliveries": [
        {
          "address": {
            "company_name": "Test Company",
            "first_name": "John",
            "last_name": "Doe",
            "street": "Test Street",
            "house_number": "123",
            "postal_code": "1234AB",
            "city": "Test City",
            "country": "NL",
            "phone": "1234567890",
            "email": "test@example.com"
          },
          "delivery_date_preset": "cheapest",
          "shipping_method_preset": "cheapest"
        }
      ],
      "products": [
        {
          "code": "tensioner-with-spinhook",
          "options": [
            {
              "code": "amount",
              "value": "1"
            }
          ]
        }
      ]
    };

    console.log('POST /order');
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    const response = await client.post('/order', payload);
    console.log('Order result:', response.data);
  } catch (error) {
    console.log('Order placement failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }
}

/**
 * Test cancelling an order
 * @param {string} orderId - Optional order ID to cancel, if not provided will use a fallback test ID
 */
async function testCancelOrder(orderId) {
  console.log('\n--- Testing order cancellation ---');
  
  try {
    // Use provided orderId or fallback to a test ID
    const orderIdToCancel = orderId || 'test-order-1745765551460';
    
    // Simple payload with just the order ID
    const payload = {
      id: orderIdToCancel
    };

    console.log('POST /order/cancel');
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    const response = await client.post('/order/cancel', payload);
    console.log('Cancel result:', response.data);
  } catch (error) {
    console.log('Order cancellation failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }
}

/**
 * Run the debugging process
 */
async function runDebug() {
  try {
    // Check command-line arguments
    const args = process.argv.slice(2);
    
    if (args.length > 0) {
      // Run specific tests based on arguments
      if (args[0] === 'products') {
        await searchProducts();
      } else if (args[0] === 'orders') {
        await getAllOrders();
      } else if (args[0] === 'status') {
        await getOrderStatus();
      } else if (args[0] === 'simple-order') {
        await testSimpleOrder();
      } else if (args[0] === 'cancel-order') {
        // Try to cancel a specific order if provided as second argument
        const orderId = args.length > 1 ? args[1] : null;
        await testCancelOrder(orderId);
      } else {
        console.log(`Unknown command: ${args[0]}`);
        console.log('Available commands: products, orders, status, simple-order, cancel-order');
      }
    } else {
      // Run all tests
      await searchProducts();
      await getAllOrders();
      await getOrderStatus();
    }
  } catch (error) {
    console.error('Debug process failed:', error);
  }
}

// Run the debugging
runDebug(); 