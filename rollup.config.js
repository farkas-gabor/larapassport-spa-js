import {getBabelOutputPlugin} from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import eslint from '@rollup/plugin-eslint';
import resolve from '@rollup/plugin-node-resolve';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import progress from 'rollup-plugin-progress';
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
        peerDepsExternal(),
        resolve({
            extensions: ['.js', '.json'],
            browser: true
        }),
        commonjs(),
        eslint({
            fix: true,
            throwOnError: true,
            throwOnWarning: true
        }),
        progress(),
        shouldMinify && terser(),
        summary()
    ];
};

const footer = `('AuthClient' in this) && this.console && this.console.warn && this.console.warn('AuthClient already declared on the global namespace');
this && this.${EXPORT_NAME} && (this.AuthClient = this.AuthClient || this.${EXPORT_NAME}.AuthClient);`;

const bundles = [
    {
        input: 'src/index.cjs.js',
        output: [
            {
                name: EXPORT_NAME,
                file: 'dist/larapassport-spa-js.production.js',
                footer,
                format: 'umd'
            }
        ],
        plugins: [...getPlugins(isProduction)]
    },
    {
        input: 'src/index.js',
        output: [
            {
                file: pkg.module,
                format: 'esm',
                plugins: [
                    getBabelOutputPlugin({
                        presets: ['@babel/preset-env']
                    })
                ]
            }
        ],
        plugins: [...getPlugins(isProduction)]
    },
    {
        input: 'src/index.cjs.js',
        output: [
            {
                name: EXPORT_NAME,
                file: pkg.main,
                format: 'cjs'
            }
        ],
        plugins: [
            ...getPlugins(false),
            getBabelOutputPlugin({
                presets: ['@babel/preset-env'],
                plugins: [
                    ['@babel/plugin-transform-runtime', {useESModules: false}]
                ]
            })
        ],
        external
    }
];

export default bundles;
