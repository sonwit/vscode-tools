import * as path from 'path';
import Mocha from 'mocha';

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'bdd',
    color: true,
    timeout: 10000
  });

  mocha.addFile(path.resolve(__dirname, './extension.test'));

  return new Promise((resolve, reject) => {
    try {
      mocha.run((failures: number) => {
        if (failures) {
          reject(new Error(`${failures} test(s) failed.`));
          return;
        }

        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
}
