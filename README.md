# Probo API Integration with MCP

This project implements a Model Context Protocol (MCP) server that wraps the Probo API, making it easier to interact with Probo's printing services.

## What is MCP?

Model Context Protocol (MCP) is a communication protocol designed to facilitate interaction between AI systems and external tools or services. In this project, we use MCP to:

1. **Standardize API Interactions**: Wrapping the Probo API with MCP provides a consistent interface for all API operations
2. **Validate Inputs**: MCP uses Zod schemas to validate inputs before they reach the API, reducing errors
3. **Simplify Integration**: AI assistants and other systems can easily discover and use available tools
4. **Provide Structure**: The protocol creates a standardized structure for requests and responses

MCP creates a typed, consistent interface that makes it easier to work with the Probo API from various client applications or AI assistants.

## Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with your Probo API credentials:
   ```
   PROBO_API_KEY=your_api_key_here
   PROBO_API_URL=https://api.proboprints.com
   PROBO_API_MODE=test  # Use 'test' for sandbox, 'production' for live orders
   ```

## Available MCP Tools

The server provides the following tools:

### searchProducts

Searches for products available through the Probo API.

**Arguments:**
- `query` (optional): Search term to filter products
- `language` (optional): Language code (e.g., "en", "nl")
- `page` (optional): Page number for pagination
- `per_page` (optional): Items per page (max 50)

**Example:**
```javascript
const result = await client.callTool({
  name: 'searchProducts',
  arguments: {
    query: 'banner',
    page: 1,
    per_page: 20
  }
});
```

### configureProduct

Configures a product with selected options.

**Arguments:**
- `productCode`: Product code to configure
- `options` (optional): Array of product options (code/value pairs)
- `address` (optional): Delivery address
- `language` (optional): Language code (e.g., "en", "nl")

**Example:**
```javascript
const result = await client.callTool({
  name: 'configureProduct',
  arguments: {
    productCode: 'deco-fabric',
    options: [
      { code: 'width', value: 1000 },
      { code: 'height', value: 1000 },
      { code: 'amount', value: 1 }
    ],
    language: 'en'
  }
});
```

### placeOrder

Places an order with Probo.

**Arguments:**
- `configuration`: Complete product configuration with products array
- `address`: Delivery address details
- `reference`: Customer reference for the order
- `isTest` (optional): Whether this is a test order
- `additionalOptions` (optional): Additional order options

**Example:**
```javascript
const result = await client.callTool({
  name: 'placeOrder',
  arguments: {
    configuration: {
      language: 'en',
      products: [
        {
          code: 'tensioner-with-spinhook',
          options: [
            { code: 'amount', value: '1' }
          ]
        }
      ]
    },
    address: {
      address_company_name: 'Company Name',
      address_first_name: 'First',
      address_last_name: 'Last',
      address_street: 'Street',
      address_house_number: '123',
      address_postal_code: '1234AB',
      address_city: 'City',
      address_country: 'NL',
      address_telephone_number: '1234567890',
      address_email: 'email@example.com'
    },
    reference: 'Order Reference',
    isTest: true
  }
});
```

### getOrderStatus

Gets status information for specific orders.

**Arguments:**
- `orderIds`: Array of order IDs to check

**Example:**
```javascript
const result = await client.callTool({
  name: 'getOrderStatus',
  arguments: {
    orderIds: ['order-123456789']
  }
});
```

### getAllOrders

Gets a list of all orders with optional filtering.

**Arguments:**
- `filters` (optional): Object with filter options like page, per_page, status, etc.

**Example:**
```javascript
const result = await client.callTool({
  name: 'getAllOrders',
  arguments: {
    filters: {
      page: 1,
      per_page: 10,
      status: 'accepted'
    }
  }
});
```

### cancelOrder

Cancels a specific order.

**Arguments:**
- `orderId`: ID of the order to cancel

**Example:**
```javascript
const result = await client.callTool({
  name: 'cancelOrder',
  arguments: {
    orderId: 'order-123456789'
  }
});
```

## Using the MCP Client

To interact with the MCP server, you need to use an MCP client. The project includes an example client in `client.js`. Here's how to initialize and use the client:

### Initializing the Client

```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function runClient() {
  // Create a client
  const client = new Client({
    name: 'probo-mcp-client',
    version: '0.1.0',
  });
  
  // Connect to the server
  await client.connect(new StdioClientTransport({
    command: 'node',
    args: ['server.js'],
  }));
  
  console.log('Connected to server successfully!');
  
  // Call tools here
  
  // Close the connection when done
  await client.close();
}

runClient().catch(console.error);
```

### Complete Example

Here's a complete example that demonstrates searching for products, configuring a product, and placing an order:

