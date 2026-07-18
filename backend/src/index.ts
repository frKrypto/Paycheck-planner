import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './db';
import authRoutes from './routes/auth';
import { shiftRoutes, incomeRoutes } from './routes/shifts';

dotenv.config({ override: true });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
initDb();

// Routes
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});
app.use('/api/auth', authRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/income', incomeRoutes);

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});

export default app;
