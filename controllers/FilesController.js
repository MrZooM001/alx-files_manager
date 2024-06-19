import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuid4 } from 'uuid';
import { env } from 'process';
import mime from 'mime-types';
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

    const { name, type, data } = req.body;
    const isPublic = req.body || false;
    const parentId = req.body || 0;

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
        .findOne({ _id: new ObjectId(parentId), userId: user._id });
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
      userId: user._id,
      name,
      type,
      isPublic,
      parentId: parentId || 0,
    };

    if (type === VALID_TYPES[0]) {
      await dbClient.db.collection('files').insertOne(fileDocument)
        .then((result) => {
          res.status(201).json({
            id: result.insertedId,
            ...fileDocument,
          }).catch((err) => {
            console.error(err);
          });
        });
    } else {
      const filePath = path.join(FOLDER_PATH, uuid4());
      const buffer = Buffer.from(data, 'base64');

      await fs.mkdir(FOLDER_PATH, { recursive: true });
      await fs.writeFile(filePath, buffer);

      await dbClient.db.collection('files').insertOne({
        ...fileDocument,
        localPath: filePath,
      }).then((result) => {
        res.status(201).json({ id: result.insertedId, ...fileDocument });
      });
    }
  }

  static async getShow(req, res) {
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

    const fileId = req.params.id;
    const file = await dbClient.db.collection('files')
      .findOne({ _id: fileId, userId: user._id });
    if (!file) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    res.status(200).json(file);
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
