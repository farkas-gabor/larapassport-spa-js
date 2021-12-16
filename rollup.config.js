import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import eslint from '@rollup/plugin-eslint';
import resolve from '@rollup/plugin-node-resolve';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import summary from 'rollup-plugin-summary';
import {terser} from 'rollup-plugin-terser';

import pkg from './package.json';

const EXPORT_NAME = 'createAuthClient';
const isProduction = process.env.NODE_ENV === 'production';
const peerDependencies = Object.keys(pkg?.peerDependencies || {});
const dependencies = Object.keys(pkg?.dependencies || {});
const external = peerDependencies.concat(dependencies);

const getPlugins = shouldMinify => {
    return [
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
        shouldMinify && terser(),
        summary()
    ];
};

const bundles = [
    {
        input: 'src/index.cjs.js',
        output: [
            {
                name: EXPORT_NAME,
                file: pkg.main,
                format: 'cjs'
            }
        ],
        plugins: getPlugins(false)
    },
    {
        input: 'src/index.js',
        output: [
            {
                file: pkg.module,
                format: 'esm'
            }
        ],
        plugins: getPlugins(isProduction),
        external
    }
];

export default bundles;