```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function runClient() {
  // Create a client
  const client = new Client({
    name: 'probo-mcp-client',
    version: '0.1.0',
  });
  
  // Connect to the server
  await client.connect(new StdioClientTransport({
    command: 'node',
    args: ['server.js'],
  }));
  
  console.log('Connected to server successfully!');
  
  // 1. Search for products
  const searchResult = await client.callTool({
    name: 'searchProducts',
    arguments: {},
  });
  
  if (searchResult.isError) {
    console.error('Search failed:', searchResult.content[0].text);
    return;
  }
  
  const searchData = JSON.parse(searchResult.content[1].text);
  const products = searchData.products;
  
  if (!products || products.length === 0) {
    console.error('No products found');
    return;
  }
  
  // Use the first product code from search results
  const productCode = products[0].code;
  console.log(`Using product code: ${productCode}`);
  
  // 2. Configure the product
  const configureResult = await client.callTool({
    name: 'configureProduct',
    arguments: {
      productCode,
      options: [
        { code: 'width', value: 1000 },
        { code: 'height', value: 1000 },
        { code: 'amount', value: 1 }
      ],
      language: 'en',
    },
  });
  
  if (configureResult.isError) {
    console.error('Configuration failed:', configureResult.content[0].text);
    return;
  }
  
  // 3. Place an order
  const orderResult = await client.callTool({
    name: 'placeOrder',
    arguments: {
      configuration: {
        language: 'en',
        products: [
          {
            code: 'tensioner-with-spinhook',
            options: [
              { code: 'amount', value: '1' }
            ]
          }
        ]
      },
      address: {
        address_company_name: 'Test Company',
        address_first_name: 'John',
        address_last_name: 'Doe',
        address_street: 'Test Street',
        address_house_number: '123',
        address_postal_code: '1234AB',
        address_city: 'Test City',
        address_country: 'NL',
        address_telephone_number: '1234567890',
        address_email: 'test@example.com'
      },
      reference: 'Test Order',
      isTest: true,
      additionalOptions: {
        orderId: `test-order-${Date.now()}`
      }
    },
  });
  
  if (orderResult.isError) {
    console.error('Order placement failed:', orderResult.content[0].text);
    return;
  }
  
  const orderData = JSON.parse(orderResult.content[1].text);
  console.log('Order placed successfully!');
  console.log(`Order ID: ${orderData.order?.id}`);
  
  // Close the connection when done
  await client.close();
}

runClient().catch(console.error);
```

This client code demonstrates a complete workflow from searching products to placing an order. You can adapt it to your specific needs.

## Running Tests

There are two test scripts included:

1. `test.js` - Runs an automated test suite for all tools
   ```bash
   node test.js
   ```

2. `debug.js` - Allows testing specific operations with command-line arguments
   ```bash
   # Search for products
   node debug.js products
   
   # Get all orders
   node debug.js orders
   
   # Get order status
   node debug.js status
   
   # Place a simple test order
   node debug.js simple-order
   
   # Cancel an order
   node debug.js cancel-order ORDER_ID
   ```

## Notes

- All orders placed with `isTest: true` (or when `PROBO_API_MODE=test`) will be automatically canceled by Probo.
- API credentials are required to use this integration. Contact Probo to obtain your API key.
- For more information on the Probo API, refer to [Probo API Documentation](https://apidocs.proboprints.com/).

## Using MCP Tools in Chat Interfaces

The Probo MCP tools can also be used from AI chat interfaces that support tool calling, like Claude or similar AI assistants.

### Setup for Chat Interfaces

1. First, you need to have the MCP server running. Start it with:
   ```bash
   node server.js
   ```

2. Connect an MCP-compatible AI chat interface to your server. This typically involves specific configuration on the AI platform side.

### Technical Integration

To integrate the MCP server with chat applications or AI platforms, several approaches can be used:

1. **HTTP API Gateway**: Create an HTTP API wrapper around the MCP server to allow web-based AI interfaces to communicate with it. This typically involves:
   ```javascript
   // Example HTTP server that forwards requests to MCP
   import express from 'express';
   import { Client } from '@modelcontextprotocol/sdk/client/index.js';
   import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

   const app = express();
   app.use(express.json());

   // Create a global MCP client
   const mcpClient = new Client({
     name: 'probo-mcp-client',
     version: '0.1.0',
   });

   // Connect to the MCP server
   await mcpClient.connect(new StdioClientTransport({
     command: 'node',
     args: ['server.js'],
   }));

   app.post('/api/tools/:toolName', async (req, res) => {
     try {
       const result = await mcpClient.callTool({
         name: req.params.toolName,
         arguments: req.body,
       });
       res.json(result);
     } catch (error) {
       res.status(500).json({ error: error.message });
     }
   });

   app.listen(3000, () => {
     console.log('MCP HTTP Gateway running on port 3000');
   });
   ```

2. **WebSocket Connection**: For more interactive experiences, set up a WebSocket server that communicates with the MCP server.

3. **Cloud Function Integration**: Deploy the MCP server as a cloud function that AI platforms can call directly.

4. **Anthropic Tools API**: If using Claude or similar advanced AI assistants, set up the MCP server as a registered tool provider in their tools ecosystem.

Remember to implement proper authentication and rate limiting when exposing the MCP server to external systems.

### Example Prompts for Chat Interfaces

When using the MCP tools from a chat interface, you can use prompts similar to these:

#### Searching for Products

```
Please search for printing products related to banners.
```

The AI will call the `searchProducts` tool with appropriate parameters.

#### Placing an Order

```
Please place an order for a tensioner with spinhook. Use these delivery details:
- Company: Example Corp
- Name: John Doe
- Address: Example Street, 123
- Postal Code: 1234AB
- City: Amsterdam
- Country: NL
- Reference: Test order from chat
```

The AI will use the appropriate tools to search for the product, configure it, and place the order.

### Benefits of Using MCP in Chat

- **Natural Language Interface**: You can use natural language to interact with the Probo API.
- **Contextual Awareness**: The AI remembers previous interactions and can maintain context across multiple requests.
- **Task Chaining**: Complex workflows like product configuration and ordering can be broken down into conversational steps.
- **Accessibility**: Non-technical users can interact with the API without knowing the technical details.

This approach creates a more user-friendly experience for Probo API interactions, especially for users who prefer conversational interfaces over programming. 