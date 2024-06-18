import express from 'express';
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';

const router = express.Router();

// Server statistics
router.get('/status', AppController.getStatus);
router.get('/stats', AppController.getStats);

// Add new user
router.post('/users', UsersController.postNew);

// User Authentication with Token
router.get('/connect', AuthController.getConnect)
router.get('/disconnect', AuthController.getDisconnect)
router.get('/users/me', UsersController.getMe)

export default router;
