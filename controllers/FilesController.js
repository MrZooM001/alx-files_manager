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

    if (!type && !VALID_TYPES.includes(type)) {
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

    const { id } = req.params;
    const newVal = { $set: { isPublic: true } };
    const options = { returnOriginal: false };

    const parentFolder = await dbClient.db.collection('files')
      .findOne({ _id: new ObjectId(id), userId: user._id });
    if (!parentFolder) {
      res.status(400).json({ error: 'Parent not found' });
      return;
    }

    if (parentFolder.type !== VALID_TYPES[0]) {
      res.status(400).json({ error: 'Parent is not a folder' });
      return;
    }

    await dbClient.db.collection('files')
      .findOneAndUpdate({
        _id: new ObjectId(id),
        userId: user._id,
      }, newVal, options, (err, file) => {
        if (!file.lastErrorObject.updatedExisting) {
          res.status(404).json({ error: 'Not found' });
        }
        res.status(200).json(file.value);
      });
  }

  static async putUnpublish(req, res) {
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

    const { id } = req.params;
    const newVal = { $set: { isPublic: false } };
    const options = { returnOriginal: false };

    const parentFolder = await dbClient.db.collection('files')
      .findOne({ _id: new ObjectId(id), userId: user._id });
    if (!parentFolder) {
      res.status(400).json({ error: 'Parent not found' });
      return;
    }

    if (parentFolder.type !== VALID_TYPES[0]) {
      res.status(400).json({ error: 'Parent is not a folder' });
      return;
    }

    await dbClient.db.collection('files')
      .findOneAndUpdate({
        _id: new ObjectId(id),
        userId: user._id,
      }, newVal, options, (err, file) => {
        if (!file.lastErrorObject.updatedExisting) {
          res.status(404).json({ error: 'Not found' });
        }
        res.status(200).json(file.value);
      });
  }
}

export default FilesController;
