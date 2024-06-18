import { createHash } from 'crypto';
import { dbClient } from '../utils/db';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    const userCollection = dbClient.db.collection('users');

    const userEmail = await userCollection.findOne({ email });
    if (userEmail) {
      return res.status(400).json({ error: 'Already exist' });
    }

    const hashedPassword = createHash('sha1').update(password).digest('hex');
    const newUser = { email, password: hashedPassword };

    const result = await userCollection.insertOne(newUser);

    return res.status(201).json({ id: result.insertedId, username: newUser.email });
  }
}

export default UsersController;
