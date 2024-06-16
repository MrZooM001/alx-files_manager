import { createClient } from 'redis';

class RedisClient {
    constructor() {
        this.client = createClient();
        this.isConnected = false;
        this.client.on('connect', () => {
            this.isConnected = true;
        });
        this.client.on('error', (err) => {
            this.isConnected = false;
            console.error("Redis client not connected:", err.message || err.toString());
        });
    }

    isAlive() {
        return this.isConnected;
    }

    get(key) {
        return new Promise((resolve, reject) => {
            this.client.get(key, (err, result) => {
                if (err) {
                    reject(err);
                }
                resolve(result);
            });
        });
    }

    set(key, value, duration) {
        return new Promise((resolve, reject) => {
            this.client.setex(key, duration, value, (err) => {
                if (err) {
                    reject(err);
                }
                return resolve(true);
            });
        });
    }

    del(key) {
        return new Promise((resove, reject) => {
            this.client.del(key, (err) => {
                if (err) {
                    reject(err);
                }
                resolve(true);
            });
        })
    }
}

export const redisClient = new RedisClient();
export default redisClient;
