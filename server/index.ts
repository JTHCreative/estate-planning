import express from 'express';
import cors from 'cors';
import authRouter from './auth.js';
import apiRouter from './api.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api', apiRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
