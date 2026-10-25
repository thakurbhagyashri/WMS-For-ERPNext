module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            [
                'module-resolver',
                {
                    root: ['./'],
                    alias: {
                        '@': './',
                    },
                    extensions: [
                        '.ios.js',
                        '.android.js',
                        '.js',
                        '.jsx',
                        '.ts',
                        '.tsx',
                        '.json',
                    ],
                },
            ],
            'react-native-reanimated/plugin',
        ],
    };
};
