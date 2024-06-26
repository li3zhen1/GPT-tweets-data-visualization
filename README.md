# CS7450 Assignment 

This is a vite project.

Please start python server by running `python -m http.server` **in the `dist` directory** or run `npm run dev` in the root directory after installing the dependencies.

# What's in this visualization


<!-- For this design option, your README file needs to include a description of the goals of the visualization you created. Thus, please include a short (no more than 1 paragraph) story or narrative that your visualization should communicate (and how it is supposed to do that using the combination of the text and visualizations you included). Second, please include a short list (bullets are fine) of the key features (e.g., scrolling, highlighting, etc.) that your visualization has that we should test.  -->

This visualization includes the tweets categorized into different hashtags and the sentiment of the tweets. Sentiment scores are generated by the model from https://huggingface.co/SamLowe/roberta-base-go_emotions. Some of the chart descriptions are generated by ChatGPT.

- Scrolling: The chart transition from a bar chart to a stacked area chart during scrolling. The color scheme also changes.
- Highlighting: In hashtag charts (bar chart and stacked area chart), the user can hover over the bars to highlight the hashtags.


![Bar chart of tweet tweet hashtags](./screenshots/s1.png)
![Stacked area chart of tweet hashtags](./screenshots/s2.png)
![Stacked area chart of tweet hashtags](./screenshots/s3.png)
