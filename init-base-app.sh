#!/bin/bash/

CURRENT_DIR=$(pwd)

rm ../next-project -rf

cd ../

yarn create next-app ./next-project --typescript --eslint

cd ./next-project

mkdir ./src
mkdir ./public/assets -p

mv ./pages ./src
mv ./styles ./src

mv ./public/*.* ./public/assets/

for REF_TERM in src href; do
  sed -i "s/$REF_TERM=\"\//$REF_TERM=\"\/assets\//gi" ./src/**/*.tsx
done

cd $CURRENT_DIR

yarn run fire
