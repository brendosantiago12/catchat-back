import { RemoteAuth } from 'whatsapp-web.js';
import * as path from 'path';

/**
 * Estende RemoteAuth sobrescrevendo compressSession() para funcionar
 * no Windows, onde Chrome mantém locks exclusivos nos arquivos SQLite
 * do perfil enquanto está em execução.
 *
 * Em vez de copiar o userDataDir inteiro (inclui arquivos bloqueados),
 * copia apenas os diretórios LevelDB que o WhatsApp precisa:
 * Default/IndexedDB e Default/Local Storage.
 */
export class MongoAuth extends RemoteAuth {
  async compressSession(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fse = require('fs-extra') as typeof import('fs-extra');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const archiver = require('archiver');

    const self = this as any;
    const { tempDir, userDataDir, dataPath, sessionName } = self;

    // Garante tempDir limpo — resolve resquícios de execuções anteriores crashadas
    await fse.emptyDir(tempDir);

    // Copia apenas os diretórios que o WhatsApp precisa para restaurar a sessão.
    // São LevelDB — sem locks exclusivos de OS no Windows, ao contrário dos SQLite do Chrome.
    const essentials = [
      ['Default', 'IndexedDB'],
      ['Default', 'Local Storage'],
      ['IndexedDB'],
      ['Local Storage'],
    ];

    for (const parts of essentials) {
      const src = path.join(userDataDir, ...parts);
      const dest = path.join(tempDir, ...parts);
      if (await fse.pathExists(src)) {
        await fse.copy(src, dest, { overwrite: true }).catch(() => {});
      }
    }

    const zipPath = path.join(dataPath, `${sessionName}.zip`);

    return new Promise<void>((resolve, reject) => {
      const archive = archiver('zip');
      const stream = fse.createWriteStream(zipPath);

      archive
        .directory(tempDir, false)
        .on('error', (err: Error) => reject(err))
        .pipe(stream);

      stream.on('close', resolve);
      archive.finalize();
    });
  }
}
