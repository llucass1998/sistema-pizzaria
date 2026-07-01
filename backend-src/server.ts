import { logger } from './utils/logger.js';
import { loadLocalEnv } from './config/loadEnv.js';

loadLocalEnv();

const { app } = await import('./app.js');
const { CronService } = await import('./services/cron.service.js');
const { IfoodService } = await import('./integrations/ifood/ifood.service.js');

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  logger.info(`API da pizzaria rodando em http://localhost:${port}/api`);
  CronService.start();
  IfoodService.startPollingWorker();
});
