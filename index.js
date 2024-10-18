const axios = require("axios");
const fs = require("fs").promises;
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
require("dotenv").config();

const clientId = process.env.REDDIT_CLIENT_ID;
const clientSecret = process.env.REDDIT_CLIENT_SECRET;
const username = process.env.REDDIT_USERNAME;
const password = process.env.REDDIT_PASSWORD;

const keywords_to_look_for = ["sprite", "126720VTNR"];
const postUrl = "https://www.reddit.com/r/rolex/comments/18ykjqt/ad_wait_time_megathread_if_you_bought_a_new_rolex/";

const postUrls = [
  "https://www.reddit.com/r/rolex/comments/18ykjqt/ad_wait_time_megathread_if_you_bought_a_new_rolex/",
  "https://www.reddit.com/r/rolex/comments/100jo7p/ad_wait_time_megathread_if_you_bought_a_new_rolex/",
  "https://www.reddit.com/r/rolex/comments/rtce2y/ad_wait_time_megathread_if_you_bought_a_new_rolex/"
]

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

async function fetchComments(postId, accessToken) {
  const response = await axios.get(
    `https://oauth.reddit.com/comments/${postId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        limit: 500,  // Fetch maximum allowed comments per request
        depth: 1,    // Only fetch top-level comments
      },
    },
  );
  return response.data[1].data;
}

async function fetchMoreComments(postId, accessToken, children) {
  const response = await axios.post(
    "https://oauth.reddit.com/api/morechildren",
    new URLSearchParams({
      api_type: 'json',
      link_id: `t3_${postId}`,
      children: children.join(','),
      limit_children: false,
    }),
    {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  );
  return response.data.json.data.things;
}

async function* commentGenerator(postId, accessToken) {
  let moreComments = [];
  
  // Fetch initial set of comments
  const initialData = await fetchComments(postId, accessToken);
  for (const comment of initialData.children) {
    if (comment.kind === 't1') {
      yield comment.data;
    } else if (comment.kind === 'more') {
      moreComments = moreComments.concat(comment.data.children);
    }
  }

  // Fetch additional comments
  while (moreComments.length > 0) {
    const batch = moreComments.splice(0, 100); // Reddit allows max 100 IDs per request
    const additionalComments = await fetchMoreComments(postId, accessToken, batch);
    for (const comment of additionalComments) {
      if (comment.kind === 't1') {
        yield comment.data;
      } else if (comment.kind === 'more') {
        moreComments = moreComments.concat(comment.data.children);
      }
    }
  }
}

async function scrapeComments(postUrl) {
  const postId = postUrl.split("/comments/")[1].split("/")[0];
  const csvWriter = createCsvWriter({
    path: `reddit_comments_${postId}.csv`,
    header: [
      { id: "body", title: "Body" },
      { id: "author", title: "Author" },
      { id: "createdDate", title: "Created Date" },
      { id: "permalink", title: "Permalink" },
    ],
  });

  try {
    await fs.access(`reddit_comments_${postId}.csv`);
  } catch (e) {
    await csvWriter.writeRecords([]);  // Create empty CSV if it doesn't exist
  }

  const accessToken = await getAccessToken();
  console.log("Access token acquired");

  const commentGen = commentGenerator(postId, accessToken);
  let commentCount = 0;
  let spriteCommentCount = 0;

  for await (const comment of commentGen) {
    commentCount++;
    if (keywords_to_look_for.some(keyword => comment.body.toLowerCase().includes(keyword.toLowerCase()))) {
      spriteCommentCount++;
      const parsedComment = {
        author: comment.author,
        createdDate: new Date(comment.created_utc * 1000).toLocaleDateString(),
        permalink: `https://reddit.com${comment.permalink}`,
        body: comment.body.replace(/\n/g, ' ')
      };
      await csvWriter.writeRecords([parsedComment]);
      if (spriteCommentCount % 10 === 0) {
        console.log(`Processed ${commentCount} comments, found ${spriteCommentCount} sprite comments`);
      }
    }
  }

  console.log(`Finished processing ${commentCount} comments`);
  console.log(`Found and wrote ${spriteCommentCount} sprite-related comments to CSV`);
}

async function scrapePostUrls() {
  for (let url of postUrls) {
    await scrapeComments(url);
  }
}

// scrapeComments(postUrl);
scrapePostUrls();