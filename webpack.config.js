const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    background: './background.js',
    contentScript: './contentScript.js',
    popup: './popup.js',
    data: './data.js',
    devtools: './devtools.js'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist')
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: false, // Changed to false for debugging
            passes: 2
          },
          mangle: {
            reserved: ['chrome']
          },
          format: {
            comments: false
          }
        },
        extractComments: false
      })
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "manifest.json", to: "manifest.json" },
        { from: "icons", to: "icons" },
        { from: "*.html", to: "[name][ext]" },
      ],
    }),
  ],
  mode: 'production',
  resolve: {
    extensions: ['.js']
  },
  performance: {
    hints: false
  }
};