import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get()
  root() {
    return {
      app: process.env.APP_NAME ?? 'keitaro-wrapper',
      docs: '/health',
    };
  }
}
