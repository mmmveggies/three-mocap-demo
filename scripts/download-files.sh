#!/usr/bin/env bash
set +ex

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
TMP_DIR=$DIR/../public/mocap

mkdir -p $TMP_DIR
cd $TMP_DIR
curl http://mocap.cs.cmu.edu/allasfamc.zip > mocap.zip
unzip mocap.zip && rm mocap.zip
rm mocap.zip
