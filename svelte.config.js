import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  // Consult https://svelte.dev/docs#compile-time-svelte-preprocess
  // for more information about preprocessors
  preprocess: vitePreprocess(),
}
