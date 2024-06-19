import sha1 from 'sha1';
import Bull from 'bull';
import { ObjectId } from 'mongodb';
import { dbClient } from '../utils/db';
import { redisClient } from '../utils/redis';

const userQueue = new Bull('userQueue');

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body || null;

    if (!email) {
      res.status(400).json({ error: 'Missing email' });
      return;
    }

    if (!password) {
      res.status(400).json({ error: 'Missing password' });
      return;
    }

    const userEmail = await dbClient.db.collection('users').findOne({ email });
    if (userEmail) {
      res.status(400).json({ error: 'Already exist' });
      return;
    }
    const newUser = { email, password: sha1(password) };

    const result = await dbClient.db.collection('users').insertOne(newUser);
    const userId = result.insertedId.toString();
    await userQueue.add({ userId });
    res.status(201).json({ id: userId, email: newUser.email });
  }

  static async getMe(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const key = `auth_${token}`;

    const userId = await redisClient.get(key);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await dbClient.db.collection('users')
      .findOne({ _id: new ObjectId(userId) });
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    res.status(200).json({ id: user._id, email: user.email });
  }
}

export default UsersController;
