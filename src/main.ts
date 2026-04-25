import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //app.useGlobalFilters(new GlobalExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Play Love - CatChat API')
    .setDescription('API da plataforma de mensagens anônimas via WhatsApp.')
    .setVersion('1.0')
    .addTag('Mensagens', 'Envio de mensagens anônimas e geração de QR Code PIX')
    .addTag('Webhook', 'Processamento de eventos de pagamento do Pagar.me')
    .addTag('Autenticação', 'QR Code de autenticação do WhatsApp')
    .addTag('Dev', 'Endpoints de seed de dados (apenas ambiente de desenvolvimento)')
    .addTag('Health', 'Verificação de saúde da aplicação')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  try {
    await app.listen(port);
  } catch (e) {
    if (e.code === 'EADDRINUSE') {
      console.error(
        `\n❌ Porta ${port} já está em uso.\n` +
        `   Mate o processo com: npx kill-port ${port}\n` +
        `   Ou no Windows:       netstat -ano | findstr :${port}  →  taskkill /PID <PID> /F\n`
      );
      process.exit(1);
    }
    throw e;
  }
}
bootstrap();
