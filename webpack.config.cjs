/* global module, __dirname, require */

const path = require('path');
const webpack = require('webpack');
// eslint-disable-next-line import/no-extraneous-dependencies
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    main: './src/index.js',
  },
  mode: 'development',
  // https://webpack.js.org/configuration/dev-server/
  devServer: {
    static: {
      directory: path.join(__dirname, 'public'),
    },
    compress: true,
    port: 9000,
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'Gov Demo',
      template: './index.html',
      excludeChunks: ['init'],
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
  ],
  experiments: {
    topLevelAwait: true,
  },
  resolve: {
    fallback: {
      buffer: false,
      crypto: false,
      events: false,
      path: false,
      stream: false,
      string_decoder: false,
    },
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
};
