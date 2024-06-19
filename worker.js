import Bull from 'bull';
import imageThumbnail from 'image-thumbnail';
import { promises as fs } from 'fs';
import { ObjectId } from 'mongodb';
import { dbClient } from './utils/db';

const fileQueue = new Bull('fileQueue');
const userQueue = new Bull('userQueue');

userQueue.process(async (job, done) => {
  const { userId } = job.data;
  if (!userId) {
    done(new Error('Missing userId'));
  }

  const user = await dbClient.db.collection('users')
    .findOne({ _id: new ObjectId(userId) });

  if (!user) {
    done(new Error('User not found'));
  }

  console.log(`Welcome ${user.email}!`);
});

fileQueue.process(async (job, done) => {
  const { userId, fileId } = job.data;

  if (!fileId) {
    done(new Error('Missing fileId'));
  }

  if (!userId) {
    done(new Error('Missing userId'));
  }

  const file = await dbClient.db.collection('files').findOne({
    _id: new ObjectId(fileId),
    userId: new ObjectId(userId),
  });

  if (!file) {
    done(new Error('File not found'));
  }

  if (file.type !== 'image') {
    done(new Error('File is not an image'));
  }

  const originalPath = file.localPath;

  const sizes = [500, 250, 100];
  const promises = sizes.map(async (size) => {
    const thumbPath = `${originalPath}_${size}`;

    try {
      const thumbBuffer = await imageThumbnail(fs.createReadStream(originalPath), { width: size });
      await fs.writeFile(thumbPath, thumbBuffer);
    } catch (err) {
      console.error(`Error generating thumbnail for size ${size}: ${err}`);
    }
  });

  await Promise.all(promises);
});

console.log('Worker is running...');
