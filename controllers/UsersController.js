import sha1 from 'sha1';
import { dbClient } from '../utils/db';

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
    console.log(newUser.email);
    res.status(201).json({ id: result.insertedId, email: newUser.email });
  }
}

export default UsersController;
