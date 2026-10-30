# -*- coding: utf-8 -*-
"""极简 SSH/SFTP 助手（paramiko），密码从环境变量读，不落盘。
用法：HOST / USER / PASS 通过环境变量传入。
"""
import os, sys, paramiko

HOST = os.environ["DEPLOY_HOST"]
USER = os.environ.get("DEPLOY_USER", "root")
PASS = os.environ["DEPLOY_PASS"]

def client():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=25, banner_timeout=25, auth_timeout=25)
    return c

def run(c, cmd, timeout=180):
    si, so, se = c.exec_command(cmd, timeout=timeout)
    out = so.read().decode("utf-8", "replace")
    err = se.read().decode("utf-8", "replace")
    return out, err, so.channel.recv_exit_status()

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "uname -a"
    c = client()
    out, err, code = run(c, cmd)
    print(out)
    if err.strip():
        print("--- STDERR ---")
        print(err)
    print("--- EXIT %d ---" % code)
    c.close()

if __name__ == "__main__":
    main()
