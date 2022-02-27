import { remote } from "webdriverio";
import { Browser, WaitForOptions } from "webdriverio/build/types";
import * as _ from "lodash";
import * as fs from "fs";
import * as yargs from "yargs";
import * as messages from "../common/messages.json";
import * as hashtags from "../common/hashtags.json";
import { hideBin } from "yargs/helpers";
import { sleep } from "./sleep";

const argv: any = yargs(hideBin(process.argv)).argv;

const selectors = {
  loginUsername: `form input[name="email"]`,
  loginPassword: `form input[name="pass"]`,
  loginSubmit: `form button[name="login"]`,
  navigationSidebar: `div[role="navigation"]`,
  post: `form[role="presentation"] div[contenteditable="true"]`,
  banner: `div[aria-label="Facebook"]`,
  commentInput: "article > div > div textarea",
  postComment: `button[data-testid="post-comment-input-button"]`,
  dropbox: `div[role="navigation"] div[aria-label="Account"]`,
  logout: `div[data-nocookies="true"]`,
};

const options = {
  sleep: argv.sleep || 15,
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
    await browser.navigateTo("https://facebook.com");

    await browser.$(selectors.loginUsername).setValue(options.login);
    await browser.$(selectors.loginPassword).setValue(options.password);
    await browser.$(selectors.loginSubmit).click();

    await browser.$(selectors.banner).waitForClickable(waitOpts);

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
    await browser.navigateTo("https://facebook.com");
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

    await browser.$(selectors.post).waitForClickable(waitOpts);

    const message = prepareMessage(await selectMessage());
    await browser.$(selectors.post).setValue(message);
    await browser.keys("Enter");

    await sleep(options.sleep * 1000);
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
