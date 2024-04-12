<script lang="ts">
    import {
        groupByHashTag,
        stackByBinnedHashTag,
        type BinnedCounts,
        type TweetDataRow,
        groupByMaxEmotion,
    } from "./GPTTweetsEntry";
    import { fade, slide } from "svelte/transition";
    import * as d3 from "d3";
    import _, { max } from "lodash";
    import Color from "color";
    import { onMount, tick } from "svelte";
    import typewriter from "./typewriter";

    export let data: TweetDataRow[];
    const minDate = d3.min(data, (d) => d.date)!;
    const maxDate = d3.max(data, (d) => d.date)!;

    let xAxis: d3.ScaleTime<number, number, never>;
    let yAxis: d3.ScaleLinear<number, number, never>;
    let yAxisStacked: d3.ScaleLinear<number, number, never>;

    let colorProviderElt: SVGGElement;

    const colorScheme = [
        "rgb(17,181,174)",
        "rgb(64,70,201)",
        "rgb(246,133,18)",
        "rgb(222,60,130)",
        "rgb(17,181,174)",
        "rgb(114,224,106)",
        "rgb(22,124,243)",
        "rgb(115,38,211)",
        "rgb(232,198,0)",
        "rgb(203,93,2)",
        "rgb(0,143,93)",
        "rgb(188,233,49)",
    ];

    const emotionScheme = d3.scaleDiverging([0, 10, 19], d3.interpolateRdYlGn);

    let rootElt: SVGGElement;
    let axisElt: SVGGElement;

    let scrollOffset: number;
    let windowInnerHeight: number;
    let windowInnerWidth: number;
    $: scrollRatio = scrollOffset / windowInnerHeight;
    $: updateChart(scrollOffset / windowInnerHeight);

    let activeHashTag: string | null = null;
    let allowHover = true;
    function onHover(hashtag: string | null) {
        if (!allowHover || activeHashTag === hashtag) {
            return;
        }
        activeHashTag = hashtag;
    }

    const svgEltRefs = new Map<number, SVGGElement>();
    let svgBackgroundRef: d3.Selection<
        SVGRectElement,
        unknown,
        null,
        undefined
    > | null = null;

    let grouped: [string, TweetDataRow[]][] = [];

    const precalculatedStackedData: {
        data: BinnedCounts | null;
        unstacked: BinnedCounts | null;
    } = {
        data: null,
        unstacked: null,
    };

    const precalculatedStackedDataEmotion: {
        data: BinnedCounts | null;
        unstacked: BinnedCounts | null;
    } = {
        data: null,
        unstacked: null,
    };

    function renderChart(
        rootElt: SVGGElement,
        records: TweetDataRow[],
        key: string,
        minDate: Date,
        maxDate: Date,
        xAxis: d3.ScaleTime<number, number, never>,
        yAxis: d3.ScaleLinear<number, number, never>,
        index: number,
        itemCount: number,
        delta: number,
    ) {
        const svgElt = d3
            .select(rootElt)
            .append("g")
            .attr("id", `timeline-${index}`)
            .attr("transform", `translate(0, ${index * delta})`);

        svgEltRefs.set(index, svgElt.node()!);

        const width = windowInnerWidth;
        const height = windowInnerHeight - itemCount * delta; // - margin.top - margin.bottom;

        const x = xAxis;
        const y = yAxis; //d3.scaleSqrt().domain([0, 4000]).range([height, 0]);

        const transformedData = precalculatedStackedData
            .unstacked!.find((it) => it[0] == key)![1]
            .map((b) => {
                // console.log(b);
                return {
                    x: b.x,
                    y: y(b.count),
                };
            });
        const areaGenerator = d3
            .area<{ x: number; y: number }>()
            .x((d) => d.x)
            .y0(height)
            .y1((d) => d.y)
            .curve(d3.curveBumpX);
        if (index === 0) {
            svgBackgroundRef = svgElt.append("rect");
            svgBackgroundRef
                .attr("fill", "var(--black)")
                .attr("width", windowInnerWidth)
                .attr("height", 500)
                .attr("transform", `translate(0, ${height - 2})`);
        }

        svgElt
            .append("path")
            .datum(transformedData)
            .attr("stroke", "var(--white)")
            .attr("stroke-width", 1.2)
            .attr("d", areaGenerator);

        const lh = (itemCount - index) * 0.9;

        svgElt
            .append("g")
            .attr("transform", `translate(0, ${height})`)
            .append("path")
            .attr("fill", `var(--htc-${key})`)
            .attr("stroke", "var(--white)")
            .attr("stroke-width", lh)
            .attr("d", `M0,0H${width}`)
            .attr("transform", `translate(0, ${lh / 2 - 1})`);
    }

    function renderAxis() {
        d3.select(axisElt)
            .attr("class", "x-axis")
            // .attr("transform", `translate(0, ${height})`)
            .call(
                d3.axisBottom(xAxis).tickFormat((d) => {
                    return d3.timeFormat("%b %d")(d as Date);
                }),
            )
            .call(function (g) {
                g.selectAll("path.domain").remove();
                g.selectAll(".tick line")
                    .attr("y2", windowInnerHeight)
                    .attr("stroke", "#e1e2e4")
                    .attr("stroke-width", 1.6)
                    .attr("stroke-dasharray", "6,6");

                g.selectAll(".tick text")
                    .attr("font-size", "14px")
                    .attr(`transform`, `translate(2, 48)`)
                    .attr("text-anchor", "start");
            });
    }

    let areaGenerator: d3.Area<{
        x: number;
        y: number;
    }>;

    function updateChart(_ratio: number) {
        const ratio = Math.min(1, Math.max(0, _ratio));

        svgEltRefs.forEach((elt, i) => {
            elt.setAttribute(
                "transform",
                `translate(0, ${i * (1 - ratio) * 20 + ratio * 240})`,
            );
        });
        svgBackgroundRef?.attr(
            "transform",
            `translate(0, ${windowInnerHeight - 400 - 2 * ratio})`,
        );

        const transitionRatio = Math.min(1, Math.max(0, (ratio - 0.3) / 0.7));

        const _transitionRatioToThirdScreen =
            calcTransitionRatioToThirdScreen(scrollRatio);

        const colorLookups = grouped
            .map((entry, i) => {
                const c1 = colorScheme[i % colorScheme.length];
                const c2 = emotionScheme(i);
                return `--htc-${entry[0]}: ${Color(c1)
                    .mix(Color(c2), _transitionRatioToThirdScreen)
                    .hex()}`;
            })
            .join(";");
        colorProviderElt?.setAttribute("style", colorLookups);

        // if (
        //     _transitionRatioToThirdScreen > 0 &&
        //     precalculatedStackedDataEmotion.data
        // ) {
        //     for (let index = 0; index < svgEltRefs.size; index++) {
        //         const svgEltNode = svgEltRefs.get(index);
        //         if (!svgEltNode) {
        //             continue;
        //         }
        //         const eltSel = d3.select(svgEltNode);

        //         const stacked = precalculatedStackedData.data![index][1];
        //         const stackedNew =
        //             precalculatedStackedDataEmotion.data![index][1];
        //         // const key = precalculatedStackedData.data![index][0];

        //         // const color = colorScheme[index % colorScheme.length];

        //         const transitioned = stackedNew.map((b, i) => {
        //             return {
        //                 x: b.x,
        //                 y:
        //                     yAxis(b.count) * (1 - transitionRatio) +
        //                     yAxisStacked(stacked[i].count) * transitionRatio,
        //             };
        //         });

        //         eltSel
        //             .select("path")
        //             .datum(transitioned)
        //             .join("path")
        //             .attr("d", areaGenerator);
        //         // .attr("fill", `var(--htc-${key})`)
        //         // .on("mouseover", function () {
        //         //     onHover(key);
        //         //     // @ts-ignore
        //         //     this?.setAttribute?.(
        //         //         "fill",
        //         //         // "var(--htc-dimmed-" + key + ")",
        //         //         "#000",
        //         //         // dimmedColorScheme[index % colorScheme.length],
        //         //     );
        //         // })
        //         // .on("mouseout", function () {
        //         //     onHover(null);
        //         //     // @ts-ignore
        //         //     this?.setAttribute?.("fill", color);
        //         // });
        //     }
        // } else {
        for (let index = 0; index < svgEltRefs.size; index++) {
            const svgEltNode = svgEltRefs.get(index);
            if (!svgEltNode) {
                continue;
            }
            const eltSel = d3.select(svgEltNode);

            const unstacked = precalculatedStackedData.unstacked![index][1];
            const stacked = precalculatedStackedData.data![index][1];

            const emotionStacked =
                precalculatedStackedDataEmotion.data?.[index]?.[1] ?? stacked;

            const key = precalculatedStackedData.data![index][0];

            // const color = colorScheme[index % colorScheme.length];

            const transitioned = unstacked.map((b, i) => {
                const originalY =
                    yAxis(b.count) * (1 - transitionRatio) +
                    yAxisStacked(stacked[i].count) * transitionRatio;
                if (_transitionRatioToThirdScreen > 0) {
                    const emotionY = yAxisStacked(emotionStacked[i].count);

                    return {
                        x: b.x,
                        y:
                            originalY * (1 - _transitionRatioToThirdScreen) +
                            emotionY * _transitionRatioToThirdScreen,
                    };
                }
                return {
                    x: b.x,
                    y: originalY,
                };
            });

            const c = `var(--htc-${key})`;

            eltSel
                .select("path")
                .datum(transitioned)
                .join("path")
                .attr("d", areaGenerator)
                .attr("fill", c)
                .on("mouseover", function () {
                    onHover(key);
                    if (_transitionRatioToThirdScreen < 0.2) {
                        // @ts-ignore
                        this?.setAttribute?.(
                            "fill",
                            // "var(--htc-dimmed-" + key + ")",
                            "#000",
                            // dimmedColorScheme[index % colorScheme.length],
                        );
                    }
                })
                .on("mouseout", function () {
                    onHover(null);
                    // @ts-ignore
                    this?.setAttribute?.("fill", "var(--htc-" + key + ")");
                });
            // }
        }
    }

    onMount(async () => {
        const width = windowInnerWidth;
        const height = windowInnerHeight - 20 * 20;
        areaGenerator = d3
            .area<{ x: number; y: number }>()
            .x((d) => d.x)
            .y0(windowInnerHeight - 400)
            .y1((d) => d.y)
            .curve(d3.curveStepAfter);
        xAxis = d3
            .scaleTime()
            .domain([minDate, maxDate])
            .range([width / 3, width]);
        yAxis = d3.scaleLinear().domain([0, 3600]).range([height, 0]);
        yAxisStacked = d3.scaleLinear().domain([0, 0.9]).range([height, 0]);
        grouped = groupByHashTag(data, 20);
        const agg = stackByBinnedHashTag(grouped, xAxis, minDate, maxDate);

        precalculatedStackedData.unstacked = agg.unstacked;
        precalculatedStackedData.data = agg.stacked;
        const colorLookups = grouped
            .map((entry, i) => {
                return `--htc-${entry[0]}: ${colorScheme[i % colorScheme.length]}`; //; --htc-dimmed-${entry[0]}: ${dimmedColorScheme[i % colorScheme.length]}`;
            })
            .join(";");
        colorProviderElt.setAttribute("style", colorLookups);
        grouped.forEach((entry, i) => {
            renderChart(
                rootElt,
                entry[1],
                entry[0],
                minDate,
                maxDate,
                xAxis,
                yAxis,
                i,
                20,
                20,
            );
        });

        renderAxis();

        await tick();

        let hashtagMeasure: [string, DOMRect][] = [];
        for (const entry of grouped) {
            const key = entry[0];
            const ht = document.getElementById(`ht-${key}`);

            if (ht) {
                hashtagMeasure.push([key, ht.getBoundingClientRect()]);
            }
        }

        // console.log("HTM", hashtagMeasure);

        const fl = getFlowLayoutForHashtagMeasure(
            hashtagMeasure,
            windowInnerWidth / 3 - 72,
        );

        Object.assign(flowLayout, fl);

        await tick();

        const groupedByEmotion = groupByMaxEmotion(data);
        const stackedByEmotion = stackByBinnedHashTag(
            groupedByEmotion,
            xAxis,
            minDate,
            maxDate,
        );

        // precalculatedStackedDataEmotion.unstacked = stackedByEmotion.unstacked;
        precalculatedStackedDataEmotion.data = stackedByEmotion.stacked;
    });

    function clamp(value: number, min: number, max: number) {
        return Math.min(max, Math.max(min, value));
    }

    $: labelTransitionRatio = clamp((scrollRatio - 0.4) / 0.4, 0, 1);

    const flowLayout: Record<
        string,
        {
            row: number;
            xOffset: number;
        }
    > = {};
    const maxFlowRow: { data: number } = { data: 0 };

    function getFlowLayoutForHashtagMeasure(
        measuredHashtags: [string, DOMRect][],
        maxWidth: number,
    ): Record<
        string,
        {
            row: number;
            xOffset: number;
        }
    > {
        const result: Record<
            string,
            {
                row: number;
                xOffset: number;
            }
        > = {};

        let currentRow = 0;
        let currentXOffset = 0;

        for (const [key, value] of measuredHashtags) {
            if (currentXOffset + value.width > maxWidth) {
                currentRow++;
                currentXOffset = 0;
            }
            result[key] = {
                row: currentRow,
                xOffset: currentXOffset,
            };
            currentXOffset += value.width + 16;
        }

        maxFlowRow.data = clamp(currentRow, 0, 6);

        return result;
    }
    $: lineTransitionRatio = clamp((scrollRatio - 0.8) / 0.2, 0, 1);
    $: bottomLineY = windowInnerHeight - 160 * lineTransitionRatio ?? 0;
    $: topLineY = (function () {
        const finalOffset = 178 - (windowInnerHeight - 957) * 0.11;
        return finalOffset * lineTransitionRatio ?? 0;
    })();

    $: descTransitionRatio = clamp((scrollRatio - 0.8) / 0.2, 0, 1);

    function onLegendHover(hashtag: string | null) {
        if (hashtag !== null) {
            rootElt.setAttribute("style", `--htc-${hashtag}:#000;`);
        } else {
            rootElt.setAttribute("style", "");
        }
    }

    function calcTransitionRatioToThirdScreen(scrollRatio: number) {
        return clamp((scrollRatio - 2.4) / 0.25, 0, 1);
    }

    $: transitionRatioToThirdScreen =
        calcTransitionRatioToThirdScreen(scrollRatio);
