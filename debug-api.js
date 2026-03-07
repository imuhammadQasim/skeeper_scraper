import axios from "axios";

const API_URL = "https://app.im.skeepers.io/api/v3/campaigns";
const TOKEN = "c:i1qii:_CFBXptoM0Iza2a6WpbzFw";

async function test() {
  try {
    const response = await axios.get(API_URL, {
      params: {
        format: "attributes",
        include: "store",
        "page[size]": 3,
        "page[number]": 1,
        sort: "-last_published_at",
      },
      headers: {
        "access-token": TOKEN,
        "x-requested-with": "XMLHttpRequest",
        Accept: "application/json",
        Origin: "https://creator.im.skeepers.io",
        Referer: "https://creator.im.skeepers.io/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    console.log("STATUS:", response.status);
    console.log("DATA TYPE:", typeof response.data);
    console.log("RAW DATA:", JSON.stringify(response.data).substring(0, 500));
  } catch (err) {
    console.error(
      "ERROR:",
      err.response?.status,
      err.response?.data || err.message,
    );
  }
}

test();
