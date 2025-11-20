import nextConfig from 'eslint-config-next';

export default [
  ...nextConfig,
  {
    rules: {
      'react/forbid-dom-props': 'off',
      '@next/next/no-img-element': 'off',
      'react/no-unknown-property': 'off',
      '@next/next/no-html-link-for-pages': 'off',
      'react/no-unescaped-entities': 'off'
    }
  }
];
