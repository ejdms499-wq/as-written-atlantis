#!/bin/sh
cd /home/claude/m3d && npx esbuild src/main.js --bundle --minify --format=iife --target=es2020 --outfile=dist/app.js --log-level=warning && cp index.html dist/
