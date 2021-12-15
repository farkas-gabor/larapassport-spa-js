import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import eslint from '@rollup/plugin-eslint';
import resolve from '@rollup/plugin-node-resolve';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import summary from 'rollup-plugin-summary';
import {terser} from 'rollup-plugin-terser';

import pkg from './package.json';

const production = !process.env.ROLLUP_WATCH;
const external = Object.keys(pkg?.peerDependencies || {});

const plugins = [
    eslint({
        fix: true,
        throwOnError: true,
        throwOnWarning: true
    }),
    babel({
        exclude: 'node_modules/**',
        babelHelpers: 'runtime'
    }),
    peerDepsExternal(),
    resolve({
        extensions: ['.js', '.json']
    }),
    commonjs({
        include: /node_modules/
    }),
    production && terser(),
    summary()
];

const config = {
    input: 'src/index.js',
    output: [
        {
            file: pkg.main,
            format: 'cjs',
            sourcemap: !production
        },
        {
            file: pkg.module,
            format: 'esm',
            sourcemap: !production
        }
    ],
    plugins,
    external
};

export default config;
