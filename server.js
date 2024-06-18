import express from 'express';
import { env } from 'process';
import router from './routes/index';

const app = express();
const port = env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', router);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
