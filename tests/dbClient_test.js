import { expect } from 'chai';
import { dbClient } from '../utils/db';

describe('dbClient', () => {
  it('should return true when MongoDB is alive', async () => {
    const alive = dbClient.isAlive();
    expect(alive).to.be.true;
  });

  it('should return the number of users', async () => {
    const nbUsers = await dbClient.nbUsers();
    expect(nbUsers).to.be.a('number');
  });

  it('should return the number of files', async () => {
    const nbFiles = await dbClient.nbFiles();
    expect(nbFiles).to.be.a('number');
  });
});
