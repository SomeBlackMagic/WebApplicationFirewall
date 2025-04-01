#!/usr/bin/env sh
#export GITHUB_REF_NAME=v1.0.0

sed -i -e "s#dev-dirty#${GITHUB_REF_NAME:-default}#g" dist/main.js
