const axios = require('axios');
const fs = require('fs').promises;
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
require('dotenv').config();

const clientId = process.env.REDDIT_CLIENT_ID;
const clientSecret = process.env.REDDIT_CLIENT_SECRET;
const username = process.env.REDDIT_USERNAME;
const password = process.env.REDDIT_PASSWORD;

async function getAccessToken() {
    const response = await axios.post(
        'https://www.reddit.com/api/v1/access_token',
        `grant_type=password&username=${username}&password=${password}`,
        {
            auth: { username: clientId, password: clientSecret },
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
    );
    return response.data.access_token;
}

async function fetchComments(postId, accessToken, after) {
    const response = await axios.get(
        `https://oauth.reddit.com/comments/${postId}`,
        {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                ...(after !== undefined && { after }),
            }
        }
    );
    return response.data[1].data.children;
}

const sprite_keywords = ['sprite', '126720VTNR'];

async function scrapeComments(postUrl) {
    const postId = postUrl.split('/comments/')[1].split('/')[0];
    const csvWriter = createCsvWriter({
        path: `reddit_comments_${postId}.csv`,
        header: [
            { id: 'author', title: 'Author' },
            { id: 'body', title: 'Comment' },
            { id: 'created_utc', title: 'Created Date' },
            { id: 'permalink', title: 'Permalink' },
        ]
    });
    try {
        await fs.readFile(`reddit_comments_${postId}.csv`)
    } catch (e) {
        await fs.writeFile(`reddit_comments_${postId}.csv`, 'Author,Comment,Created Date,Permalink\n');
    }

    const accessToken = await getAccessToken();
    console.log('access token works');
    let after = undefined;
    let count = undefined;

    do {
        const comments = await fetchComments(postId, accessToken);
        const last = comments.at(-1);
        // after = last.data.name;
        // count = last.data.count;
        const csvData = comments.filter(raw => raw.data.body !== undefined).map(({ data: {body: comment} }) => {
            return {}
        });
        await csvWriter.writeRecords(csvData);
    } while (after !== undefined)
    // try {

    //     const comments = await fetchComments(postId, accessToken);

    //     console.log(comments.length, Object.keys(comments[0]), comments[0].data, comments[0].kind);

    //     // const csvData = comments.map(comment => {
    //     //   const data = comment.data;
    //     //   return `${data.author},${data.body.replace(/,/g, ';')},${data.score},${new Date(data.created_utc * 1000).toISOString()},https://reddit.com${data.permalink}\n`;
    //     // }).join('');

    //     const header = 'Author,Comment,Created Date,Permalink\n';

    //     console.log(`CSV file has been created: reddit_comments_${postId}.csv`);
    // } catch (error) {
    //     console.error('Error:', error.message);
    // }
}

// Example usage
const postUrl = 'https://www.reddit.com/r/rolex/comments/18ykjqt/ad_wait_time_megathread_if_you_bought_a_new_rolex/';
scrapeComments(postUrl);