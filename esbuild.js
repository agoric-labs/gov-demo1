#!/usr/bin/env node
/* eslint-disable import/no-extraneous-dependencies */
/* global require, process */
import ESBuildNodePolyfillsPlugin from 'esbuild-plugin-node-polyfills';
import esbuild from 'esbuild';

// Your ESBuild Config
const config = {
  plugins: [ESBuildNodePolyfillsPlugin],
  entryPoints: ['./src/install-ses-lockdown.js', './src/index.js'],
  bundle: true,
  outdir: 'public/',
  format: 'esm',
  sourcemap: true,
  metafile: true,
  target: 'esnext',
};

(async () => {
  const result = await esbuild.build(config);
  const text = await esbuild.analyzeMetafile(result.metafile);
  console.log(text);
})().catch(() => process.exit(1));
