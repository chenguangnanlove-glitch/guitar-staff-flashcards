#!/bin/bash
# 双击本文件即可启动本地服务器并打开应用。
# 走 http:// 时 Service Worker、离线缓存和「添加到主屏幕」才能正常工作。

cd "$(dirname "$0")" || exit 1

TITLE_MARK="吉他五线谱闪卡"

pause_and_exit() {
  echo
  read -r -p "按回车键关闭这个窗口…" _
  exit "${1:-0}"
}

is_our_app() {
  curl -s --max-time 1 "$1" 2>/dev/null | grep -q "$TITLE_MARK"
}

if ! command -v node >/dev/null 2>&1; then
  echo "没有找到 Node.js。"
  echo
  echo "两种办法："
  echo "  1. 安装 Node.js（https://nodejs.org），然后再双击本文件；"
  echo "  2. 直接双击 index.html —— 也能用，但没有离线缓存和「添加到主屏幕」。"
  pause_and_exit 1
fi

# 端口：优先用 PORT；否则从 8080 起找第一个可用、或已经在跑本应用的端口。
PORT_CANDIDATE="${PORT:-}"
if [ -n "$PORT_CANDIDATE" ]; then
  PORT="$PORT_CANDIDATE"
else
  PORT=""
  for candidate in $(seq 8080 8099); do
    if is_our_app "http://127.0.0.1:${candidate}/"; then
      PORT="$candidate"
      ALREADY_RUNNING=1
      break
    fi
    if ! curl -s -o /dev/null --max-time 1 "http://127.0.0.1:${candidate}/"; then
      PORT="$candidate"
      break
    fi
  done
  if [ -z "$PORT" ]; then
    echo "8080–8099 都被占用了。可以手动指定端口："
    echo "  PORT=9000 bash 启动.command"
    pause_and_exit 1
  fi
fi

URL="http://127.0.0.1:${PORT}/"

if [ "${ALREADY_RUNNING:-0}" = "1" ] || is_our_app "$URL"; then
  echo "应用已经在运行：$URL"
  open "$URL"
  sleep 1
  exit 0
fi

echo "正在启动本地服务器…"
echo "（保持这个窗口开着；关闭窗口即停止）"
echo

node scripts/serve.mjs &
SERVER_PID=$!

cleanup() {
  echo
  echo "正在停止服务器…"
  kill "$SERVER_PID" 2>/dev/null
  wait "$SERVER_PID" 2>/dev/null
}
trap cleanup EXIT INT TERM

# 等服务器就绪（最多约 5 秒）
for _ in $(seq 1 50); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "服务器没能启动，端口 $PORT 可能被其他程序占用了。"
    echo "换一个端口再试：PORT=9000 bash 启动.command"
    pause_and_exit 1
  fi
  if is_our_app "$URL"; then
    break
  fi
  sleep 0.1
done

open "$URL"
wait "$SERVER_PID"
