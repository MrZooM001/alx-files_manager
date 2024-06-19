import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuid4 } from 'uuid';
import { env } from 'process';
import mime from 'mime-types';
import Bull from 'bull';
import { ObjectId } from 'mongodb';
import { dbClient } from '../utils/db';
import { redisClient } from '../utils/redis';

const VALID_TYPES = ['folder', 'file', 'image'];
const FOLDER_PATH = env.FOLDER_PATH || '/tmp/files_manager/';

const fileQueue = new Bull('fileQueue', 'redis://127.0.0.1:6379');

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    if (!type || !VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (type !== VALID_TYPES[0] && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    if (parentId) {
      const parent = await dbClient.db.collection('files')
        .findOne({ _id: new ObjectId(parentId) });

      if (!parent) {
        return res.status(400).json({ error: 'Parent not found' });
      }

      if (parent.type !== VALID_TYPES[0]) {
        return res.status(400).json({ error: 'Parent is not a folder' });
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
      return res.status(201).json({ id: result.insertedId, ...fileDocument });
    }

    await fs.mkdir(FOLDER_PATH, { recursive: true });

    const filePath = path.join(FOLDER_PATH, uuid4());
    const buffer = Buffer.from(data, 'base64');
    await fs.writeFile(filePath, buffer);

    fileDocument.localPath = filePath;

    const result = await dbClient.db.collection('files').insertOne(fileDocument);

    const fileId = result.insertedId;
    if (type === VALID_TYPES[2]) {
      await fileQueue.add({
        userId: new ObjectId(userId).toString(),
        fileId: fileId.toString(),
      });
    }

    return res.status(201).json({ id: fileId, ...fileDocument });
  }

  static async getShow(req, res) {
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const file = await dbClient.db.collection('files')
      .findOne({ _id: new ObjectId(fileId), userId: new ObjectId(userId) });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json(file);
  }

  static async getIndex(req, res) {
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

    const { parentId = 0, page = 0 } = req.query;
    const limit = 20;
    const skip = page * limit;

    const matchQuery = {
      userId: user._id,
      parentId: parentId !== 0 ? new ObjectId(parentId) : 0,
    };

    const files = await dbClient.db.collection('files')
      .aggregate(
        {
          $match: matchQuery,
        },
        { $skip: skip },
        { $limit: limit },
      ).toArray();

    res.status(200).json(files);
  }

  static async putPublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const file = await dbClient.db.collection('files')
      .findOne({ _id: new ObjectId(fileId), userId: new ObjectId(userId) });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    await dbClient.db.collection('files').updateOne(
      { _id: new ObjectId(fileId) },
      { $set: { isPublic: true } },
    );

    const updatedFile = await dbClient.db.collection('files')
      .findOne({ _id: new ObjectId(fileId) });

    return res.status(200).json(updatedFile);
  }

  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const file = await dbClient.db.collection('files')
      .findOne({ _id: new ObjectId(fileId), userId: new ObjectId(userId) });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    await dbClient.db.collection('files').updateOne(
      { _id: new ObjectId(fileId) },
      { $set: { isPublic: false } },
    );

    const updatedFile = await dbClient.db.collection('files')
      .findOne({ _id: new ObjectId(fileId) });

    return res.status(200).json(updatedFile);
  }

  static async getFile(req, res) {
    const token = req.headers['x-token'];
    const fileId = req.params.id;
    const { size } = parseInt(req.query, 10);

    try {
      const file = await dbClient.db.collection('files')
        .findOne({ _id: new ObjectId(fileId) });

      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      if (!file.isPublic) {
        if (!token) {
          return res.status(404).json({ error: 'Not found' });
        }

        const userId = await redisClient.get(`auth_${token}`);
        if (!userId || file.userId.toString() !== userId.toString()) {
          return res.status(404).json({ error: 'Not found' });
        }
      }

      if (file.type === 'folder') {
        return res.status(400).json({ error: "A folder doesn't have content" });
      }

      if (!file.localPath) {
        return res.status(404).json({ error: 'Not found' });
      }

      let filePath = file.localPath;

      if (size === 500 || size === 250 || size === 100) {
        filePath = `${file.localPath}_${size}`;
      }

      try {
        await fs.access(filePath);
      } catch (error) {
        return res.status(404).json({ error: 'Not found' });
      }

      const data = await fs.readFile(file.localPath);

      const mimeType = mime.contentType(file.name);
      res.setHeader('Content-Type', mimeType);

      return res.status(200).send(data);
    } catch (error) {
      return res.status(404).json({ error: 'Not found' });
    }
  }
}

export default FilesController;
