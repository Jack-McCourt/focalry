import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.tsx',
    ],

    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', ...defaultTheme.fontFamily.sans],
            },
            colors: {
                // Brand palette — navy primary + coral accent. Use `brand` for
                // interactive elements (buttons, links, active states) and
                // `accent` for highlights, badges and secondary chart series.
                brand: {
                    50: '#f4f5f9',
                    100: '#e7e9f2',
                    200: '#c9cde0',
                    300: '#a3aac7',
                    400: '#7079a4',
                    500: '#454e85',
                    600: '#2a305d',
                    700: '#232850',
                    800: '#1c2040',
                    900: '#151830',
                    DEFAULT: '#2a305d',
                },
                accent: {
                    50: '#fef3ef',
                    100: '#fde4da',
                    200: '#fbc6b3',
                    300: '#f9a687',
                    400: '#f78f69',
                    500: '#f67952',
                    600: '#e05f38',
                    700: '#bc4a27',
                    800: '#963a1e',
                    900: '#7a3019',
                    DEFAULT: '#f67952',
                },
                sidebar: {
                    DEFAULT: '#141414',
                    hover: '#1f1f1f',
                    active: '#262626',
                    border: '#2a2a2a',
                    text: '#a1a1aa',
                    'text-active': '#ffffff',
                },
            },
        },
    },

    plugins: [forms],
};
