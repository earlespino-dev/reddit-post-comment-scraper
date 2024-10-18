const axios = require("axios");
const fs = require("fs").promises;
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
require("dotenv").config();

const clientId = process.env.REDDIT_CLIENT_ID;
const clientSecret = process.env.REDDIT_CLIENT_SECRET;
const username = process.env.REDDIT_USERNAME;
const password = process.env.REDDIT_PASSWORD;

async function getAccessToken() {
  const response = await axios.post(
    "https://www.reddit.com/api/v1/access_token",
    `grant_type=password&username=${username}&password=${password}`,
    {
      auth: { username: clientId, password: clientSecret },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    },
  );
  return response.data.access_token;
}

async function fetchComments(postId, accessToken, after) {
  const response = await axios.get(
    `https://oauth.reddit.com/comments/${postId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(after !== undefined && { after }),
      },
    },
  );
  return response.data[1].data.children;
}

const sprite_keywords = ["sprite", "126720VTNR"];

async function scrapeComments(postUrl) {
  const postId = postUrl.split("/comments/")[1].split("/")[0];
  const csvWriter = createCsvWriter({
    path: `reddit_comments_${postId}.csv`,
    header: [
      { id: "author", title: "Author" },
      { id: "createdDate", title: "Created Date" },
      { id: "permalink", title: "Permalink" },
      { id: "body", title: "Body" },
    ],
  });
  try {
    await fs.readFile(`reddit_comments_${postId}.csv`);
  } catch (e) {
    await fs.writeFile(
      `reddit_comments_${postId}.csv`,
      "Author,Created Date,Permalink,Body\n",
    );
  }

  const accessToken = await getAccessToken();
  console.log("access token works");
  let after = undefined;
  let count = undefined;

  do {
    const comments = await fetchComments(postId, accessToken);
    const last = comments.at(-1);
    // after = last.data.name;
    // count = last.data.count;

    const spriteCsvData = comments.filter(
      (raw) =>
        raw.data.body !== undefined &&
        sprite_keywords.some((sprite) => raw.data.body.includes(sprite)),
    );
    if (spriteCsvData) {
      const parsedCsvData = spriteCsvData.map((raw) => {
        const body = raw.data.body.replace(/\n/g, " ");
        const permalink = `https://reddit.com${raw.data.permalink}`;
        const author = raw.data.author;
        const createdDate = new Date(
          raw.data.created_utc * 1000,
        ).toLocaleDateString();

        return { author, body, createdDate, permalink };
      });
      // console.log(parsedCsvData);
      await csvWriter.writeRecords(parsedCsvData);
    }
  } while (after !== undefined);
}

// Example usage
const postUrl =
  "https://www.reddit.com/r/rolex/comments/18ykjqt/ad_wait_time_megathread_if_you_bought_a_new_rolex/";
scrapeComments(postUrl);
