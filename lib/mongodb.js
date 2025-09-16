// lib/mongodb.js - MongoDB connection for Vibe Project Hosting
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB_NAME || 'vibeapp';

const options = {
  maxPoolSize: 10,        // Maintain up to 10 socket connections
  minPoolSize: 2,         // Maintain at least 2 socket connections
  maxIdleTimeMS: 30000,   // Close connections after 30 seconds of inactivity
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
};

let client;
let clientPromise;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable to preserve the connection across module reloads
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, create a new client
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

// Helper function to get database
export async function getDatabase() {
  const client = await clientPromise;
  return client.db(dbName);
}

// Helper function to get projects collection
export async function getProjectsCollection() {
  const db = await getDatabase();
  return db.collection('projects');
}

// Test connection
export async function testConnection() {
  try {
    const db = await getDatabase();
    await db.admin().ping();
    console.log('MongoDB connected successfully to', uri);
    return true;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    return false;
  }
}

// Close connection (useful for cleanup)
export async function closeConnection() {
  try {
    const client = await clientPromise;
    await client.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error closing MongoDB connection:', error);
  }
}

export default clientPromise;