#!/bin/bash
cd /home/z/my-project
while true; do
  node_modules/.bin/next dev -p 3000 2>&1 | tee dev.log
  echo "[start-dev] next dev exited with code $?, restarting in 3s..." >> dev.log
  sleep 3
done
