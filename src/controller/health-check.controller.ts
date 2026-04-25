import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthCheckController {
  @Get()
  @ApiOperation({ summary: 'Verificar saúde da aplicação', description: 'Retorna status 200 se a aplicação estiver respondendo corretamente.' })
  @ApiResponse({ status: 200, description: 'Aplicação saudável.', schema: { example: { status: 'ok' } } })
  healthCheck() {
    return { status: 'ok' };
  }
}
