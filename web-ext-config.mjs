// Config for web-ext (lint, build, sign, run): keep dev-only files out of the packaged extension
export default {
    ignoreFiles: [
        'test.html',
        'README.md',
        'web-ext-config.mjs',
        'web-ext-artifacts',
    ],
};
