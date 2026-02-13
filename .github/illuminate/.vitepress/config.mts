import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid({
  ignoreDeadLinks: true,
  title: 'Weave.js Wiki',
  description: 'Technical documentation for Weave.js',
  appearance: 'dark',
  base: '/weavejs/',

  head: [
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap', rel: 'stylesheet' }],
  ],

  markdown: {
    lineNumbers: true,
  },

  themeConfig: {
    logo: '/logo.svg',
    outline: { level: [2, 3] },

    nav: [
      { text: 'Getting Started', link: '/getting-started/overview' },
      { text: 'Architecture', link: '/deep-dive/architecture' },
      { text: 'Onboarding', link: '/onboarding/' },
      { text: 'GitHub', link: 'https://github.com/thegovind/weavejs' },
    ],

    sidebar: [
      {
        text: 'Onboarding',
        collapsed: false,
        items: [
          { text: 'Contributor Guide', link: '/onboarding/contributor-guide' },
          { text: 'Staff Engineer Guide', link: '/onboarding/staff-engineer-guide' },
          { text: 'Executive Guide', link: '/onboarding/executive-guide' },
          { text: 'Product Manager Guide', link: '/onboarding/product-manager-guide' },
        ],
      },
      {
        text: 'Getting Started',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/getting-started/overview' },
          { text: 'Setup', link: '/getting-started/setup' },
          { text: 'Quickstart', link: '/getting-started/quickstart' },
          { text: 'Quick Reference', link: '/getting-started/quick-reference' },
        ],
      },
      {
        text: 'Deep Dive',
        collapsed: true,
        items: [
          { text: 'Architecture', link: '/deep-dive/architecture' },
          { text: 'SDK Core', link: '/deep-dive/sdk-core' },
          { text: 'Nodes System', link: '/deep-dive/nodes-system' },
          { text: 'Stores', link: '/deep-dive/stores' },
          { text: 'React Integration', link: '/deep-dive/react-integration' },
          { text: 'Plugins & Actions', link: '/deep-dive/plugins-actions' },
          { text: 'Scaffolding CLI', link: '/deep-dive/scaffolding-cli' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/thegovind/weavejs' },
    ],

    editLink: {
      pattern: 'https://github.com/thegovind/weavejs/edit/main/.github/illuminate/:path',
      text: 'Edit this page on GitHub',
    },
  },

  mermaid: {
    theme: 'dark',
    themeVariables: {
      darkMode: true,
      background: '#0d1117',
      primaryColor: '#2d333b',
      primaryTextColor: '#e6edf3',
      primaryBorderColor: '#6d5dfc',
      secondaryColor: '#1c2333',
      tertiaryColor: '#161b22',
      lineColor: '#8b949e',
      textColor: '#e6edf3',
      mainBkg: '#2d333b',
      nodeBkg: '#2d333b',
      nodeBorder: '#6d5dfc',
      clusterBkg: '#161b22',
      clusterBorder: '#30363d',
      titleColor: '#e6edf3',
      edgeLabelBackground: '#1c2333',
      nodeTextColor: '#e6edf3',
    },
  },
})
