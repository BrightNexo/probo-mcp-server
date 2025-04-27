/**
 * proboClient.js
 * A client for interacting with the Probo API
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize API configuration from environment variables
const PROBO_API_KEY = process.env.PROBO_API_KEY;
const PROBO_API_URL = process.env.PROBO_API_URL || 'https://api.proboprints.com';
const PROBO_API_MODE = process.env.PROBO_API_MODE || 'test';

// Enable/disable detailed logging
const ENABLE_DETAILED_LOGGING = true;

if (!PROBO_API_KEY) {
  throw new Error('PROBO_API_KEY environment variable must be set');
}

/**
 * Creates an authorized API client for Probo
 * @returns {Object} Axios instance configured for Probo API
 */
function createProboClient() {
  const client = axios.create({
    baseURL: PROBO_API_URL,
    headers: {
      'Authorization': `Basic ${PROBO_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  
  // Add request/response interceptors for logging if enabled
  if (ENABLE_DETAILED_LOGGING) {
    // Log request details
    client.interceptors.request.use(request => {
      console.log('\n[API REQUEST]');
      console.log(`${request.method.toUpperCase()} ${request.baseURL}${request.url}`);
      console.log('Headers:', JSON.stringify(request.headers, null, 2));
      
      if (request.data) {
        console.log('Request payload:', JSON.stringify(request.data, null, 2));
      }
      
      return request;
    });
    
    // Log response details
    client.interceptors.response.use(
      response => {
        console.log('\n[API RESPONSE]');
        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log('Response data:', JSON.stringify(response.data, null, 2));
        return response;
      },
      error => {
        console.log('\n[API ERROR]');
        if (error.response) {
          console.log(`Status: ${error.response.status} ${error.response.statusText}`);
          console.log('Response data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
          console.log('No response received');
          console.log('Request:', error.request);
        } else {
          console.log('Error message:', error.message);
        }
        return Promise.reject(error);
      }
    );
  }
  
  return client;
}

/**
 * Get a list of all available products from Probo
 * @param {string} [query] - Optional search query
 * @param {Object} [options={}] - Additional options like page, per_page, etc.
 * @returns {Promise<Object>} Products response
 */
export async function getProducts(query = '', options = {}) {
  const client = createProboClient();
  // Use the /products endpoint as indicated in the API docs
  const queryParams = new URLSearchParams();
  
  // Add pagination parameters to get more products
  queryParams.append('page', options.page || 1);
  queryParams.append('per_page', options.per_page || 20);
  
  if (query) {
    queryParams.append('search', query);
  }
  
  const url = `/products${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  
  try {
    console.log('\n[getProducts] Fetching products from:', url);
    const response = await client.get(url);
    
    // Transform response data to a consistent format
    const responseData = response.data;
    
    // Ensure products are accessible under the 'products' key
    const transformedData = {
      products: responseData.data || [],
      meta: responseData.meta || {}
    };
    
    console.log(`[getProducts] Found ${transformedData.products.length} products`);
    
    return transformedData;
  } catch (error) {
    handleApiError(error, 'Failed to fetch products');
  }
}

/**
 * Configure a product with options
 * @param {string} productCode - The product code to configure
 * @param {Array} [options=[]] - Product options to apply
 * @param {Object} [address=null] - Delivery address if needed
 * @param {string} [language='en'] - Language code
 * @returns {Promise<Object>} Product configuration
 */
export async function configureProduct(productCode, options = [], address = null, language = 'en') {
  const client = createProboClient();
  
  console.log(`\n[configureProduct] Configuring product: ${productCode}`);
  
  // Add minimum required options if not provided (width and height)
  let productOptions = [...options];
  
  // Check if width and height are already in options
  const hasWidth = productOptions.some(opt => opt.code === 'width' || opt.code === 'width_mm');
  const hasHeight = productOptions.some(opt => opt.code === 'height' || opt.code === 'height_mm');
  
  // Add default dimensions if not specified (most products require these)
  if (!hasWidth) {
    productOptions.push({ code: 'width', value: 1000 });
  }
  
  if (!hasHeight) {
    productOptions.push({ code: 'height', value: 1000 });
  }
  
  // The /products endpoint returns products with 'code', so use that format
  const payload = {
    products: [
      {
        // Use the standard code field as seen in the /products API response
        code: productCode,
        options: productOptions,
      },
    ],
    language,
  };
  
  // Add delivery address if provided
  if (address) {
    payload.deliveries = [{
      address,
    }];
  }
  
  try {
    console.log('[configureProduct] Sending configuration request with options:', 
      JSON.stringify(productOptions, null, 2));
    const response = await client.post('/products/configure', payload);
    return response.data;
  } catch (error) {
    // Log the original request payload for debugging
    console.log('[configureProduct] Request failed with payload:', JSON.stringify(payload, null, 2));
    
    // Try to get a product directly to help debugging
    try {
      console.log(`[configureProduct] Attempting to fetch product '${productCode}' directly from /products`);
      const productsResponse = await client.get(`/products?search=${encodeURIComponent(productCode)}`);
      console.log('[configureProduct] Search results:', JSON.stringify(productsResponse.data, null, 2));
      
      // If products were found, suggest a valid code
      if (productsResponse.data.data && productsResponse.data.data.length > 0) {
        const firstProduct = productsResponse.data.data[0];
        console.log(`[configureProduct] Found product: ${firstProduct.code} - ${firstProduct.translations?.en?.title || 'Untitled'}`);
        console.log('[configureProduct] Try using this code instead');
      }
    } catch (searchError) {
      console.log('[configureProduct] Failed to fetch product details:', searchError.message);
    }
    
    handleApiError(error, 'Failed to configure product');
  }
}

/**
 * Place an order with Probo
 * @param {Object} configuration - Complete product configuration
 * @param {Object} address - Delivery address
 * @param {string} reference - Customer reference for the order
 * @param {boolean} [isTest=true] - Whether this is a test order (sets order_type to "test" or "production")
 * @param {Object} [additionalOptions={}] - Additional order options like callbackUrl, errorEmails, etc.
 * @returns {Promise<Object>} Order response
 * @see https://apidocs.proboprints.com/getting-started/sandbox-test-env - Probo sandbox/test environment docs
 * @see https://apidocs.proboprints.com/examples/order - Probo order examples
 */
export async function placeOrder(configuration, address, reference, isTest = PROBO_API_MODE === 'test', additionalOptions = {}) {
  const client = createProboClient();
  
  // Format the address according to API expectations
  const formattedAddress = {
    company_name: address.address_company_name || '',
    first_name: address.address_first_name,
    last_name: address.address_last_name,
    street: address.address_street,
    house_number: address.address_house_number,
    addition: address.address_addition || '',
    postal_code: address.address_postal_code,
    city: address.address_city,
    country: address.address_country,
    phone: address.address_telephone_number || '',
    email: address.address_email || ''
  };
  
  // Transform products to match API requirements
  const formattedProducts = (configuration.products || []).map(product => {
    // Create a new product object with only the allowed fields
    const formattedProduct = {
      // Use code as primary identifier (required by the API)
      code: product.code || product.customer_code,
    };
    
    // Include options if they exist
    if (product.options && product.options.length > 0) {
      formattedProduct.options = product.options;
    }
    
    // Add files if they exist
    if (product.files && product.files.length > 0) {
      formattedProduct.files = product.files;
    } else if (!product.options || product.options.length === 0) {
      // Add a placeholder test file if no files or options are provided
      formattedProduct.files = [
        {
          uri: "https://placekitten.com/800/600",
          fill: true
        }
      ];
    }
    
    // Add uploader if it exists
    if (product.uploader) {
      formattedProduct.uploader = product.uploader;
    }
    
    // Add uploaders array if it exists
    if (product.uploaders && product.uploaders.length > 0) {
      formattedProduct.uploaders = product.uploaders;
    }
    
    return formattedProduct;
  });
  
  // Build order payload based on examples from documentation
  const orderPayload = {
    order_type: isTest ? "test" : "production",
    reference: reference,
    id: additionalOptions.orderId || `order-${Date.now()}`, // Generate an ID if not provided (required)
    contact_email: address.address_email || additionalOptions.contactEmail || '',
    
    // Add callback URLs if provided
    ...(additionalOptions.callbackUrl ? { 
      callback_url: Array.isArray(additionalOptions.callbackUrl) 
        ? additionalOptions.callbackUrl 
        : [additionalOptions.callbackUrl] 
    } : {}),
    
    // Add error email addresses if provided
    ...(additionalOptions.errorEmails ? { 
      error_email_addresses: Array.isArray(additionalOptions.errorEmails) 
        ? additionalOptions.errorEmails 
        : [additionalOptions.errorEmails] 
    } : {}),
    
    // Add deliveries with formatted address and shipping options
    deliveries: [
      {
        address: formattedAddress,
        shipping_method_preset: additionalOptions.shippingMethodPreset || "cheapest",
        delivery_date_preset: additionalOptions.deliveryDatePreset || "cheapest"
      }
    ],
    
    // Add configured products with correct structure
    products: formattedProducts
  };
  
  try {
    console.log(`\n[placeOrder] Placing ${isTest ? 'TEST' : 'PRODUCTION'} order with reference: ${reference}`);
    console.log('[placeOrder] Order payload:', JSON.stringify(orderPayload, null, 2));
    
    const response = await client.post('/order', orderPayload);
    return response.data;
  } catch (error) {
    handleApiError(error, 'Failed to place order');
  }
}

/**
 * Get order status for specified order IDs
 * @param {Array<string>} orderIds - Array of order IDs to check
 * @returns {Promise<Object>} Order status response
 */
export async function getOrderStatus(orderIds) {
  const client = createProboClient();
  
  const payload = {
    orders: orderIds.map(id => ({ id }))
  };
  
  try {
    console.log(`\n[getOrderStatus] Checking status for orders: ${orderIds.join(', ')}`);
    const response = await client.post('/order/status', payload);
    return response.data;
  } catch (error) {
    handleApiError(error, 'Failed to get order status');
  }
}

/**
 * Get details for all orders
 * @param {Object} [filters={}] - Optional filters for the orders query
 * @returns {Promise<Object>} Orders response
 */
export async function getAllOrders(filters = {}) {
  const client = createProboClient();
  
  const queryParams = new URLSearchParams(filters);
  const url = `/orders?${queryParams.toString()}`;
  
  try {
    console.log('\n[getAllOrders] Fetching orders with filters:', filters);
    const response = await client.get(url);
    return response.data;
  } catch (error) {
    handleApiError(error, 'Failed to get orders');
  }
}

/**
 * Cancel an order with Probo
 * @param {string} orderId - The order ID to cancel
 * @returns {Promise<Object>} Cancellation response
 */
export async function cancelOrder(orderId) {
  const client = createProboClient();
  
  // Use the correct simple payload format required by the API
  const payload = {
    id: orderId
  };
  
  try {
    console.log(`\n[cancelOrder] Cancelling order: ${orderId}`);
    const response = await client.post('/order/cancel', payload);
    return response.data;
  } catch (error) {
    handleApiError(error, 'Failed to cancel order');
  }
}

/**
 * Utility function to handle API errors
 * @param {Error} error - The error from axios
 * @param {string} message - Custom error message prefix
 * @throws {Error} Enhanced error with API details
 */
function handleApiError(error, message) {
  let errorMessage = message || 'API request failed';
  let errorData = null;
  
  if (error.response) {
    // Server responded with an error status
    const status = error.response.status;
    const data = error.response.data;
    errorData = data;
    
    errorMessage += `: HTTP ${status}`;
    
    // Add more error details if available
    if (data) {
      if (data.message) {
        errorMessage += ` - ${data.message}`;
      } else if (typeof data === 'string') {
        errorMessage += ` - ${data}`;
      } else {
        errorMessage += ` - ${JSON.stringify(data)}`;
      }
      
      // Extract validation errors for a 400 response
      if (status === 400 && data.errors) {
        errorMessage += '\nValidation errors:';
        if (typeof data.errors === 'string') {
          const uniqueErrors = [...new Set(data.errors.split('\n'))];
          uniqueErrors.slice(0, 10).forEach(err => {
            errorMessage += `\n- ${err}`;
          });
          
          if (uniqueErrors.length > 10) {
            errorMessage += `\n... and ${uniqueErrors.length - 10} more errors`;
          }
        } else if (Array.isArray(data.errors)) {
          data.errors.slice(0, 10).forEach(err => {
            errorMessage += `\n- ${err}`;
          });
          
          if (data.errors.length > 10) {
            errorMessage += `\n... and ${data.errors.length - 10} more errors`;
          }
        }
      }
    }
  } else if (error.request) {
    // Request was made but no response
    errorMessage += ': No response received';
  } else {
    // Error in setting up the request
    errorMessage += `: ${error.message}`;
  }
  
  // Create error object with both message and data
  const enhancedError = new Error(errorMessage);
  enhancedError.data = errorData;
  
  throw enhancedError;
}

export default {
  getProducts,
  configureProduct,
  placeOrder,
  getOrderStatus,
  getAllOrders,
  cancelOrder,
}; 