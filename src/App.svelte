<script lang="ts">
  import "./app.css";
  import { onMount } from "svelte";
  import { loadTweetData, type TweetDataRow } from "./lib/GPTTweetsEntry";
  import TimelineChart from "./lib/TimelineChart.svelte";
  import typewriter from "./lib/typewriter";

  let data: TweetDataRow[] | undefined = undefined;

  onMount(async () => {
    data = await loadTweetData();
  });
</script>

<svelte:window
  on:beforeunload={() => {
    window.scrollTo({ top: 0 });
  }}
/>

<section class="absolute p-8 z-20">
  {#if data}
    <h1>GPT tweets <br /> data visualization</h1>
    <p class="pl-1 pt-3 overflow-hidden w-[calc(30vw-24px)]">
      This web page is better viewed on a screen with a width of 1440x960 px or
      more. Try Safari if Chrome/Firefox is laggy rendering the SVG animation. <i
        class="font-semibold">Don’t resize the window!</i
      >
    </p>
    <p
      in:typewriter={{ speed: 8 }}
      class="pl-1 pt-4 overflow-hidden w-[calc(30vw-24px)]"
    >
      This is a bar chart about how people tweet about GPT over time in 2023,
      categorized by the hashtags they use. The height stands for the number of
      tweets. Hover over the bars to highlight the hashtag legends.
    </p>
  {:else}
    <h1>Loading...</h1>
  {/if}
</section>

<main class="relative">
  {#if data}
    <TimelineChart {data} />
  {/if}
  <div class="w-full h-[300vh]"></div>
</main>

<style>
  h1 {
    font-weight: 500;
  }
</style>
