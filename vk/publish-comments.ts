import { remote, Element } from "webdriverio";
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
  loginUsername: `:is(#index_login_form, #login_form) input[name="email"]`,
  loginPassword: `:is(#index_login_form, #login_form) input[name="pass"]`,
  loginSubmit: `:is(#index_login_form, #login_form) button`,
  publishPostInput: "div#post_field",
  postList: `[data-post-id]:not([data-post-id=""]).post`,
  commentButton: (id: string) => `#${id} [data-like-button-type="comment"]`,
  commentInput: (id: string) => `#${id} [contenteditable="true"]`,
  sendCommentButton: (id: string) => `#${id} button[id]:not([id=""])`,
  dropbox: `a#top_profile_link`,
  logout: `a#top_logout_link`,
};

const options = {
  sleep: argv.sleep || 30,
  timeout: argv.timeout || 15,
  postsPerPage: argv.postsPerPage || 3,
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
    await browser.navigateTo("https://vk.com");

    await browser.$(selectors.loginUsername).waitForClickable(waitOpts);
    await browser.$(selectors.loginUsername).click();
    await browser.$(selectors.loginUsername).setValue(options.login);
    await browser.$(selectors.loginPassword).click();
    await browser.$(selectors.loginPassword).setValue(options.password);
    await browser.$(selectors.loginSubmit).click();

    await browser.$(selectors.publishPostInput).waitForClickable(waitOpts);

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
    await browser.navigateTo("https://vk.com");
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

    await browser.$(selectors.postList).waitForDisplayed(waitOpts);

    const postIds = await browser
      .$$(selectors.postList)
      .map((currentValue: Element<"async">) => currentValue.getAttribute("id"));

    for (let i = 0; i < options.postsPerPage; i++) {
      const postId = postIds[i];
      await browser
        .$(selectors.commentButton(postId))
        .waitForClickable(waitOpts);
      await browser.$(selectors.commentButton(postId)).click();

      const message = prepareMessage(await selectMessage());

      await browser
        .$(selectors.commentInput(postId))
        .waitForClickable(waitOpts);
      await browser.$(selectors.commentInput(postId)).setValue(message);

      await browser
        .$(selectors.sendCommentButton(postId))
        .waitForClickable(waitOpts);
      await browser.$(selectors.sendCommentButton(postId)).click();

      await sleep(options.sleep * 1000);
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
