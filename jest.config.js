module.exports = {
    roots: ['<rootDir>/tests'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    testPathIgnorePatterns: [
        '<rootDir>[/\\\\](node_modules|jest|.vscode)[/\\\\]'
    ],
    transformIgnorePatterns: ['[/\\\\]node_modules[/\\\\].+\\.(ts|tsx)$'],
    transform: {
        '^.+\\.(ts|js)$': 'babel-jest'
    },
    moduleDirectories: ['node_modules', 'jest', __dirname],
    cacheDirectory: '<rootDir>/.jest-cache',
    testEnvironment: 'jsdom',
    testMatch: ['**/__tests__/**/*.js?(x)', '**/?(*.)+(spec|test).js?(x)'],
    coverageThreshold: {
        global: {
            branches: 20,
            functions: 70,
            lines: 70,
            statements: 70
        }
    },
    coveragePathIgnorePatterns: ['node_modules']
};
