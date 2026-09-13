import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import yaml from 'yaml';
import swaggerUi from 'swagger-ui-express';

import { initDb, sequelize } from './config/database.config.js';
import { initializeFirebase } from './config/firebase.config.js';
import { errorHandler } from './middleware/errorHandler.middleware.js';
import { registerRoutes } from './routes/index.js';
import { startCronJobs } from './cron/jobs.js';
import logger from './utils/winston/logger.js';
import RegistrationRequestService from './services/registrationRequest.service.js';
import HealthyBootstrapService from './services/healthy/healthy-bootstrap.service.js';

dotenv.config();

await initDb();
await sequelize.authenticate();
await initializeFirebase();
await HealthyBootstrapService.initialize();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cookieParser());
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://workflow-service-front.vercel.app',
    'https://flow-frontend-ten.vercel.app',
    'http://192.168.215.72:3000',
    'https://app.tmk-workflow.kz'
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const swaggerFile = fs.readFileSync('./swagger.yaml', 'utf8');
const swaggerDocument = yaml.parse(swaggerFile);

app.use((req, res, next) => {
  const isHealthyEndpoint = req.originalUrl.startsWith('/api/healthy');
  logger.info('Incoming request', {
    endpoint: req.originalUrl,
    method: req.method,
    body: isHealthyEndpoint ? '[REDACTED_HEALTH_PAYLOAD]' : req.body
  });
  next();
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

registerRoutes(app);

app.use(errorHandler);

startCronJobs();
RegistrationRequestService.startCleanupScheduler();

app.listen(PORT, () => {
  logger.info(`Express server running on port ${PORT}`);
});
