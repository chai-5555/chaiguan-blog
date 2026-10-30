# -*- coding: utf-8 -*-
"""把 public/ 发到 ECS 并挂上 nginx。

认证优先级：
  1) deploy/id_ed25519_chaiguan（密钥，推荐；不受密码变更影响）
  2) 环境变量 DEPLOY_PASS（密码，仅备用）

用法：
  python deploy/deploy.py                # 用密钥
  DEPLOY_PASS=xxx python deploy/deploy.py  # 用密码
"""
import os, sys, paramiko

HERE = os.path.dirname(os.path.abspath(__file__))
LOCAL_TGZ = os.path.join(HERE, "chaiguan-site.tar.gz")
LOCAL_CONF = os.path.join(HERE, "chaiguan-nginx.conf")
KEY = os.path.join(HERE, "id_ed25519_chaiguan")
REMOTE_TGZ = "/tmp/chaiguan-site.tar.gz"
REMOTE_CONF = "/etc/nginx/sites-available/chaiguan.conf"
ROOT = "/var/www/chaiguan"

HOST = os.environ.get("DEPLOY_HOST", "120.26.245.237")
USER = os.environ.get("DEPLOY_USER", "root")
PASS = os.environ.get("DEPLOY_PASS")

def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    common = dict(hostname=HOST, username=USER, timeout=25, banner_timeout=25, auth_timeout=25)
    if os.path.exists(KEY):
        try:
            c.connect(key_filename=KEY, **common)
            print("auth: key")
            return c
        except paramiko.AuthenticationException:
            print("auth: key rejected, falling back")
    if not PASS:
        sys.exit("没有可用凭据：既不能密钥登录，也没给 DEPLOY_PASS")
    c.connect(password=PASS, **common)
    print("auth: password")
    return c

def main():
    for p in (LOCAL_TGZ, LOCAL_CONF):
        if not os.path.exists(p):
            sys.exit("缺少文件: " + p + "（先跑 bash deploy/pack.sh）")

    c = connect()

    def run(cmd, timeout=300, check=True):
        si, so, se = c.exec_command(cmd, timeout=timeout)
        out = so.read().decode("utf-8", "replace"); err = se.read().decode("utf-8", "replace")
        code = so.channel.recv_exit_status()
        print("$ " + cmd.split("\n")[0][:110])
        if out.strip(): print(out.strip()[:1200])
        if err.strip(): print("[stderr] " + err.strip()[:600])
        print("[exit %d]" % code)
        if check and code != 0:
            raise SystemExit("命令失败，停止部署")
        return out

    print("== 1/5 上传 ==")
    sftp = c.open_sftp()
    sftp.put(LOCAL_TGZ, REMOTE_TGZ)
    sftp.put(LOCAL_CONF, REMOTE_CONF)
    sftp.close()
    print("uploaded:", REMOTE_TGZ, "|", REMOTE_CONF)

    print("== 2/5 解压 ==")
    run("mkdir -p %s && find %s -mindepth 1 -delete && tar xzf %s -C %s && chown -R www-data:www-data %s && ls %s | head -6"
        % (ROOT, ROOT, REMOTE_TGZ, ROOT, ROOT, ROOT))

    print("== 3/5 站点配置 ==")
    run("ln -sfn %s /etc/nginx/sites-enabled/chaiguan.conf; ls -la /etc/nginx/sites-enabled/" % REMOTE_CONF)

    print("== 4/5 nginx -t + reload ==")
    run("nginx -t && systemctl reload nginx && systemctl is-active nginx")

    print("== 5/5 自测 ==")
    run("for p in / /about/ /css/custom.css /img/banner-forest.jpg; do printf '%-24s %s\\n' \"$p\" \"$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1$p)\"; done")
    c.close()
    print("== 完成 ==")

if __name__ == "__main__":
    main()
