const path = require('path');

const config = {
  entry: './gas-scripts/index.ts',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        include: path.resolve(__dirname, 'gas-scripts'),
      },
    ],
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
};

module.exports = config