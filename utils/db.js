import { MongoClient } from 'mongodb';
import { env } from 'process';

const DB_HOST = env.DB_HOST || 'localhost';
const DB_PORT = env.DB_PORT || '27017';
const DB_DATABASE = env.DB_DATABASE || 'files_manager';
const mongoUrl = `mongodb://${DB_HOST}:${DB_PORT}`;

class DBClient {
  constructor() {
    this.client = new MongoClient(mongoUrl, {
      useNewUrlParser: true, useUnifiedTopology: true,
    });

    this.dbName = DB_DATABASE;
    this.isConnected = false;

    this.client.connect().then(() => {
      this.isConnected = true;
      this.db = this.client.db(this.dbName);
    }).catch((err) => {
      console.error('Redis client not connected:', err.message || err.toString());
    });
  }

  isAlive() {
    return this.isConnected;
  }

  async nbUsers() {
    if (!this.isAlive()) return 0;
    return this.db.collection('users').countDocuments();
  }

  async nbFiles() {
    if (!this.isAlive()) return 0;
    return this.db.collection('files').countDocuments();
  }
}

export const dbClient = new DBClient();
export default dbClient;