</script>

<svelte:window
    bind:scrollY={scrollOffset}
    bind:innerHeight={windowInnerHeight}
    bind:innerWidth={windowInnerWidth}
/>

<div class="timeline-chart-root">
    <svg
        style="width: 100vw; height: 100vh;
        --white: rgba(255,255,255,{(function () {
            return 1 - clamp((scrollRatio - 0.4) / 0.4, 0, 1);
        })()});--black: {(function () {
            const ratio = Math.min(1, Math.max(0, scrollRatio));
            return `rgba(${ratio * 239},${ratio * 244},${ratio * 255}, ${1 - (scrollRatio - 0.7) / 0.2})`;
        })()}"
    >
        <g opacity={lineTransitionRatio}>
            <line
                x1="33%"
                y1={bottomLineY * 0.25 + topLineY * 0.75}
                x2="100%"
                y2={bottomLineY * 0.25 + topLineY * 0.75}
                stroke="#e1e2e4"
                stroke-dasharray="6,6"
                stroke-width="1.6"
            />
            <line
                x1="33%"
                y1={bottomLineY * 0.75 + topLineY * 0.25}
                x2="100%"
                y2={bottomLineY * 0.75 + topLineY * 0.25}
                stroke="#e1e2e4"
                stroke-dasharray="6,6"
                stroke-width="1.6"
            />
            <line
                x1="33%"
                y1={(bottomLineY + topLineY) / 2}
                x2="100%"
                y2={(bottomLineY + topLineY) / 2}
                stroke="#e1e2e4"
                stroke-dasharray="6,6"
                stroke-width="1.6"
            />
        </g>

        <g bind:this={axisElt}></g>
        <g bind:this={colorProviderElt}>
            <g bind:this={rootElt}></g>
        </g>
        <g opacity={lineTransitionRatio}>
            <line
                x1="33%"
                y1={bottomLineY}
                x2="100%"
                y2={bottomLineY}
                stroke="black"
                stroke-width="1.6"
            />
            <text x="33%" y={bottomLineY + 20} fill="black"> 0&thinsp;% </text>
            {#if transitionRatioToThirdScreen > 0.001 && transitionRatioToThirdScreen < 0.999}
                <text
                    text-anchor="middle"
                    x="66%"
                    y={(bottomLineY + topLineY) / 2}
                    fill="black"
                    transition:fade={{ delay: 0, duration: 100 }}
                >
                    Please continue scrolling until this text disappears.</text
                >
            {/if}
            <line
                x1="33%"
                y1={topLineY}
                x2="100%"
                y2={topLineY}
                stroke="black"
                stroke-width="1.6"
            />
            <text x="33%" y={topLineY - 8} fill="black"> 100&thinsp;% </text>
        </g>
    </svg>

    {#if transitionRatioToThirdScreen < 0.2}
        <div
            id="hashtag-legends"
            transition:fade={{
                delay: 0,
                duration: 400,
            }}
        >
            {#each grouped as [key, value], i}
                <button
                    id="ht-{key}"
                    data-active={activeHashTag === key ? "active" : ""}
                    on:mouseover={() => onLegendHover(key)}
                    on:mouseout={() => onLegendHover(null)}
                    on:focus={() => onLegendHover(key)}
                    aria-roledescription="legend"
                    on:blur={() => onLegendHover(null)}
                    class="htblock bg-white border-black text-black border-[1.5px] pl-1 pr-1 text-sm inline-flex absolute transition-colors justify-center items-center z-10 top-0 left-0"
                    style="transform:translate({(function (
                        i,
                        keyLength,
                        valueLength,
                    ) {
                        let __top = 0;
                        let __left = 0;
                        {
                            const firstScreenTop =
                                windowInnerHeight -
                                412 +
                                i * (1 - scrollRatio) * 20 +
                                scrollRatio * 240;
                            const flowLayoutRow = flowLayout[key]?.row ?? 0;
                            // const flowLayoutXOffset = flowLayout[key]?.xOffset ?? 0;
                            const secondScreenTop =
                                windowInnerHeight -
                                182 +
                                (flowLayoutRow - maxFlowRow.data) * 42;

                            __top =
                                secondScreenTop * labelTransitionRatio +
                                firstScreenTop * (1 - labelTransitionRatio);
                        }

                        {
                            const firstScreenTop =
                                42 +
                                (((i * 87 + keyLength) % 51) / 51) *
                                    (windowInnerWidth / 3 - 120);
                            //   const flowLayoutRow = flowLayout[key]?.row ?? 0;
                            const flowLayoutXOffset =
                                flowLayout[key]?.xOffset ?? 0;
                            const secondScreenTop = 36 + flowLayoutXOffset;

                            __left =
                                secondScreenTop * labelTransitionRatio +
                                firstScreenTop * (1 - labelTransitionRatio);
                        }
                        return `${__left}px, ${__top}px`;
                    })(i, key.length, value.length)});"
                >
                    <span
                        class="color-legend"
                        style="--c:{colorScheme[i % colorScheme.length]}"
                    ></span>
                    <span>#{key}</span>
                </button>
            {/each}
        </div>
    {/if}
    {#if precalculatedStackedDataEmotion.data !== null && transitionRatioToThirdScreen > 0.5}
        <div
            id="emotions"
            class="absolute left-9 top-0 w-[30vw]"
            transition:fade={{
                delay: 0,
                duration: 400,
            }}
            style="top:{windowInnerHeight - 182 + (0 - maxFlowRow.data) * 42}px"
        >
            {#each precalculatedStackedDataEmotion.data as [key, value], i}
                <button
                    id="ht-{key}"
                    data-active={activeHashTag === key ? "active" : ""}
                    on:mouseover={() => onLegendHover(key)}
                    on:mouseout={() => onLegendHover(null)}
                    on:focus={() => onLegendHover(key)}
                    aria-roledescription="legend"
                    on:blur={() => onLegendHover(null)}
                    class="htblock bg-white border-black text-black border-[1.5px] pl-1 pr-1 text-sm inline-block transition-colors justify-center items-center z-10 mr-[16px] mb-[8px]"
                >
                    <span class="color-legend" style="--c:{emotionScheme(i)}"
                    ></span>
                    <span>{key}</span>
                </button>
            {/each}
        </div>
    {/if}

    <section
        class="absolute left-0 top-0 pl-5 desc2 grid mt-[-4px] overflow-hidden w-[calc(30vw-24px)] gap-2"
        style="transform: translate(0, {descTransitionRatio * topLineY +
            (1 - descTransitionRatio) *
                (windowInnerHeight -
                    400)}px); opacity: {descTransitionRatio};grid-template-columns: 8px 1fr;max-height: 300px; overflow-y:scroll"
    >
        <div>
            <strong> ></strong>
        </div>

        <div class="">
            {#if transitionRatioToThirdScreen <= 0.2}
                <i class="text-zinc-400">/* Prompts omitted */</i>
            {/if}
            {#if transitionRatioToThirdScreen > 0.2}
                I just did a sentimental analysis on those tweets with <a
                    href="https://huggingface.co/SamLowe/roberta-base-go_emotions"
                    class="text-sky-600 underline">roberta-base-go_emotions</a
                > and created this distribution chart with dominant emotion for each
                tweet.
            {/if}
            Please describe it.
        </div>

        <div>
            <strong> ></strong>
        </div>

        {#if transitionRatioToThirdScreen > 0.2}
            <div in:typewriter={{ speed: 10, delay: 100 }}>
                Unlike the first chart which dealt with hashtags, this one deals
                with emotions. It provides a visual representation of the
                collective emotional response on Twitter during the depicted
                timeframe, and one can observe how these emotional responses ebb
                and flow over time.
            </div>
        {:else if scrollRatio > 0.5}
            <div in:typewriter={{ speed: 10, delay: 100 }}>
                The chart is a stacked area chart representing the usage of
                various hashtags on Twitter over a period of time, from March
                14, 2023, through early April. The x-axis shows the time, with
                dates marked from March 15 onwards at two-day intervals. The
                y-axis represents the percentage of total tweets that included
                each hashtag, from 0% to 100%. The release of GPT-4 on March 14
                seems to have influenced the distribution of hashtag usage.
            </div>
        {/if}
    </section>
</div>

<style>
    .timeline-chart-root {
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        position: sticky;
        left: 0;
        top: 0;
    }
    .htblock[data-active="active"],
    .htblock:hover {
        background-color: #000 !important;
        color: white !important;
        border: 1.5px solid #000 !important;
        will-change: transform;
    }

    path g {
        will-change: transform color;
    }

    .desc2 {
        will-change: transform opacity;
    }
    .color-legend {
        width: 12px;
        height: 12px;
        display: inline-block;
        margin-right: 4px;
        background-color: var(--c);
    }
</style>
