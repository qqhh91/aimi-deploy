import chalk from 'chalk';
import ssh2 from 'ssh2';
import { BuildReturn } from './build';
import taskLogger from "./utils/logger";

const conn = new ssh2.Client();

type ENV = 'develop' | 'test' | 'production';

async function server(options: BuildReturn, env: ENV) {

  const { buildZipPath, config } = options;

  if(!config.server){
    throw new Error('没有配置 server');
  }
  
  if(!config.sshConfig){
    throw new Error('没有配置 sshConfig');
  }

  if(!config.sshConfig[env]){
    throw new Error(`sshConfig 没有配置环境: ${env}`);
  }
  
  const { sshConfig, server } = config;
  const { remotePath, shellExecList } = server;
  const uploadParams = { file: buildZipPath, target: remotePath };
  const logger = taskLogger("服务器上传");

  function Shell(conn) {
    conn.shell(function (err, stream) {
      if (err) {
        throw err;
      }
      stream
        .on('close', function () {
          conn.end();
        })
        .on('data', function (data) {
          log('Stdout: ' + data);
        });
      stream.end(shellExecList.map((shell) => shell + ' \n').join(''));
    });
  }

  /**
   * 上传文件
   * @param conn
   * @param uploadParams 上传参数
   * @class
   */
  function UploadFile(conn, uploadParams) {
    const file = uploadParams.file;
    const target = uploadParams.target;
    if (!conn) {
      return;
    }
    conn.sftp(function (err, sftp) {
      if (err) {
        throw err;
      }
      const step = function () {};
      sftp.fastPut(file, target, { step }, function (err) {
        if (err) {
          // console.log(chalk.red(err.message));
          throw err;
        }
        logger.succeed('Please wait while uploading...');
        Shell(conn);
      });
    });
  }

  function Ready() {
    logger.start();

    conn
      .on('ready', function () {
        logger.succeed('SSH Ready success');
        UploadFile(conn, uploadParams);
      })
      .connect(sshConfig[env]);
  }

  Ready();
}

function log(str) {
  // 字色编号：30黑，31红，32绿，33黄，34蓝，35紫，36深绿，37白色
  // console.log(`\u001b[32m ${str} \u001b[32m`);
  console.log(chalk.green(str));
}

export default server;
