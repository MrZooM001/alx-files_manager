import { redisClient } from '../utils/redis';
import { dbClient } from '../utils/db';

class AppController {
    static async getStatus(req, res) {
        const status = {
            redis: redisClient.isAlive(),
            db: dbClient.isAlive(),
        };
        res.status(200).json(status);
    }

    static async getStats(req, res) {
        const usersCount = await dbClient.nbUsers();
        const filesCount = await dbClient.nbFiles();
        res.status(200).json({
            users: usersCount,
            files: filesCount,
        });
    }
}

export default AppController;
