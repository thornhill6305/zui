import adapter from '@sveltejs/adapter-node';

export default {
  kit: {
    adapter: adapter({
      out: 'build',
    }),
    // Issue #7: Enable CSRF protection
    csrf: {
      checkOrigin: true,
    },
  },
};
