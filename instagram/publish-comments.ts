import { remote } from "webdriverio";
import { Browser, WaitForOptions } from "webdriverio/build/types";
import * as _ from "lodash";
import * as fs from "fs";
import * as messages from "../common/messages.json";
import * as hashtags from "../common/hashtags.json";
import { sleep } from "../common/sleep";
import * as yargs from "yargs";
import { hideBin } from "yargs/helpers";

const argv: any = yargs(hideBin(process.argv)).argv;

const selectors = {
  loginUsername: `#loginForm input[name="username"]`,
  loginPassword: `#loginForm input[name="password"]`,
  loginSubmit: `#loginForm button[type="submit"]`,
  saveLoginInfo: "button=Save information",
  pushNotNow: "button=Not Now",
  post: (i: number) => `article > div > div > div > div:nth-child(${i})`,
  commentInput: "article > div > div textarea",
  postComment: `button[data-testid="post-comment-input-button"]`,
  dropbox: `nav img[data-testid="user-avatar"]`,
  logout: `div=Log out`,
};

const options = {
  sleep: argv.sleep || 60,
  timeout: argv.timeout || 10,
  login: argv.login,
  password: argv.password,
};

const waitOpts: WaitForOptions = {
  timeout: options.timeout * 1000,
};

async function main() {
  const browser: Browser<"async"> = await remote({
    capabilities: { browserName: "chrome" },
  });

  try {
    await browser.navigateTo("https://instagram.com");

    await browser.$(selectors.loginUsername).setValue(options.login);
    await browser.$(selectors.loginPassword).setValue(options.password);
    await browser.$(selectors.loginSubmit).click();

    await browser.$(selectors.saveLoginInfo).waitForClickable(waitOpts);
    await browser.$(selectors.saveLoginInfo).click();

    await browser.$(selectors.pushNotNow).waitForClickable(waitOpts);
    await browser.$(selectors.pushNotNow).click();

    if (!fs.existsSync("profile_links_copy.json")) {
      await fs.promises.writeFile(
        "profile_links_copy.json",
        await fs.promises.readFile("profile_links.json", "utf-8")
      );
    }

    let profiles: string[] = JSON.parse(
      await fs.promises.readFile("profile_links_copy.json", "utf-8")
    );

    while (profiles.length) {
      await publishCommentsToPosts(browser, profiles[0]);
      profiles.shift();
      await fs.promises.writeFile(
        "profile_links_copy.json",
        JSON.stringify(profiles, null, 2)
      );
    }

    await fs.promises.unlink("profile_links_copy.json");
  } finally {
    await browser.navigateTo("https://instagram.com");
    await browser.$(selectors.dropbox).waitForDisplayed(waitOpts);
    await browser.$(selectors.dropbox).click();

    await browser.$(selectors.logout).waitForDisplayed(waitOpts);
    await browser.$(selectors.logout).click();

    process.exit(0);
  }
}
main();

async function publishCommentsToPosts(
  browser: Browser<"async">,
  profileLink: string
) {
  try {
    await browser.navigateTo(profileLink);

    for (let i = 1; i <= 3; i++) {
      await browser.$(selectors.post(i)).waitForClickable(waitOpts);
      await browser.$(selectors.post(i)).click();

      const message = prepareMessage(await selectMessage());

      await browser.$(selectors.commentInput).waitForClickable(waitOpts);
      await browser.$(selectors.commentInput).setValue(message);

      await browser.$(selectors.postComment).waitForClickable(waitOpts);
      await browser.$(selectors.postComment).click();

      await sleep(options.sleep * 1000);
      await browser.back();
    }
  } catch (err) {
    console.log(`error occured with ${profileLink}`, err);
  }
}

async function selectMessage() {
  const messageIndex = _.random(0, messages.length - 1, false);
  return messages[messageIndex];
}

function prepareMessage(message: string): string {
  return message + " " + hashtags.join(" ");
}
