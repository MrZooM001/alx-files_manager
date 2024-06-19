import Bull from 'bull';
import dbClient from './utils/db.js';
import imageThumbnail from 'image-thumbnail';

const fileQueue = new Bull('fileQueue');

fileQueue.process(async (job) => {
  const { userId, fileId } = job.data;

  if (!fileId) {
    throw new Error('Missing fileId');
  }

  if (!userId) {
    throw new Error('Missing userId');
  }

  const file = await dbClient.db.collection('files').findOne({
    _id: new ObjectId(fileId),
    userId: new ObjectId(userId),
  });

  if (!file) {
    throw new Error('File not found');
  }

  if (file.type !== 'image') {
    throw new Error('File is not an image');
  }

  const originalPath = file.localPath;

  const sizes = [500, 250, 100];
  const promises = sizes.map(async (size) => {
    const thumbPath = `${originalPath}_${size}`;

    try {
      const thumbBuffer = await imageThumbnail(createReadStream(originalPath), { width: size });
      await fs.writeFile(thumbPath, thumbBuffer);
    } catch (err) {
      console.error(`Error generating thumbnail for size ${size}: ${err}`);
    }
  });

  await Promise.all(promises);
});

console.log('Worker is running...');
