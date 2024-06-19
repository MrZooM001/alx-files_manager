import { expect } from 'chai';
import { redisClient } from '../utils/redis';

describe('redisClient', () => {
  it('should return true when Redis is alive', async () => {
    const alive = await redisClient.isAlive();
    expect(alive).to.be.true;
  });

  it('should set and get a value correctly', async () => {
    await redisClient.set('test_key', 'test_value', 10);
    const value = await redisClient.get('test_key');
    expect(value).to.equal('test_value');
  });

  it('should delete a value correctly', async () => {
    await redisClient.set('test_key', 'test_value', 10);
    await redisClient.del('test_key');
    const value = await redisClient.get('test_key');
    expect(value).to.be.null;
  });
});
