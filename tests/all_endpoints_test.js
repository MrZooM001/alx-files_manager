import chai from 'chai';
import chaiHttp from 'chai-http';
import { app } from '../server';

chai.use(chaiHttp);
const { expect } = chai;

describe('API Endpoints', () => {
  let token = '';
  let userId = '';
  let fileId = '';

  before(async () => {
    const res = await chai.request(app)
      .post('/users')
      .send({ email: 'test@example.com', password: 'password' });
    userId = res.body.id;

    const loginRes = await chai.request(app)
      .get('/connect')
      .auth('test@example.com', 'password');
    token = loginRes.body.token;
  });

  describe('GET /status', () => {
    it('should return the status of Redis and DB', async () => {
      const res = await chai.request(app).get('/status');
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('redis').that.is.true;
      expect(res.body).to.have.property('db').that.is.true;
    });
  });

  describe('GET /stats', () => {
    it('should return the number of users and files', async () => {
      const res = await chai.request(app).get('/stats');
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('users').that.is.a('number');
      expect(res.body).to.have.property('files').that.is.a('number');
    });
  });

  describe('POST /users', () => {
    it('should create a new user', async () => {
      const res = await chai.request(app)
        .post('/users')
        .send({ email: 'newuser@example.com', password: 'password' });
      expect(res).to.have.status(201);
      expect(res.body).to.have.property('email').that.equals('newuser@example.com');
    });

    it('should return 400 if email is missing', async () => {
      const res = await chai.request(app)
        .post('/users')
        .send({ password: 'password' });
      expect(res).to.have.status(400);
      expect(res.body).to.have.property('error').that.equals('Missing email');
    });

    it('should return 400 if password is missing', async () => {
      const res = await chai.request(app)
        .post('/users')
        .send({ email: 'user@example.com' });
      expect(res).to.have.status(400);
      expect(res.body).to.have.property('error').that.equals('Missing password');
    });
  });

  describe('GET /connect', () => {
    it('should return a token for valid credentials', async () => {
      const res = await chai.request(app)
        .get('/connect')
        .auth('test@example.com', 'password');
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('token');
    });

    it('should return 401 for invalid credentials', async () => {
      const res = await chai.request(app)
        .get('/connect')
        .auth('test@example.com', 'wrongpassword');
      expect(res).to.have.status(401);
      expect(res.body).to.have.property('error').that.equals('Unauthorized');
    });
  });

  describe('GET /disconnect', () => {
    it('should sign out the user', async () => {
      const res = await chai.request(app)
        .get('/disconnect')
        .set('X-Token', token);
      expect(res).to.have.status(204);
    });

    it('should return 401 if token is invalid', async () => {
      const res = await chai.request(app)
        .get('/disconnect')
        .set('X-Token', 'invalid_token');
      expect(res).to.have.status(401);
      expect(res.body).to.have.property('error').that.equals('Unauthorized');
    });
  });

  describe('GET /users/me', () => {
    it('should return the user data for valid token', async () => {
      const res = await chai.request(app)
        .get('/users/me')
        .set('X-Token', token);
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('id').that.equals(userId);
      expect(res.body).to.have.property('email').that.equals('test@example.com');
    });

    it('should return 401 if token is invalid', async () => {
      const res = await chai.request(app)
        .get('/users/me')
        .set('X-Token', 'invalid_token');
      expect(res).to.have.status(401);
      expect(res.body).to.have.property('error').that.equals('Unauthorized');
    });
  });

  describe('POST /files', () => {
    it('should create a new file', async () => {
      const res = await chai.request(app)
        .post('/files')
        .set('X-Token', token)
        .send({
          name: 'testfile.txt',
          type: 'file',
          data: Buffer.from('Hello World').toString('base64')
        });
      expect(res).to.have.status(201);
      expect(res.body).to.have.property('name').that.equals('testfile.txt');
      fileId = res.body.id;
    });

    it('should return 400 if name is missing', async () => {
      const res = await chai.request(app)
        .post('/files')
        .set('X-Token', token)
        .send({
          type: 'file',
          data: Buffer.from('Hello World').toString('base64')
        });
      expect(res).to.have.status(400);
      expect(res.body).to.have.property('error').that.equals('Missing name');
    });

    it('should return 400 if type is missing', async () => {
      const res = await chai.request(app)
        .post('/files')
        .set('X-Token', token)
        .send({
          name: 'testfile.txt',
          data: Buffer.from('Hello World').toString('base64')
        });
      expect(res).to.have.status(400);
      expect(res.body).to.have.property('error').that.equals('Missing type');
    });

    it('should return 400 if data is missing for file type', async () => {
      const res = await chai.request(app)
        .post('/files')
        .set('X-Token', token)
        .send({
          name: 'testfile.txt',
          type: 'file'
        });
      expect(res).to.have.status(400);
      expect(res.body).to.have.property('error').that.equals('Missing data');
    });
  });

  describe('GET /files/:id', () => {
    it('should return the file document for valid id', async () => {
      const res = await chai.request(app)
        .get(`/files/${fileId}`)
        .set('X-Token', token);
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('id').that.equals(fileId);
    });

    it('should return 404 for invalid id', async () => {
      const res = await chai.request(app)
        .get('/files/invalid_id')
        .set('X-Token', token);
      expect(res).to.have.status(404);
      expect(res.body).to.have.property('error').that.equals('Not found');
    });
  });

  describe('GET /files', () => {
    it('should return the list of files', async () => {
      const res = await chai.request(app)
        .get('/files')
        .set('X-Token', token)
        .query({ parentId: 0, page: 0 });
      expect(res).to.have.status(200);
      expect(res.body).to.be.an('array');
    });
  });

  describe('PUT /files/:id/publish', () => {
    it('should set isPublic to true', async () => {
      const res = await chai.request(app)
        .put(`/files/${fileId}/publish`)
        .set('X-Token', token);
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('isPublic').that.is.true;
    });

    it('should return 404 for invalid id', async () => {
      const res = await chai.request(app)
        .put('/files/invalid_id/publish')
        .set('X-Token', token);
      expect(res).to.have.status(404);
      expect(res.body).to.have.property('error').that.equals('Not found');
    });
  });

  describe('PUT /files/:id/unpublish', () => {
    it('should set isPublic to false', async () => {
      const res = await chai.request(app)
        .put(`/files/${fileId}/unpublish`)
        .set('X-Token', token);
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('isPublic').that.is.false;
    });

    it('should return 404 for invalid id', async () => {
      const res = await chai.request(app)
        .put('/files/invalid_id/unpublish')
        .set('X-Token', token);
      expect(res).to.have.status(404);
      expect(res.body).to.have.property('error').that.equals('Not found');
    });
  });

  describe('GET /files/:id/data', () => {
    it('should return the content of the file', async () => {
      const res = await chai.request(app)
        .get(`/files/${fileId}/data`)
        .set('X-Token', token);
      expect(res).to.have.status(200);
      expect(res.type).to.equal('text/plain');
      expect(res.text).to.equal('Hello World');
    });

    it('should return 404 for invalid id', async () => {
      const res = await chai.request(app)
        .get('/files/invalid_id/data')
        .set('X-Token', token);
      expect(res).to.have.status(404);
      expect(res.body).to.have.property('error').that.equals('Not found');
    });

    it('should return 400 if file is a folder', async () => {
      const res = await chai.request(app)
        .post('/files')
        .set('X-Token', token)
        .send({
          name: 'testfolder',
          type: 'folder'
        });
      const folderId = res.body.id;

      const folderRes = await chai.request(app)
        .get(`/files/${folderId}/data`)
        .set('X-Token', token);
      expect(folderRes).to.have.status(400);
      expect(folderRes.body).to.have.property('error')
        .that.equals("A folder doesn't have content");
    });
  });
});
