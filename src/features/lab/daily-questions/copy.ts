import type en from "@/i18n/messages/en.json";

/**
 * The tool's slice of the dictionary, typed straight off the English messages.
 *
 * Client components can use this too: the import is type-only, so it never pulls
 * the server-only dictionary loader into a browser bundle.
 */
export type Copy = (typeof en)["dailyQuestions"];
