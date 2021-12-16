module.exports = {
    // Lint then format JavaScript files
    'src/**/*.(js|jsx)': filenames => [
        `npx eslint --fix ${filenames.join(' ')}`
    ],

    // Format CSS, SCSS, MarkDown and JSON
    'scr/**/*.(md|json)': filenames =>
        `npx prettier --write ${filenames.join(' ')} --config ./.prettierrc`
};
