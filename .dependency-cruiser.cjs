/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'module-internals',
      comment: 'A module uses another module only through its public index (spec §5).',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/[^/]+/',
        pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\\.tsx?$'],
      },
    },
    {
      name: 'pure-domain',
      comment: 'domain/ is plain TypeScript: no Firebase, React or any other package (spec §5).',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain/' },
      // Only the pure parts of shared/ (shared/useNow.ts is a React hook).
      to: { pathNot: '^src/(modules/[^/]+/domain/|shared/clock\\.ts$)' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
