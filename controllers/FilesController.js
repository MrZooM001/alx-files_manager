import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuid4 } from 'uuid';
import { env } from 'process';
import { ObjectId } from 'mongodb';
import { dbClient } from '../utils/db';
import { redisClient } from '../utils/redis';

const VALID_TYPES = ['folder', 'file', 'image'];
const FOLDER_PATH = env.FOLDER_PATH || '/tmp/files_manager/';

class FilesController {
  static async postUpload(req, res) {
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

    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Missing name' });
      return;
    }

    if (!type || !VALID_TYPES.includes(type)) {
      res.status(400).json({ error: 'Missing type' });
      return;
    }

    if (!data && type !== VALID_TYPES[0]) {
      res.status(400).json({ error: 'Missing data' });
      return;
    }

    if (parentId instanceof Set) {
      const parentFolder = await dbClient.db.collection('files')
        .findOne({ _id: new ObjectId(parentId) });
      if (!parentFolder) {
        res.status(400).json({ error: 'Parent not found' });
        return;
      }

      if (parentFolder.type !== VALID_TYPES[0]) {
        res.status(400).json({ error: 'Parent is not a folder' });
        return;
      }
    }

    const fileDocument = {
      userId,
      name,
      type,
      isPublic,
      parentId: parentId !== 0 ? new ObjectId(parentId) : 0,
    };

    if (type === VALID_TYPES[0]) {
      const result = await dbClient.db.collection('files').insertOne(fileDocument);
      res.status(201).json({ id: result.insertedId, ...fileDocument });
    }

    await fs.mkdir(FOLDER_PATH, { recursive: true });

    const filePath = path.join(FOLDER_PATH, uuid4());
    const buffer = Buffer.from(data, 'base64');
    await fs.writeFile(filePath, buffer);

    fileDocument.localPath = filePath;

    const result = await dbClient.db.collection('files').insertOne(fileDocument);
    res.status(201).json({ id: result.insertedId, ...fileDocument });
  }
}

export default FilesController;
